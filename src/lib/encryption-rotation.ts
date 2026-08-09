export const ENCRYPTION_ROTATION_TABLES = [
  'clients',
  'credit_accounts',
  'negative_items',
  'disputes',
  'system_settings',
] as const;

export type EncryptionRotationTable = (typeof ENCRYPTION_ROTATION_TABLES)[number];
export type EncryptionRotationStatus = 'running' | 'failed' | 'completed';
export type EncryptionRotationFailureClass = 'decryption_failed' | 'rotation_failed';

export type EncryptionRotationRun = {
  id: string;
  activeKeyId: string;
  status: EncryptionRotationStatus;
  currentTable: EncryptionRotationTable | null;
  checkpointId: string | null;
  scannedCount: number;
  rotatedCount: number;
  failureClass: EncryptionRotationFailureClass | null;
};

export type EncryptionRotationRow = {
  id: string;
  values: Record<string, string | null>;
};

export type EncryptionRotationRepository = {
  findRun(runId: string): Promise<EncryptionRotationRun | null>;
  createRun(run: EncryptionRotationRun): Promise<void>;
  fetchRows(input: {
    table: EncryptionRotationTable;
    afterId: string | null;
    limit: number;
  }): Promise<EncryptionRotationRow[]>;
  commitRow(input: {
    runId: string;
    table: EncryptionRotationTable;
    rowId: string;
    values: Record<string, string>;
    scannedCount: number;
    rotatedCount: number;
  }): Promise<void>;
  advanceTable(input: {
    runId: string;
    nextTable: EncryptionRotationTable | null;
    scannedCount: number;
    rotatedCount: number;
  }): Promise<void>;
  failRun(input: {
    runId: string;
    failureClass: EncryptionRotationFailureClass;
    scannedCount: number;
    rotatedCount: number;
  }): Promise<void>;
  completeRun(input: {
    runId: string;
    scannedCount: number;
    rotatedCount: number;
  }): Promise<void>;
};

export type EncryptionRotationCryptography = {
  activeKeyId: string;
  encrypt(value: string): string;
  decrypt(value: string): string;
  isCiphertext(value: string): boolean;
};

export type EncryptionRotationResult = {
  runId: string;
  status: EncryptionRotationStatus;
  scannedCount: number;
  rotatedCount: number;
  failureClass: EncryptionRotationFailureClass | null;
};

type RotationInput = {
  repository: EncryptionRotationRepository;
  cryptography: EncryptionRotationCryptography;
  execute: boolean;
  runId?: string;
  resumeRunId?: string;
  batchSize?: number;
};

const DEFAULT_BATCH_SIZE = 100;
const LEGACY_CBC_PREFIX_PATTERN = /^[a-f0-9]{32}:/i;

export async function runEncryptionRotation(input: RotationInput): Promise<EncryptionRotationResult> {
  validateRotationInput(input);

  const runId = input.resumeRunId ?? input.runId ?? 'dry-run';
  const existingRun = input.resumeRunId ? await input.repository.findRun(input.resumeRunId) : null;

  if (input.resumeRunId) {
    validateResumeRun(existingRun, input.cryptography.activeKeyId);
  }

  const startingRun = existingRun ?? createRun(runId, input.cryptography.activeKeyId);

  if (input.execute && !existingRun) {
    await input.repository.createRun(startingRun);
  }

  let scannedCount = startingRun.scannedCount;
  let rotatedCount = startingRun.rotatedCount;
  const startingTable = startingRun.currentTable ?? ENCRYPTION_ROTATION_TABLES[0];
  const startingIndex = ENCRYPTION_ROTATION_TABLES.indexOf(startingTable);

  for (let index = startingIndex; index < ENCRYPTION_ROTATION_TABLES.length; index += 1) {
    const table = ENCRYPTION_ROTATION_TABLES[index];
    let checkpointId = table === startingTable ? startingRun.checkpointId : null;

    while (true) {
      const rows = await input.repository.fetchRows({
        table,
        afterId: checkpointId,
        limit: input.batchSize ?? DEFAULT_BATCH_SIZE,
      });

      if (rows.length === 0) break;

      for (const row of rows) {
        let values: Record<string, string>;

        try {
          values = rotateRow({ row, cryptography: input.cryptography });
        } catch {
          const failureClass: EncryptionRotationFailureClass = 'decryption_failed';
          const failureResult: EncryptionRotationResult = {
            runId,
            status: 'failed',
            scannedCount,
            rotatedCount,
            failureClass,
          };

          if (input.execute) {
            await input.repository.failRun({
              runId,
              failureClass,
              scannedCount,
              rotatedCount,
            });
          }

          return failureResult;
        }

        scannedCount += 1;
        if (Object.keys(values).length > 0) rotatedCount += 1;

        if (input.execute) {
          await input.repository.commitRow({
            runId,
            table,
            rowId: row.id,
            values,
            scannedCount,
            rotatedCount,
          });
        }

        checkpointId = row.id;
      }
    }

    const nextTable = ENCRYPTION_ROTATION_TABLES[index + 1] ?? null;
    if (input.execute && nextTable !== null) {
      await input.repository.advanceTable({
        runId,
        nextTable,
        scannedCount,
        rotatedCount,
      });
    }
  }

  const result: EncryptionRotationResult = {
    runId,
    status: 'completed',
    scannedCount,
    rotatedCount,
    failureClass: null,
  };

  if (input.execute) {
    await input.repository.completeRun(result);
  }

  return result;
}

