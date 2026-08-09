// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  formatEncryptionRotationSummary,
  runEncryptionRotation,
  type EncryptionRotationRepository,
  type EncryptionRotationRun,
  type EncryptionRotationTable,
} from '@/lib/encryption-rotation';

const TABLE: EncryptionRotationTable = 'clients';

describe('encryption rotation', () => {
  it('does not write a run, row, or checkpoint during a dry run', async () => {
    const repository = createRepository([{ id: 'client-1', values: { firstName: 'legacy:Jordan' } }]);

    const result = await runEncryptionRotation({
      repository,
      cryptography: testCryptography,
      execute: false,
    });

    expect(result).toMatchObject({ status: 'completed', scannedCount: 1, rotatedCount: 1 });
    expect(repository.writeCount).toBe(0);
    expect(repository.rows[0].values.firstName).toBe('legacy:Jordan');
  });

  it('upgrades legacy encrypted values to the active v3 key', async () => {
    const repository = createRepository([{ id: 'client-1', values: { firstName: 'legacy:Jordan' } }]);

    await runEncryptionRotation({
      repository,
      cryptography: testCryptography,
      execute: true,
      runId: 'run-1',
    });

    expect(repository.rows[0].values.firstName).toBe('v3:active-key:Jordan');
    expect(repository.runs.get('run-1')).toMatchObject({
      status: 'completed',
      scannedCount: 1,
      rotatedCount: 1,
    });
    expect(repository.tableAdvances).not.toContain(null);
  });

  it('resumes at the saved table and primary-key checkpoint without revisiting prior rows', async () => {
    const repository = createRepository([
      { id: 'client-1', values: { firstName: 'legacy:Jordan' } },
      { id: 'client-2', values: { firstName: 'legacy:Alex' } },
    ]);
    repository.runs.set('run-1', {
      id: 'run-1',
      activeKeyId: 'active-key',
      status: 'running',
      currentTable: TABLE,
      checkpointId: 'client-1',
      scannedCount: 1,
      rotatedCount: 1,
      failureClass: null,
    });

    await runEncryptionRotation({
      repository,
      cryptography: testCryptography,
      execute: true,
      resumeRunId: 'run-1',
    });

    const clientFetches = repository.fetches.filter((fetch) => fetch.table === TABLE);
    expect(clientFetches).toContainEqual({ table: TABLE, afterId: 'client-1' });
    expect(clientFetches).not.toContainEqual({ table: TABLE, afterId: null });
    expect(repository.rows.map((row) => row.values.firstName)).toEqual([
      'legacy:Jordan',
      'v3:active-key:Alex',
    ]);
  });

  it('preserves a row and marks the run failed when ciphertext cannot decrypt', async () => {
    const repository = createRepository([{ id: 'client-1', values: { firstName: 'legacy:unavailable' } }]);

    const result = await runEncryptionRotation({
      repository,
      cryptography: {
        ...testCryptography,
        decrypt: () => {
          throw new Error('Jordan plaintext must never be exposed');
        },
      },
      execute: true,
      runId: 'run-1',
    });

    expect(result).toMatchObject({ status: 'failed', failureClass: 'decryption_failed' });
    expect(repository.rows[0].values.firstName).toBe('legacy:unavailable');
    expect(repository.runs.get('run-1')).toMatchObject({
      status: 'failed',
      failureClass: 'decryption_failed',
    });
  });

  it('fails closed for a malformed legacy CBC candidate instead of encrypting it as plaintext', async () => {
    const malformedLegacyValue = `${'a'.repeat(32)}:not-valid-ciphertext`;
    const repository = createRepository([{ id: 'client-1', values: { firstName: malformedLegacyValue } }]);

    const result = await runEncryptionRotation({
      repository,
      cryptography: {
        ...testCryptography,
        isCiphertext: () => false,
        decrypt: () => {
          throw new Error('ciphertext parse failure');
        },
      },
      execute: true,
      runId: 'run-1',
    });

    expect(result).toMatchObject({ status: 'failed', failureClass: 'decryption_failed' });
    expect(repository.rows[0].values.firstName).toBe(malformedLegacyValue);
  });

  it('refuses to resume when the active key differs from the saved run', async () => {
    const repository = createRepository([]);
    repository.runs.set('run-1', {
      id: 'run-1',
      activeKeyId: 'retired-key',
      status: 'running',
      currentTable: TABLE,
      checkpointId: null,
      scannedCount: 0,
      rotatedCount: 0,
      failureClass: null,
    });

    await expect(runEncryptionRotation({
      repository,
      cryptography: testCryptography,
      execute: true,
      resumeRunId: 'run-1',
    })).rejects.toThrow('active key does not match');
    expect(repository.writeCount).toBe(0);
  });

  it('formats aggregate status without including values, ciphertext, or keys', () => {
    const output = formatEncryptionRotationSummary({
      runId: 'run-1',
      status: 'failed',
      scannedCount: 3,
      rotatedCount: 2,
      failureClass: 'decryption_failed',
    });

    expect(output).toBe('Encryption rotation run run-1: failed; scanned=3; rotated=2; failure=decryption_failed');
    expect(output).not.toContain('Jordan');
    expect(output).not.toContain('v3:');
    expect(output).not.toContain('active-key');
  });
});

