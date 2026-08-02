import { randomUUID } from 'crypto';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { disputes, disputeLetterRevisions } from '@/db/schema';
import { buildLetterLintContextForDispute } from '@/lib/letter-lint-context';
import { lintGeneratedLetter, type LetterLintFinding } from '@/lib/letter-lint';
import type { LetterTone } from '@/lib/letter-rewriter';

export type LetterRevisionSource = 'generated' | 'manual' | 'ai_rewrite' | 'ai_tone' | 'revert';

export interface GenerationMetadata {
  libraryId?: string | null;
  selectionScore?: number | null;
  rationale: string[];
  runnersUp: Array<{ id: string; score: number }>;
}

export interface DisputeWorkflowRow {
  id: string;
  status: string | null;
  sentAt: Date | null;
  letterContent: string | null;
  reasonCodes: string[];
  creditorName: string | null;
  originalCreditor: string | null;
  accountNumber: string | null;
  bureau: string | null;
  identityTheftFlag: boolean;
  letterContextSnapshot: string | null;
}

export interface DisputeWorkflowRevisionInput {
  disputeId: string;
  revision: number;
  content: string;
  source: LetterRevisionSource;
  toneLabel: LetterTone | null;
  promptUsed: string | null;
  lintFindings: LetterLintFinding[];
  warningsAcknowledged: boolean;
  acknowledgedBy: string | null;
  createdBy: string | null;
  generationMetadata: GenerationMetadata | null;
  createdAt: Date;
}

export interface DisputeLetterWorkflowTransaction {
  lockDispute(disputeId: string): Promise<DisputeWorkflowRow | null>;
  getLatestRevision(disputeId: string): Promise<number>;
  updateLetter(disputeId: string, content: string, updatedAt: Date): Promise<void>;
  insertRevision(input: DisputeWorkflowRevisionInput): Promise<void>;
}

export interface DisputeLetterWorkflowRepository {
  transaction<T>(operation: (transaction: DisputeLetterWorkflowTransaction) => Promise<T>): Promise<T>;
}

export type SaveLetterResult =
  | { kind: 'saved'; content: string; revision: number; updatedAt: Date; findings: LetterLintFinding[] }
  | { kind: 'warnings'; findings: LetterLintFinding[] }
  | { kind: 'blocked'; findings: LetterLintFinding[] }
  | { kind: 'immutable' }
  | { kind: 'conflict'; currentContent: string; currentRevision: number };

export interface SaveLetterInput {
  disputeId: string;
  content: string;
  source: LetterRevisionSource;
  actorUserId: string;
  acknowledgeWarnings: boolean;
  expectedRevision?: number;
  toneLabel?: LetterTone | null;
  promptUsed?: string | null;
  generationMetadata?: GenerationMetadata | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function getDate(value: unknown): Date | null {
  return value instanceof Date ? value : null;
}

function getReasonCodes(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((code): code is string => typeof code === 'string') ? parsed : [];
  } catch {
    return [];
  }
}

function parseLockedDispute(value: unknown): DisputeWorkflowRow | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  return {
    id: value.id,
    status: getString(value.status),
    sentAt: getDate(value.sent_at),
    letterContent: getString(value.letter_content),
    reasonCodes: getReasonCodes(value.reason_codes),
    creditorName: getString(value.creditor_name),
    originalCreditor: getString(value.original_creditor),
    accountNumber: getString(value.account_number),
    bureau: getString(value.bureau),
    identityTheftFlag: value.identity_theft_flag === true,
    letterContextSnapshot: getString(value.letter_context_snapshot),
  };
}