export function formatEncryptionRotationSummary(result: EncryptionRotationResult): string {
  const failure = result.failureClass ? `; failure=${result.failureClass}` : '';
  return `Encryption rotation run ${result.runId}: ${result.status}; scanned=${result.scannedCount}; rotated=${result.rotatedCount}${failure}`;
}

function createRun(id: string, activeKeyId: string): EncryptionRotationRun {
  return {
    id,
    activeKeyId,
    status: 'running',
    currentTable: ENCRYPTION_ROTATION_TABLES[0],
    checkpointId: null,
    scannedCount: 0,
    rotatedCount: 0,
    failureClass: null,
  };
}

function validateRotationInput(input: RotationInput): void {
  if (!Number.isInteger(input.batchSize ?? DEFAULT_BATCH_SIZE) || (input.batchSize ?? DEFAULT_BATCH_SIZE) < 1) {
    throw new Error('Rotation batch size must be a positive integer');
  }

  if (input.runId && input.resumeRunId) {
    throw new Error('Choose either a new run ID or a resume run ID');
  }

  if (input.execute && !input.runId && !input.resumeRunId) {
    throw new Error('An execute rotation requires a run ID');
  }

  if (!input.execute && (input.runId || input.resumeRunId)) {
    throw new Error('Run IDs are only accepted with execute rotation');
  }
}

function validateResumeRun(
  run: EncryptionRotationRun | null,
  activeKeyId: string,
): asserts run is EncryptionRotationRun {
  if (!run) throw new Error('Encryption rotation run was not found');
  if (run.activeKeyId !== activeKeyId) throw new Error('Encryption rotation active key does not match the saved run');
  if (run.status === 'completed') throw new Error('Completed encryption rotation runs cannot be resumed');
}

function rotateRow(input: {
  row: EncryptionRotationRow;
  cryptography: EncryptionRotationCryptography;
}): Record<string, string> {
  const updatedValues: Record<string, string> = {};

  for (const [field, value] of Object.entries(input.row.values)) {
    if (value === null || value === '') continue;
    if (isActiveCiphertext(value, input.cryptography)) continue;

    const plaintext = shouldDecrypt(value, input.cryptography)
      ? input.cryptography.decrypt(value)
      : value;
    updatedValues[field] = input.cryptography.encrypt(plaintext);
  }

  return updatedValues;
}

function isActiveCiphertext(value: string, cryptography: EncryptionRotationCryptography): boolean {
  return value.startsWith(`v3:${cryptography.activeKeyId}:`) && cryptography.isCiphertext(value);
}

function shouldDecrypt(value: string, cryptography: EncryptionRotationCryptography): boolean {
  return cryptography.isCiphertext(value)
    || value.startsWith('v2:')
    || value.startsWith('v3:')
    || LEGACY_CBC_PREFIX_PATTERN.test(value);
}
