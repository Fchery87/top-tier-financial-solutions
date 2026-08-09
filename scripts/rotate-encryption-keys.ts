import { config } from 'dotenv';
import { and, asc, eq, gt } from 'drizzle-orm';

import {
  clients,
  creditAccounts,
  disputes,
  encryptionRotationRuns,
  negativeItems,
  systemSettings,
} from '../db/schema';
import { decrypt, encrypt, getActiveEncryptionKeyId, isCiphertextValue } from '../src/lib/encryption';
import {
  formatEncryptionRotationSummary,
  runEncryptionRotation,
  type EncryptionRotationFailureClass,
  type EncryptionRotationRepository,
  type EncryptionRotationRow,
  type EncryptionRotationRun,
  type EncryptionRotationTable,
} from '../src/lib/encryption-rotation';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const DEFAULT_BATCH_SIZE = 100;
const LLM_API_KEY_SETTING = 'llm.api_key';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CommandOptions = {
  execute: boolean;
  runId?: string;
  resumeRunId?: string;
  batchSize: number;
};

class DrizzleEncryptionRotationRepository implements EncryptionRotationRepository {
  private dbPromise: Promise<typeof import('../db/client').db> | null = null;

  async findRun(runId: string): Promise<EncryptionRotationRun | null> {
    const db = await this.getDb();
    const row = (await db
      .select()
      .from(encryptionRotationRuns)
      .where(eq(encryptionRotationRuns.id, runId))
      .limit(1))[0];

    return row ? toRotationRun(row) : null;
  }

  async createRun(run: EncryptionRotationRun): Promise<void> {
    const db = await this.getDb();
    await db.insert(encryptionRotationRuns).values({
      id: run.id,
      activeKeyId: run.activeKeyId,
      status: run.status,
      currentTable: run.currentTable,
      checkpointId: run.checkpointId,
      scannedCount: run.scannedCount,
      rotatedCount: run.rotatedCount,
      failureClass: run.failureClass,
    });
  }

  async fetchRows(input: {
    table: EncryptionRotationTable;
    afterId: string | null;
    limit: number;
  }): Promise<EncryptionRotationRow[]> {
    const db = await this.getDb();

    switch (input.table) {
      case 'clients': {
        const rows = await db
          .select({
            id: clients.id,
            firstName: clients.firstName,
            lastName: clients.lastName,
            dateOfBirth: clients.dateOfBirth,
            ssnLast4: clients.ssnLast4,
            streetAddress: clients.streetAddress,
            city: clients.city,
            state: clients.state,
            zipCode: clients.zipCode,
            phone: clients.phone,
          })
          .from(clients)
          .where(input.afterId ? gt(clients.id, input.afterId) : undefined)
          .orderBy(asc(clients.id))
          .limit(input.limit);
        return rows.map((row) => ({
          id: row.id,
          values: {
            firstName: row.firstName,
            lastName: row.lastName,
            dateOfBirth: row.dateOfBirth,
            ssnLast4: row.ssnLast4,
            streetAddress: row.streetAddress,
            city: row.city,
            state: row.state,
            zipCode: row.zipCode,
            phone: row.phone,
          },
        }));
      }
      case 'credit_accounts': {
        const rows = await db
          .select({ id: creditAccounts.id, creditorName: creditAccounts.creditorName })
          .from(creditAccounts)
          .where(input.afterId ? gt(creditAccounts.id, input.afterId) : undefined)
          .orderBy(asc(creditAccounts.id))
          .limit(input.limit);
        return rows.map((row) => ({ id: row.id, values: { creditorName: row.creditorName } }));
      }
      case 'negative_items': {
        const rows = await db
          .select({ id: negativeItems.id, creditorName: negativeItems.creditorName })
          .from(negativeItems)
          .where(input.afterId ? gt(negativeItems.id, input.afterId) : undefined)
          .orderBy(asc(negativeItems.id))
          .limit(input.limit);
        return rows.map((row) => ({ id: row.id, values: { creditorName: row.creditorName } }));
      }
      case 'disputes': {
        const rows = await db
          .select({ id: disputes.id, creditorName: disputes.creditorName })
          .from(disputes)
          .where(input.afterId ? gt(disputes.id, input.afterId) : undefined)
          .orderBy(asc(disputes.id))
          .limit(input.limit);
        return rows.map((row) => ({ id: row.id, values: { creditorName: row.creditorName } }));
      }
      case 'system_settings': {
        const condition = input.afterId
          ? and(eq(systemSettings.settingKey, LLM_API_KEY_SETTING), gt(systemSettings.id, input.afterId))
          : eq(systemSettings.settingKey, LLM_API_KEY_SETTING);
        const rows = await db
          .select({ id: systemSettings.id, settingValue: systemSettings.settingValue })
          .from(systemSettings)
          .where(condition)
          .orderBy(asc(systemSettings.id))
          .limit(input.limit);
        return rows.map((row) => ({ id: row.id, values: { settingValue: row.settingValue } }));
      }
    }
  }

