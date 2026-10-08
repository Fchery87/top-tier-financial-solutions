import { randomUUID } from 'crypto';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  clientAgreements,
  clientDocuments,
  clientIdentityDocuments,
  clients,
  complianceGateChecks,
  disclosureAcknowledgments,
  invoicePayments,
  serviceEngagements,
  servicesRenderedEvents,
} from '@/db/schema';
import {
  deriveComplianceGateChecks,
  type AttestedComplianceGateCheckKey,
  type ComplianceGateCheckRecord,
  type ComplianceGateFacts,
} from '@/lib/compliance-gate';
import { buildDocumentChecklist } from '@/lib/document-checklist';
import { recordAdminActivity } from '@/lib/admin-activity';

export async function loadComplianceGateFacts(engagementId: string): Promise<ComplianceGateFacts | null> {
  const [engagement] = await db
    .select({ clientId: serviceEngagements.clientId, clientUserId: clients.userId })
    .from(serviceEngagements)
    .innerJoin(clients, eq(serviceEngagements.clientId, clients.id))
    .where(eq(serviceEngagements.id, engagementId))
    .limit(1);

  if (!engagement) return null;

  const [agreement] = await db
    .select({
      id: clientAgreements.id,
      cancellationDeadline: clientAgreements.cancellationDeadline,
      cancelledAt: clientAgreements.cancelledAt,
      feeTermsSnapshot: clientAgreements.feeTermsSnapshot,
    })
    .from(clientAgreements)
    .where(and(eq(clientAgreements.clientId, engagement.clientId), eq(clientAgreements.status, 'signed')))
    .orderBy(desc(clientAgreements.signedAt))
    .limit(1);

  const disclosures = agreement
    ? await db
      .select({ acknowledged: disclosureAcknowledgments.acknowledged })
      .from(disclosureAcknowledgments)
      .where(eq(disclosureAcknowledgments.agreementId, agreement.id))
    : [];

  const portalDocuments = engagement.clientUserId
    ? await db
      .select({ fileType: clientDocuments.fileType })
      .from(clientDocuments)
      .where(eq(clientDocuments.userId, engagement.clientUserId))
    : [];

  const identityDocuments = await db
    .select({ fileType: clientIdentityDocuments.documentType })
    .from(clientIdentityDocuments)
    .where(eq(clientIdentityDocuments.clientId, engagement.clientId));

  const [firstEvent] = await db
    .select({ occurredAt: servicesRenderedEvents.occurredAt })
    .from(servicesRenderedEvents)
    .where(eq(servicesRenderedEvents.serviceEngagementId, engagementId))
    .orderBy(asc(servicesRenderedEvents.occurredAt))
    .limit(1);

  const payments = await db
    .select({ receivedAt: invoicePayments.receivedAt })
    .from(invoicePayments)
    .where(and(eq(invoicePayments.clientId, engagement.clientId), eq(invoicePayments.kind, 'payment')));

  return {
    clientUserId: engagement.clientUserId,
    signedAgreement: agreement
      ? {
        cancellationDeadline: agreement.cancellationDeadline,
        cancelledAt: agreement.cancelledAt,
        feeTermsSnapshot: agreement.feeTermsSnapshot,
        disclosures: disclosures.map((row) => ({ acknowledged: row.acknowledged === true })),
      }
      : null,
    documentChecklist: buildDocumentChecklist([...portalDocuments, ...identityDocuments]),
    firstServicesRenderedAt: firstEvent?.occurredAt ?? null,
    paymentReceivedAts: payments.map((row) => row.receivedAt),
  };
}

async function readGateRecords(engagementId: string): Promise<ComplianceGateCheckRecord[]> {
  return db
    .select({
      checkKey: complianceGateChecks.checkKey,
      passed: complianceGateChecks.passed,
      checkedAt: complianceGateChecks.checkedAt,
      notes: complianceGateChecks.notes,
    })
    .from(complianceGateChecks)
    .where(eq(complianceGateChecks.engagementId, engagementId));
}

/**
 * Recomputes the derived gate rows from current records, then returns every gate row
 * (derived and attested) for the engagement. Returns null when the engagement does not exist.
 * Every gate read goes through this so no caller can see a stale derived row.
 */
export async function syncComplianceGate(
  engagementId: string,
  now: Date = new Date(),
): Promise<ComplianceGateCheckRecord[] | null> {
  const facts = await loadComplianceGateFacts(engagementId);
  if (!facts) return null;

  const derived = deriveComplianceGateChecks(facts, now);

  await db
    .insert(complianceGateChecks)
    .values(derived.map((record) => ({
      id: randomUUID(),
      engagementId,
      checkKey: record.checkKey,
      passed: record.passed,
      checkedAt: record.checkedAt,
      notes: record.notes,
      createdAt: now,
      updatedAt: now,
    })))
    .onConflictDoUpdate({
      target: [complianceGateChecks.engagementId, complianceGateChecks.checkKey],
      set: {
        passed: sql`excluded.passed`,
        notes: sql`excluded.notes`,
        // checked_at records when the result last changed, so a no-op resync keeps the original time.
        checkedAt: sql`CASE WHEN ${complianceGateChecks.passed} IS DISTINCT FROM excluded.passed THEN excluded.checked_at ELSE ${complianceGateChecks.checkedAt} END`,
        updatedAt: now,
      },
    });

  return readGateRecords(engagementId);
}

export async function attestComplianceGateCheck(input: {
  engagementId: string;
  checkKey: AttestedComplianceGateCheckKey;
  passed: boolean;
  notes: string;
  actorUserId: string;
  now: Date;
}): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(complianceGateChecks)
      .values({
        id: randomUUID(),
        engagementId: input.engagementId,
        checkKey: input.checkKey,
        passed: input.passed,
        checkedAt: input.now,
        notes: input.notes,
        createdAt: input.now,
        updatedAt: input.now,
      })
      .onConflictDoUpdate({
        target: [complianceGateChecks.engagementId, complianceGateChecks.checkKey],
        set: { passed: input.passed, checkedAt: input.now, notes: input.notes, updatedAt: input.now },
      });

    await recordAdminActivity(tx, {
      actorUserId: input.actorUserId,
      action: 'compliance_gate.attest',
      subjectType: 'service_engagement',
      subjectId: input.engagementId,
      metadata: { check_key: input.checkKey, passed: input.passed },
    });
  });
}
