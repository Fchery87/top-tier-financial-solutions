import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '@/db/client';
import { disputeLetterRevisions, disputes, evidencePackets } from '@/db/schema';
import type { LetterLintFinding } from '@/lib/letter-lint';
import type { Selection } from '@/lib/letter-library-selector';
import type { LetterRevisionSource } from '@/lib/dispute-letter-workflow';
import type { DisputePolicyDecision } from '@/lib/dispute-policy-decision';

export interface DraftItemSnapshotInput {
  kind: 'tradeline' | 'personal' | 'inquiry';
  bureau?: string | null;
  creditorName?: string | null;
  originalCreditor?: string | null;
  accountNumber?: string | null;
  itemType?: string | null;
  amount?: number | null;
  dateReported?: string | null;
  inquiryDate?: string | null;
}

export interface PersistGeneratedDisputeDraftInput {
  draftId?: string;
  clientId: string;
  serviceEngagementId?: string | null;
  negativeItemId?: string | null;
  bureau: string;
  disputeReason: string;
  disputeType: string;
  round: number;
  reasonCodes: string[];
  /** The server's decision (`decideDisputePolicy`); never caller-supplied. */
  policyDecision: DisputePolicyDecision;
  escalationPath?: string | null;
  methodology?: string | null;
  letterContent: string;
  letterTemplateId?: string | null;
  /** True only when the persisted letter is the provider's draft, not a template fallback. */
  generatedByAi: boolean;
  creditorName?: string | null;
  accountNumber?: string | null;
  items: DraftItemSnapshotInput[];
  lintFindings?: LetterLintFinding[];
  selection?: Selection | null;
  actorUserId?: string | null;
  priorDisputeId?: string | null;
  analysisConfidence?: number | null;
  autoSelected?: boolean;
  status?: string | null;
  revisionSource?: LetterRevisionSource;
  /** Confirmed high-risk packets the letter relies on. Unlinked ones are linked to this dispute. */
  evidencePacketIds?: string[];
}

export interface PersistedDisputeDraft {
  disputeId: string;
  revision: number;
}

function maskAccountNumber(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const lastFour = value.replace(/\D/g, '').slice(-4);
  return lastFour ? `****${lastFour}` : undefined;
}

export function buildLetterContextSnapshot(input: {
  reasonCodes: string[];
  items: DraftItemSnapshotInput[];
}): string {
  return JSON.stringify({
    version: 1,
    reasonCodes: input.reasonCodes,
    identityTheftFlag: input.reasonCodes.includes('identity_theft'),
    items: input.items.map(item => ({
      kind: item.kind,
      bureau: item.bureau || undefined,
      creditorName: item.creditorName || undefined,
      originalCreditor: item.originalCreditor || undefined,
      accountNumber: maskAccountNumber(item.accountNumber),
      itemType: item.itemType || undefined,
      amount: item.amount ?? undefined,
      dateReported: item.dateReported || item.inquiryDate || undefined,
    })),
  });
}

export function buildGenerationMetadata(selection?: Selection | null): string {
  return JSON.stringify({
    libraryId: selection?.chosen?.id || null,
    selectionScore: selection?.score || 0,
    rationale: selection?.rationale || [],
    runnersUp: selection?.runnersUp || [],
  });
}

function draftValues(input: PersistGeneratedDisputeDraftInput, now: Date) {
  return {
    clientId: input.clientId,
    serviceEngagementId: input.serviceEngagementId || null,
    negativeItemId: input.negativeItemId || null,
    bureau: input.bureau,
    disputeReason: input.disputeReason,
    disputeType: input.disputeType,
    status: input.status || 'draft',
    round: input.round,
    reasonCodes: JSON.stringify(input.reasonCodes),
    policyDecision: JSON.stringify(input.policyDecision),
    escalationPath: input.escalationPath || null,
    letterContent: input.letterContent,
    letterContextSnapshot: buildLetterContextSnapshot({
      reasonCodes: input.reasonCodes,
      items: input.items,
    }),
    letterTemplateId: input.letterTemplateId || input.selection?.chosen?.id || null,
    generatedByAi: input.generatedByAi,
    methodology: input.methodology || null,
    priorDisputeId: input.priorDisputeId || null,
    analysisConfidence: input.analysisConfidence ?? null,
    autoSelected: input.autoSelected ?? false,
    creditorName: input.creditorName || null,
    accountNumber: maskAccountNumber(input.accountNumber) || null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function persistGeneratedDisputeDraft(
  input: PersistGeneratedDisputeDraftInput,
): Promise<PersistedDisputeDraft> {
  if (!input.letterContent.trim()) throw new Error('Generated letter content is required');
  if (input.items.length === 0) throw new Error('At least one dispute item is required');
  if (!input.policyDecision?.approved) throw new Error('An approved dispute policy decision is required');

  const now = new Date();
  const generationMetadata = buildGenerationMetadata(input.selection);
  const lintFindings = input.lintFindings ? JSON.stringify(input.lintFindings) : null;
  const values = draftValues(input, now);

  return db.transaction(async (tx) => {
    const existing = input.draftId
      ? (await tx
          .select({ id: disputes.id, status: disputes.status })
          .from(disputes)
          .where(eq(disputes.id, input.draftId))
          .limit(1))[0]
      : undefined;

    if (existing && existing.status !== 'draft' && existing.status !== 'ready') {
      throw new Error('Cannot regenerate a submitted dispute draft');
    }

    const disputeId = existing?.id || input.draftId || randomUUID();
    let revision = 1;

    if (existing) {
      const [lastRevision] = await tx
        .select({ revision: disputeLetterRevisions.revision })
        .from(disputeLetterRevisions)
        .where(eq(disputeLetterRevisions.disputeId, disputeId))
        .orderBy(desc(disputeLetterRevisions.revision))
        .limit(1);
      revision = (lastRevision?.revision || 0) + 1;
      await tx.update(disputes).set(values).where(eq(disputes.id, disputeId));
    } else {
      await tx.insert(disputes).values({ id: disputeId, ...values });
    }

    await tx.insert(disputeLetterRevisions).values({
      id: randomUUID(),
      disputeId,
      revision,
      content: input.letterContent,
      source: input.revisionSource || 'generated',
      lintFindings,
      generationMetadata,
      warningsAcknowledged: false,
      acknowledgedBy: null,
      createdBy: input.actorUserId || null,
      createdAt: now,
    });

    if (input.evidencePacketIds && input.evidencePacketIds.length > 0) {
      // A packet keeps its first dispute: one item claim can back several bureau letters.
      await tx
        .update(evidencePackets)
        .set({ disputeId, updatedAt: now })
        .where(and(inArray(evidencePackets.id, input.evidencePacketIds), isNull(evidencePackets.disputeId)));
    }

    return { disputeId, revision };
  });
}