  async commitRow(input: {
    runId: string;
    table: EncryptionRotationTable;
    rowId: string;
    values: Record<string, string>;
    scannedCount: number;
    rotatedCount: number;
  }): Promise<void> {
    const db = await this.getDb();

    await db.transaction(async (transaction) => {
      if (Object.keys(input.values).length > 0) {
        await updateRotationRow(transaction, input);
      }

      await transaction
        .update(encryptionRotationRuns)
        .set({
          status: 'running',
          currentTable: input.table,
          checkpointId: input.rowId,
          scannedCount: input.scannedCount,
          rotatedCount: input.rotatedCount,
          failureClass: null,
          updatedAt: new Date(),
        })
        .where(eq(encryptionRotationRuns.id, input.runId));
    });
  }

  async advanceTable(input: {
    runId: string;
    nextTable: EncryptionRotationTable | null;
    scannedCount: number;
    rotatedCount: number;
  }): Promise<void> {
    const db = await this.getDb();
    await db
      .update(encryptionRotationRuns)
      .set({
        currentTable: input.nextTable,
        checkpointId: null,
        scannedCount: input.scannedCount,
        rotatedCount: input.rotatedCount,
        updatedAt: new Date(),
      })
      .where(eq(encryptionRotationRuns.id, input.runId));
  }

  async failRun(input: {
    runId: string;
    failureClass: EncryptionRotationFailureClass;
    scannedCount: number;
    rotatedCount: number;
  }): Promise<void> {
    const db = await this.getDb();
    await db
      .update(encryptionRotationRuns)
      .set({
        status: 'failed',
        failureClass: input.failureClass,
        scannedCount: input.scannedCount,
        rotatedCount: input.rotatedCount,
        updatedAt: new Date(),
      })
      .where(eq(encryptionRotationRuns.id, input.runId));
  }