const testCryptography = {
  activeKeyId: 'active-key',
  encrypt: (value: string) => `v3:active-key:${value}`,
  decrypt: (value: string) => value.replace(/^legacy:/, ''),
  isCiphertext: (value: string) => value.startsWith('legacy:') || value.startsWith('v3:'),
};

type TestRow = { id: string; values: Record<string, string | null> };

function createRepository(rows: TestRow[]): TestRepository {
  return new TestRepository(rows);
}

class TestRepository implements EncryptionRotationRepository {
  readonly rows: TestRow[];
  readonly runs = new Map<string, EncryptionRotationRun>();
  readonly fetches: Array<{ table: EncryptionRotationTable; afterId: string | null }> = [];
  readonly tableAdvances: Array<EncryptionRotationTable | null> = [];
  writeCount = 0;

  constructor(rows: TestRow[]) {
    this.rows = rows;
  }

  async findRun(runId: string): Promise<EncryptionRotationRun | null> {
    return this.runs.get(runId) ?? null;
  }

  async createRun(run: EncryptionRotationRun): Promise<void> {
    this.writeCount += 1;
    this.runs.set(run.id, run);
  }

  async fetchRows(input: {
    table: EncryptionRotationTable;
    afterId: string | null;
    limit: number;
  }): Promise<TestRow[]> {
    this.fetches.push({ table: input.table, afterId: input.afterId });
    if (input.table !== TABLE) return [];

    return this.rows
      .filter((row) => input.afterId === null || row.id > input.afterId)
      .slice(0, input.limit)
      .map((row) => ({ id: row.id, values: { ...row.values } }));
  }

  async commitRow(input: {
    runId: string;
    table: EncryptionRotationTable;
    rowId: string;
    values: Record<string, string>;
    scannedCount: number;
    rotatedCount: number;
  }): Promise<void> {
    this.writeCount += 1;
    const row = this.rows.find((candidate) => candidate.id === input.rowId);
    if (!row) throw new Error('missing test row');

    row.values = { ...row.values, ...input.values };
    const run = this.runs.get(input.runId);
    if (!run) throw new Error('missing test run');
    this.runs.set(input.runId, {
      ...run,
      currentTable: input.table,
      checkpointId: input.rowId,
      scannedCount: input.scannedCount,
      rotatedCount: input.rotatedCount,
    });
  }

  async advanceTable(input: {
    runId: string;
    nextTable: EncryptionRotationTable | null;
    scannedCount: number;
    rotatedCount: number;
  }): Promise<void> {
    this.writeCount += 1;
    this.tableAdvances.push(input.nextTable);
    const run = this.runs.get(input.runId);
    if (!run) throw new Error('missing test run');
    this.runs.set(input.runId, {
      ...run,
      currentTable: input.nextTable,
      checkpointId: null,
      scannedCount: input.scannedCount,
      rotatedCount: input.rotatedCount,
    });
  }

  async failRun(input: {
    runId: string;
    failureClass: 'decryption_failed' | 'rotation_failed';
    scannedCount: number;
    rotatedCount: number;
  }): Promise<void> {
    this.writeCount += 1;
    const run = this.runs.get(input.runId);
    if (!run) throw new Error('missing test run');
    this.runs.set(input.runId, {
      ...run,
      status: 'failed',
      failureClass: input.failureClass,
      scannedCount: input.scannedCount,
      rotatedCount: input.rotatedCount,
    });
  }

  async completeRun(input: {
    runId: string;
    scannedCount: number;
    rotatedCount: number;
  }): Promise<void> {
    this.writeCount += 1;
    const run = this.runs.get(input.runId);
    if (!run) throw new Error('missing test run');
    this.runs.set(input.runId, {
      ...run,
      status: 'completed',
      currentTable: null,
      checkpointId: null,
      failureClass: null,
      scannedCount: input.scannedCount,
      rotatedCount: input.rotatedCount,
    });
  }
}