const databaseRepository: DisputeLetterWorkflowRepository = {
  async transaction<T>(operation: (transaction: DisputeLetterWorkflowTransaction) => Promise<T>) {
    return db.transaction(async (tx) => operation({
      async lockDispute(disputeId: string) {
        const result = await tx.execute(sql`
          SELECT
            id,
            status,
            sent_at,
            letter_content,
            reason_codes,
            creditor_name,
            negative_items.original_creditor AS original_creditor,
            account_number,
            bureau,
            false AS identity_theft_flag,
            disputes.letter_context_snapshot
          FROM disputes
          LEFT JOIN negative_items ON negative_items.id = disputes.negative_item_id
          WHERE disputes.id = ${disputeId}
          FOR UPDATE
        `);
        return parseLockedDispute(result.rows[0]);
      },
      async getLatestRevision(disputeId: string) {
        const [latest] = await tx
          .select({ revision: disputeLetterRevisions.revision })
          .from(disputeLetterRevisions)
          .where(eq(disputeLetterRevisions.disputeId, disputeId))
          .orderBy(desc(disputeLetterRevisions.revision))
          .limit(1);
        return latest?.revision ?? 0;
      },
      async updateLetter(disputeId: string, content: string, updatedAt: Date) {
        await tx
          .update(disputes)
          .set({ letterContent: content, updatedAt })
          .where(eq(disputes.id, disputeId));
      },
      async insertRevision(input: DisputeWorkflowRevisionInput) {
        await tx.insert(disputeLetterRevisions).values({
          id: randomUUID(),
          disputeId: input.disputeId,
          revision: input.revision,
          content: input.content,
          source: input.source,
          toneLabel: input.toneLabel,
          promptUsed: input.promptUsed,
          lintFindings: JSON.stringify(input.lintFindings),
          warningsAcknowledged: input.warningsAcknowledged,
          acknowledgedBy: input.acknowledgedBy,
          createdBy: input.createdBy,
          generationMetadata: input.generationMetadata ? JSON.stringify(input.generationMetadata) : null,
          createdAt: input.createdAt,
        });
      },
    }));
  },
};

export function createSaveDisputeLetter(repository: DisputeLetterWorkflowRepository) {
  return async function saveDisputeLetter(input: SaveLetterInput): Promise<SaveLetterResult> {
    return repository.transaction(async (transaction) => {
      const dispute = await transaction.lockDispute(input.disputeId);
      if (!dispute) throw new Error('Dispute not found');
      if (dispute.status === 'sent' || dispute.sentAt) return { kind: 'immutable' };

      const currentRevision = await transaction.getLatestRevision(input.disputeId);
      if (input.expectedRevision !== undefined && input.expectedRevision !== currentRevision) {
        return {
          kind: 'conflict',
          currentContent: dispute.letterContent || '',
          currentRevision,
        };
      }

      const lint = lintGeneratedLetter(input.content, buildLetterLintContextForDispute({
        reasonCodes: dispute.reasonCodes,
        creditorName: dispute.creditorName,
        originalCreditor: dispute.originalCreditor,
        accountNumber: dispute.accountNumber,
        bureau: dispute.bureau,
        identityTheftFlag: dispute.identityTheftFlag,
        letterContextSnapshot: dispute.letterContextSnapshot,
      }));
      if (lint.blocked) return { kind: 'blocked', findings: lint.findings };

      const warnings = lint.findings.filter((finding) => finding.severity === 'warn');
      if (warnings.length > 0 && !input.acknowledgeWarnings) {
        return { kind: 'warnings', findings: warnings };
      }

      const updatedAt = new Date();
      const revision = currentRevision + 1;
      await transaction.updateLetter(input.disputeId, input.content, updatedAt);
      await transaction.insertRevision({
        disputeId: input.disputeId,
        revision,
        content: input.content,
        source: input.source,
        toneLabel: input.toneLabel || null,
        promptUsed: input.promptUsed || null,
        lintFindings: lint.findings,
        warningsAcknowledged: warnings.length > 0,
        acknowledgedBy: warnings.length > 0 ? input.actorUserId : null,
        createdBy: input.actorUserId,
        generationMetadata: input.generationMetadata || null,
        createdAt: updatedAt,
      });

      return { kind: 'saved', content: input.content, revision, updatedAt, findings: lint.findings };
    });
  };
}

export const saveDisputeLetter = createSaveDisputeLetter(databaseRepository);