  async completeRun(input: {
    runId: string;
    scannedCount: number;
    rotatedCount: number;
  }): Promise<void> {
    const db = await this.getDb();
    await db
      .update(encryptionRotationRuns)
      .set({
        status: 'completed',
        currentTable: null,
        checkpointId: null,
        failureClass: null,
        scannedCount: input.scannedCount,
        rotatedCount: input.rotatedCount,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(encryptionRotationRuns.id, input.runId));
  }

  private async getDb(): Promise<typeof import('../db/client').db> {
    this.dbPromise ??= import('../db/client').then(({ db }) => db);
    return this.dbPromise;
  }
}

async function updateRotationRow(
  transaction: Awaited<ReturnType<typeof import('../db/client').db.transaction>>,
  input: {
    table: EncryptionRotationTable;
    rowId: string;
    values: Record<string, string>;
  },
): Promise<void> {
  switch (input.table) {
    case 'clients':
      await transaction.update(clients).set(clientRotationValues(input.values)).where(eq(clients.id, input.rowId));
      return;
    case 'credit_accounts':
      await transaction.update(creditAccounts).set(creditAccountRotationValues(input.values)).where(eq(creditAccounts.id, input.rowId));
      return;
    case 'negative_items':
      await transaction.update(negativeItems).set(negativeItemRotationValues(input.values)).where(eq(negativeItems.id, input.rowId));
      return;
    case 'disputes':
      await transaction.update(disputes).set(disputeRotationValues(input.values)).where(eq(disputes.id, input.rowId));
      return;
    case 'system_settings':
      await transaction
        .update(systemSettings)
        .set(systemSettingRotationValues(input.values))
        .where(and(eq(systemSettings.id, input.rowId), eq(systemSettings.settingKey, LLM_API_KEY_SETTING)));
      return;
  }
}

function clientRotationValues(values: Record<string, string>): Partial<typeof clients.$inferInsert> {
  return {
    ...(values.firstName === undefined ? {} : { firstName: values.firstName }),
    ...(values.lastName === undefined ? {} : { lastName: values.lastName }),
    ...(values.dateOfBirth === undefined ? {} : { dateOfBirth: values.dateOfBirth }),
    ...(values.ssnLast4 === undefined ? {} : { ssnLast4: values.ssnLast4 }),
    ...(values.streetAddress === undefined ? {} : { streetAddress: values.streetAddress }),
    ...(values.city === undefined ? {} : { city: values.city }),
    ...(values.state === undefined ? {} : { state: values.state }),
    ...(values.zipCode === undefined ? {} : { zipCode: values.zipCode }),
    ...(values.phone === undefined ? {} : { phone: values.phone }),
  };
}

function creditAccountRotationValues(values: Record<string, string>): Partial<typeof creditAccounts.$inferInsert> {
  return values.creditorName === undefined ? {} : { creditorName: values.creditorName };
}

function negativeItemRotationValues(values: Record<string, string>): Partial<typeof negativeItems.$inferInsert> {
  return values.creditorName === undefined ? {} : { creditorName: values.creditorName };
}

function disputeRotationValues(values: Record<string, string>): Partial<typeof disputes.$inferInsert> {
  return values.creditorName === undefined ? {} : { creditorName: values.creditorName };
}

function systemSettingRotationValues(values: Record<string, string>): Partial<typeof systemSettings.$inferInsert> {
  return values.settingValue === undefined ? {} : { settingValue: values.settingValue };
}

function toRotationRun(row: typeof encryptionRotationRuns.$inferSelect): EncryptionRotationRun {
  if (!isRotationStatus(row.status)) throw new Error('Invalid encryption rotation run status');
  if (row.currentTable !== null && !isRotationTable(row.currentTable)) {
    throw new Error('Invalid encryption rotation checkpoint table');
  }
  if (row.failureClass !== null && !isFailureClass(row.failureClass)) {
    throw new Error('Invalid encryption rotation failure class');
  }

  return {
    id: row.id,
    activeKeyId: row.activeKeyId,
    status: row.status,
    currentTable: row.currentTable,
    checkpointId: row.checkpointId,
    scannedCount: row.scannedCount,
    rotatedCount: row.rotatedCount,
    failureClass: row.failureClass,
  };
}

function isRotationStatus(value: string): value is EncryptionRotationRun['status'] {
  return value === 'running' || value === 'failed' || value === 'completed';
}

function isRotationTable(value: string): value is EncryptionRotationTable {
  return value === 'clients'
    || value === 'credit_accounts'
    || value === 'negative_items'
    || value === 'disputes'
    || value === 'system_settings';
}

function isFailureClass(value: string): value is EncryptionRotationFailureClass {
  return value === 'decryption_failed' || value === 'rotation_failed';
}

function parseCommandOptions(argumentsList: string[]): CommandOptions {
  const options: CommandOptions = { execute: false, batchSize: DEFAULT_BATCH_SIZE };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const value = argumentsList[index + 1];

    switch (argument) {
      case '--execute':
        options.execute = true;
        break;
      case '--run-id':
        options.runId = requireOptionValue(argument, value);
        index += 1;
        break;
      case '--resume':
        options.resumeRunId = requireOptionValue(argument, value);
        index += 1;
        break;
      case '--batch-size':
        options.batchSize = parseBatchSize(requireOptionValue(argument, value));
        index += 1;
        break;
      default:
        throw new Error('Unsupported encryption rotation command option');
    }
  }

  if (options.runId && options.resumeRunId) {
    throw new Error('Choose either --run-id or --resume');
  }
  if (options.execute && !options.runId && !options.resumeRunId) {
    throw new Error('--execute requires --run-id or --resume');
  }
  if (!options.execute && (options.runId || options.resumeRunId)) {
    throw new Error('--run-id and --resume require --execute');
  }
  if (options.runId && !UUID_PATTERN.test(options.runId)) {
    throw new Error('--run-id must be a UUID');
  }
  if (options.resumeRunId && !UUID_PATTERN.test(options.resumeRunId)) {
    throw new Error('--resume must be a UUID');
  }

  return options;
}

function requireOptionValue(option: string, value: string | undefined): string {
  if (!value || value.startsWith('--')) throw new Error(`${option} requires a value`);
  return value;
}

function parseBatchSize(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1_000) {
    throw new Error('--batch-size must be a positive integer no greater than 1000');
  }
  return parsed;
}

async function main(): Promise<void> {
  const options = parseCommandOptions(process.argv.slice(2));
  const activeKeyId = getActiveEncryptionKeyId();
  const result = await runEncryptionRotation({
    repository: new DrizzleEncryptionRotationRepository(),
    cryptography: {
      activeKeyId,
      encrypt: (value) => {
        const ciphertext = encrypt(value);
        if (!ciphertext) throw new Error('Encryption rotation encountered an empty value');
        return ciphertext;
      },
      decrypt: (value) => decrypt(value) ?? '',
      isCiphertext: isCiphertextValue,
    },
    execute: options.execute,
    runId: options.runId,
    resumeRunId: options.resumeRunId,
    batchSize: options.batchSize,
  });

  console.log(formatEncryptionRotationSummary(result));
  if (result.status === 'failed') process.exitCode = 1;
}

main().catch(() => {
  console.error('Encryption rotation failed');
  process.exitCode = 1;
});
