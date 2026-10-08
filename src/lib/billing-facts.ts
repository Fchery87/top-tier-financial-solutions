import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  clientBillingProfiles,
  feeConfigurations,
  serviceEngagements,
  servicesRenderedEvents,
} from '@/db/schema';
import { getBlockingComplianceGateChecks, type ComplianceGateCheckRecord } from '@/lib/compliance-gate';
import { syncComplianceGate } from '@/lib/compliance-gate-sync';
import type { FeeModel, PayableFacts } from '@/lib/billing-readiness';

export const QUALIFYING_SERVICES_RENDERED_EVENT = 'first_dispute_package_submitted';

export type FeePlan = {
  billingProfileId: string;
  feeConfigId: string;
  name: string;
  feeModel: FeeModel;
  amountCents: number;
  frequency: string | null;
  setupFeeCents: number;
};

/** The client's current fee plan: the newest billing profile that points at a fee configuration. */
export async function loadFeePlan(clientId: string): Promise<FeePlan | null> {
  const [row] = await db
    .select({
      billingProfileId: clientBillingProfiles.id,
      feeConfigId: feeConfigurations.id,
      name: feeConfigurations.name,
      feeModel: feeConfigurations.feeModel,
      amountCents: feeConfigurations.amount,
      frequency: feeConfigurations.frequency,
      setupFeeCents: feeConfigurations.setupFee,
    })
    .from(clientBillingProfiles)
    .innerJoin(feeConfigurations, eq(clientBillingProfiles.feeConfigId, feeConfigurations.id))
    .where(eq(clientBillingProfiles.clientId, clientId))
    .orderBy(desc(clientBillingProfiles.createdAt))
    .limit(1);

  if (!row) return null;
  return { ...row, setupFeeCents: row.setupFeeCents ?? 0 };
}

export type LoadedPayableFacts = {
  clientId: string;
  feePlan: FeePlan | null;
  gateRecords: ComplianceGateCheckRecord[];
  facts: PayableFacts;
};

/** Syncs the gate, then gathers every fact decideInvoicePayable reads. Null when the engagement does not exist. */
export async function loadPayableFacts(engagementId: string, now: Date): Promise<LoadedPayableFacts | null> {
  const gateRecords = await syncComplianceGate(engagementId, now);
  if (!gateRecords) return null;

  const [engagement] = await db
    .select({
      clientId: serviceEngagements.clientId,
      status: serviceEngagements.status,
      salesChannel: serviceEngagements.salesChannel,
      servicePeriodEndsAt: serviceEngagements.servicePeriodEndsAt,
      resultsAchievedAt: serviceEngagements.resultsAchievedAt,
      resultsVerificationReportDate: serviceEngagements.resultsVerificationReportDate,
      resultsVerifiedAt: serviceEngagements.resultsVerifiedAt,
    })
    .from(serviceEngagements)
    .where(eq(serviceEngagements.id, engagementId))
    .limit(1);

  if (!engagement) return null;

  const [event] = await db
    .select({ id: servicesRenderedEvents.id })
    .from(servicesRenderedEvents)
    .where(and(
      eq(servicesRenderedEvents.serviceEngagementId, engagementId),
      eq(servicesRenderedEvents.eventType, QUALIFYING_SERVICES_RENDERED_EVENT),
    ))
    .limit(1);

  const feePlan = await loadFeePlan(engagement.clientId);
  const { clientId, ...engagementFacts } = engagement;

  return {
    clientId,
    feePlan,
    gateRecords,
    facts: {
      blockingGateChecks: getBlockingComplianceGateChecks(gateRecords),
      hasServicesRenderedEvent: Boolean(event),
      feeModel: feePlan?.feeModel ?? null,
      engagement: engagementFacts,
      now,
    },
  };
}
