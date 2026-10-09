import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { disputes, clients, clientDocuments, negativeItems, slaDefinitions, slaInstances } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { generateUniqueDisputeLetter } from '@/lib/ai-letter-generator';
import { selectLibraryForGeneration } from '@/lib/letter-generation-library';
import { rateLimited } from '@/lib/rate-limit-middleware';
import { sensitiveLimiter } from '@/lib/rate-limit';
import { decryptDisputeData, decryptClientData } from '@/lib/db-encryption';
import { requireCapability } from '@/lib/admin-session';
import type { Capability } from '@/lib/capabilities';
import { decideHighRiskClaims, highRiskConfirmationRequiredBody } from '@/lib/high-risk-claim-gate';
import { requireLatestApprovedReportForClient } from '@/lib/parser-review-gate';
import { persistGeneratedDisputeDraft } from '@/lib/dispute-draft-generator';
import { decideEscalation, loadDisputeChain } from '@/lib/dispute-escalation-decision';
import {
  calculateDisputeDeadlines,
  getDisputeSlaDefinitionId,
  getDisputeSlaInstanceId,
} from '@/lib/dispute-automation';
import { logServerEvent } from '@/lib/server-logger';
import { letterIdentityIncompleteBody, tryLoadLetterConsumerIdentity, type LetterConsumerIdentity } from '@/lib/letter-consumer-identity';

async function validateAdmin(capability: Capability) {
  return requireCapability(capability);
}

function isMissingColumnError(error: unknown): boolean {
  const code = (error as { code?: string })?.code || (error as { cause?: { code?: string } })?.cause?.code;
  const message = (error as { message?: string })?.message || '';
  return code === '42703' || message.includes('does not exist');
}

function safeDecryptClientName(client: { firstName: string; lastName: string } | null): string {
  if (!client) return 'Unknown';
  try {
    const decryptedClient = decryptClientData({ firstName: client.firstName, lastName: client.lastName });
    return `${decryptedClient.firstName} ${decryptedClient.lastName}`;
  } catch (error) {
    // Keep endpoint functional when ENCRYPTION_KEY is not configured in local/dev.
    logServerEvent({ level: 'error', event: 'server.app.api.admin.disputes.error', error: error });
    return 'Unknown';
  }
}

function safeDecryptCreditorName(creditorName: string | null): string | null {
  try {
    const decryptedDispute = decryptDisputeData({ creditorName });
    return typeof decryptedDispute.creditorName === 'string'
      ? decryptedDispute.creditorName
      : null;
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.disputes.error', error: error });
    return null;
  }
}

async function postHandler(request: NextRequest) {
  const adminUser = await validateAdmin('disputes:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { 
      clientId, 
      serviceEngagementId,
      negativeItemId, 
      bureau, 
      disputeReason, 
      disputeType,
      methodology,
      evidenceDocumentIds,
      fcraSections,
      disputedFields,
      status,
      round,
      letterContent,
      trackingNumber,
      sentAt,
      responseDeadline,
      responseChannel,
      scoreImpact,
      reasonCodes,
      escalationPath,
      targetRecipient,
      analysisConfidence,
      autoSelected,
      priorDisputeId,
    } = body;

    if (!clientId || !bureau || !disputeReason) {
      return NextResponse.json(
        { error: 'Client ID, bureau, and dispute reason are required' },
        { status: 400 }
      );
    }

    // Reason codes are chosen by staff. They are never inferred from the
    // free-text dispute reason.
    const normalizedReasonCodes: string[] = Array.isArray(reasonCodes)
      ? reasonCodes.filter((code: unknown): code is string => typeof code === 'string' && code.length > 0)
      : [];
    if (normalizedReasonCodes.length === 0) {
      return NextResponse.json(
        { error: 'At least one reason code is required' },
        { status: 400 }
      );
    }

    const reportGate = await requireLatestApprovedReportForClient(clientId);
    if (!reportGate.allowed) {
      return NextResponse.json(
        { error: reportGate.reason || 'The latest credit report must be approved before creating disputes.' },
        { status: 409 }
      );
    }

    // Policy is decided here from the database; a caller-supplied
    // `policyDecision` or confirmation flag is never trusted (ADR 0001).
    const claimDecision = await decideHighRiskClaims({
      clientId,
      reasonCodes: normalizedReasonCodes,
      items: typeof negativeItemId === 'string' && negativeItemId ? [{ kind: 'tradeline', id: negativeItemId }] : [],
    });
    if (claimDecision.kind === 'confirmation_required') {
      return NextResponse.json(highRiskConfirmationRequiredBody(claimDecision.blockers), { status: 409 });
    }
    if (claimDecision.kind === 'not_approved') {
      return NextResponse.json(
        { error: 'Dispute policy decision was not approved', violations: claimDecision.violations },
        { status: 400 }
      );
    }
    const { policyDecision, evidencePacketIds } = claimDecision;

    // Get client info
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const enclosureIds: string[] = Array.isArray(evidenceDocumentIds)
      ? evidenceDocumentIds.filter((id: unknown): id is string => typeof id === 'string')
      : [];
    if (enclosureIds.length > 0) {
      const ownedIds = new Set((await db
        .select({ id: clientDocuments.id, userId: clientDocuments.userId })
        .from(clientDocuments)
        .where(inArray(clientDocuments.id, enclosureIds)))
        .filter(doc => client.userId !== null && doc.userId === client.userId)
        .map(doc => doc.id));
      if (enclosureIds.some(id => !ownedIds.has(id))) {
        return NextResponse.json({ error: 'Evidence documents must belong to the client' }, { status: 400 });
      }
    }

    // Get negative item info if provided
    let negativeItem = null;
    if (negativeItemId) {
      const [item] = await db
        .select()
        .from(negativeItems)
        .where(eq(negativeItems.id, negativeItemId))
        .limit(1);
      negativeItem = item;
    }

    if (targetRecipient === 'cfpb') {
      if (typeof negativeItemId !== 'string' || !negativeItemId.trim()) {
        return NextResponse.json({ error: 'CFPB generation requires exactly one item per eligible CRA predecessor', reason: 'one_item_required' }, { status: 409 });
      }
      if (typeof priorDisputeId !== 'string' || !priorDisputeId.trim()) {
        return NextResponse.json({ error: 'A prior CRA dispute is required before CFPB generation', reason: 'missing_cra_dispute' }, { status: 409 });
      }
      const history = await loadDisputeChain(priorDisputeId);
      const decision = decideEscalation({
        history,
        plan: {
          nextRound: round || 1,
          targetRecipient: 'cfpb',
          disputeType: 'fcra_violation_notice',
          methodology: 'factual',
          reasonCodes: normalizedReasonCodes,
          customReason: disputeReason,
        },
      });
      if (decision.kind === 'blocked') {
        return NextResponse.json({ error: decision.message, reason: decision.eligibility.reason, eligible_at: decision.eligibility.eligibleAt?.toISOString() || null }, { status: 409 });
      }
      const craDispute = history.find(entry => entry.targetRecipient === 'bureau' && entry.sentAt !== null);
      if (
        !craDispute
        || history[0]?.clientId !== clientId
        || craDispute?.clientId !== clientId
        || craDispute.negativeItemId !== negativeItemId
      ) {
        return NextResponse.json({ error: 'The prior CRA dispute does not match this client and item' }, { status: 409 });
      }
    }

    const manualLetterContent = typeof letterContent === 'string' && letterContent ? letterContent : null;
    let consumer: LetterConsumerIdentity | null = null;
    // A generated letter is written from the decrypted identity; a manual
    // letter is the caller's own text.
    if (!manualLetterContent) {
      const identityResult = await tryLoadLetterConsumerIdentity(clientId);
      if (!identityResult.ok) {
        return NextResponse.json(letterIdentityIncompleteBody(identityResult.error), { status: 409 });
      }
      consumer = identityResult.identity;
    }

    // Generate dispute letter using AI generator with FCRA/CRSA/Metro2 compliance (unless caller provided content)
    const generationSelection = letterContent
      ? { chosen: null, score: 0, rationale: [], runnersUp: [] }
      : await selectLibraryForGeneration({
        round: round || 1,
        targetRecipient: targetRecipient || 'bureau',
        bureau,
        itemType: negativeItem?.itemType || 'unknown',
        reasonCodes: normalizedReasonCodes,
        methodology: methodology || undefined,
      });

    const generation = !consumer ? null : await generateUniqueDisputeLetter({
      disputeType: disputeType || 'standard',
      round: round || 1,
      targetRecipient: targetRecipient || 'bureau',
      clientData: consumer,
      itemData: {
        creditorName: negativeItem?.creditorName || 'Unknown Creditor',
        originalCreditor: negativeItem?.originalCreditor || undefined,
        accountNumber: negativeItem?.creditAccountId ? undefined : negativeItem?.id?.slice(-4) || undefined,
        itemType: negativeItem?.itemType || 'unknown',
        amount: negativeItem?.amount || undefined,
        dateReported: negativeItem?.dateReported?.toISOString() || undefined,
        bureau,
      },
      reasonCodes: normalizedReasonCodes,
      customReason: disputeReason,
      librarySelection: generationSelection,
    });
    const generatedLetterContent = manualLetterContent ?? generation?.letter ?? '';

    const normalizedConfidence = analysisConfidence !== undefined && analysisConfidence !== null
      ? Math.round(analysisConfidence)
      : null;

    // Persist the dispute and its first revision through the shared generation seam.
    const now = new Date();
    
    // Build escalation history with admin info for audit trail
    const initialHistory = JSON.stringify([{
      action: 'created',
      timestamp: now.toISOString(),
      adminId: adminUser.id,
      adminEmail: adminUser.email,
    }]);

    const sentDate = sentAt ? new Date(sentAt) : null;
    const computedDeadlines = sentDate ? calculateDisputeDeadlines(sentDate, escalationPath || targetRecipient) : null;
    const computedResponseDeadline = sentDate
      ? responseDeadline
        ? new Date(responseDeadline)
        : computedDeadlines?.responseDeadline || null
      : null;

    // Encrypt creditor name (already encrypted if from negativeItem, so use as-is)
    const creditorNameValue = negativeItem?.creditorName || null;

    const persistedDraft = await persistGeneratedDisputeDraft({
      clientId,
      serviceEngagementId,
      negativeItemId,
      bureau,
      disputeReason,
      disputeType: disputeType || 'standard',
      round: round || 1,
      reasonCodes: normalizedReasonCodes,
      policyDecision,
      escalationPath: escalationPath || targetRecipient || 'bureau',
      methodology,
      letterContent: generatedLetterContent,
      generatedByAi: generation?.source === 'ai',
      status: status || 'draft',
      revisionSource: letterContent ? 'manual' : 'generated',
      creditorName: creditorNameValue,
      accountNumber: negativeItem?.creditAccountId ? null : negativeItem?.id?.slice(-4) || null,
      items: [{
        kind: 'tradeline',
        bureau,
        creditorName: negativeItem?.creditorName || null,
        originalCreditor: negativeItem?.originalCreditor || null,
        accountNumber: negativeItem?.creditAccountId ? null : negativeItem?.id?.slice(-4) || null,
        itemType: negativeItem?.itemType || 'unknown',
        amount: negativeItem?.amount || null,
        dateReported: negativeItem?.dateReported?.toISOString() || null,
      }],
      actorUserId: adminUser.id,
      priorDisputeId,
      analysisConfidence: normalizedConfidence,
      autoSelected: !!autoSelected,
      evidencePacketIds,
    });
    const id = persistedDraft.disputeId;

    await db.update(disputes).set({
      fcraSections: fcraSections ? JSON.stringify(fcraSections) : null,
      disputedFields: disputedFields ? JSON.stringify(disputedFields) : null,
      evidenceDocumentIds: evidenceDocumentIds ? JSON.stringify(evidenceDocumentIds) : null,
      escalationHistory: initialHistory,
      trackingNumber: trackingNumber || null,
      sentAt: sentDate,
      responseDeadline: computedResponseDeadline,
      escalationReadyAt: computedDeadlines?.escalationReadyAt || null,
      responseChannel: responseChannel || null,
      scoreImpact: scoreImpact ?? null,
      updatedAt: now,
    }).where(eq(disputes.id, id));
    
    logServerEvent({ level: 'info', event: 'server.app.api.admin.disputes.log', error: `[AUDIT] Dispute ${id} created by admin ${adminUser.email} for client ${clientId}` });

    if (sentDate && computedResponseDeadline) {
      const definitionId = getDisputeSlaDefinitionId();
      const slaInstanceId = getDisputeSlaInstanceId(id);
      await db
        .insert(slaDefinitions)
        .values({
          id: definitionId,
          name: 'Dispute Response Window',
          description: 'Tracks 30-day bureau response SLA for sent disputes.',
          stage: 'round_in_progress',
          maxDays: 30,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();

      await db
        .insert(slaInstances)
        .values({
          id: slaInstanceId,
          clientId,
          definitionId,
          stage: 'round_in_progress',
          startedAt: sentDate,
          dueAt: computedResponseDeadline,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: slaInstances.id,
          set: {
            dueAt: computedResponseDeadline,
            status: 'active',
            completedAt: null,
            breachNotifiedAt: null,
            updatedAt: now,
          },
        });
    }

    // Fetch the created dispute
    const [createdDispute] = await db
      .select()
      .from(disputes)
      .where(eq(disputes.id, id))
      .limit(1);

    return NextResponse.json({
      id: createdDispute.id,
      client_id: createdDispute.clientId,
      negative_item_id: createdDispute.negativeItemId,
      bureau: createdDispute.bureau,
      dispute_reason: createdDispute.disputeReason,
      dispute_type: createdDispute.disputeType,
      status: createdDispute.status,
      round: createdDispute.round,
      letter_content: createdDispute.letterContent,
      tracking_number: createdDispute.trackingNumber,
      sent_at: createdDispute.sentAt?.toISOString(),
      response_deadline: createdDispute.responseDeadline?.toISOString(),
      reason_codes: createdDispute.reasonCodes,
      policy_decision: createdDispute.policyDecision ? JSON.parse(createdDispute.policyDecision) : null,
      generation_source: generation ? generation.source : 'manual',
      generation_failure_reason: generation?.failureReason ?? null,
      analysis_confidence: createdDispute.analysisConfidence,
      auto_selected: createdDispute.autoSelected,
      created_at: createdDispute.createdAt?.toISOString(),
    }, { status: 201 });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.disputes.error', error: error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create dispute' },
      { status: 500 }
    );
  }
}

async function getHandler(request: NextRequest) {
  const adminUser = await validateAdmin('disputes:read');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('client_id');
  const status = searchParams.get('status');
  const bureau = searchParams.get('bureau');
  const round = searchParams.get('round');
  const outcome = searchParams.get('outcome');
   const methodology = searchParams.get('methodology');
  const awaitingResponse = searchParams.get('awaiting_response');
  const overdue = searchParams.get('overdue');

  try {
    // Build query with optional filters
    let query = db
      .select({
        dispute: disputes,
        client: clients,
      })
      .from(disputes)
      .leftJoin(clients, eq(disputes.clientId, clients.id));

    const conditions = [];

    if (clientId) {
      conditions.push(eq(disputes.clientId, clientId));
    }

    if (status) {
      conditions.push(eq(disputes.status, status));
    }

    if (bureau) {
      conditions.push(eq(disputes.bureau, bureau));
    }

    if (round) {
      conditions.push(eq(disputes.round, parseInt(round)));
    }

    if (outcome) {
      conditions.push(eq(disputes.outcome, outcome));
    }

    if (methodology) {
      conditions.push(eq(disputes.methodology, methodology));
    }

    // Filter for disputes awaiting response (sent but no response yet)
    if (awaitingResponse === 'true') {
      conditions.push(eq(disputes.status, 'sent'));
    }

    // Apply conditions if any
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    let results: Array<{
      dispute: {
        id: string;
        clientId: string;
        negativeItemId: string | null;
        bureau: string;
        disputeReason: string;
        disputeType: string | null;
        status: string | null;
        round: number | null;
        letterContent: string | null;
        trackingNumber: string | null;
        sentAt: Date | null;
        responseDeadline: Date | null;
        responseReceivedAt: Date | null;
        outcome: string | null;
        responseNotes: string | null;
        creditorName: string | null;
        accountNumber: string | null;
        createdAt: Date | null;
        updatedAt: Date | null;
        responseDocumentUrl?: string | null;
        responseChannel?: string | null;
        scoreImpact?: number | null;
        reasonCodes?: string | null;
        analysisConfidence?: number | null;
        autoSelected?: boolean | null;
      };
      client: {
        firstName: string;
        lastName: string;
      } | null;
    }>;

    try {
      results = await query;
    } catch (queryError) {
      if (!isMissingColumnError(queryError)) {
        throw queryError;
      }

      // Backward compatibility for environments missing recent disputes columns.
      let fallbackQuery = db
        .select({
          dispute: {
            id: disputes.id,
            clientId: disputes.clientId,
            negativeItemId: disputes.negativeItemId,
            bureau: disputes.bureau,
            disputeReason: disputes.disputeReason,
            disputeType: disputes.disputeType,
            status: disputes.status,
            round: disputes.round,
            letterContent: disputes.letterContent,
            trackingNumber: disputes.trackingNumber,
            sentAt: disputes.sentAt,
            responseDeadline: disputes.responseDeadline,
            responseReceivedAt: disputes.responseReceivedAt,
            outcome: disputes.outcome,
            responseNotes: disputes.responseNotes,
            creditorName: disputes.creditorName,
            accountNumber: disputes.accountNumber,
            createdAt: disputes.createdAt,
            updatedAt: disputes.updatedAt,
          },
          client: {
            firstName: clients.firstName,
            lastName: clients.lastName,
          },
        })
        .from(disputes)
        .leftJoin(clients, eq(disputes.clientId, clients.id));

      const fallbackConditions = [];
      if (clientId) fallbackConditions.push(eq(disputes.clientId, clientId));
      if (status) fallbackConditions.push(eq(disputes.status, status));
      if (bureau) fallbackConditions.push(eq(disputes.bureau, bureau));
      if (round) fallbackConditions.push(eq(disputes.round, parseInt(round)));
      if (outcome) fallbackConditions.push(eq(disputes.outcome, outcome));
      if (awaitingResponse === 'true') fallbackConditions.push(eq(disputes.status, 'sent'));

      if (fallbackConditions.length > 0) {
        fallbackQuery = fallbackQuery.where(and(...fallbackConditions)) as typeof fallbackQuery;
      }

      results = await fallbackQuery;
    }

    // Filter overdue in JS (deadline passed, no response)
    let filteredResults = results;
    if (overdue === 'true') {
      const now = new Date();
      filteredResults = results.filter(r => {
        const deadline = r.dispute.responseDeadline;
        return deadline && deadline < now && !r.dispute.responseReceivedAt;
      });
    }

    // Sort by response deadline (urgent first), then by created date
    filteredResults.sort((a, b) => {
      // Prioritize items with deadlines
      if (a.dispute.responseDeadline && !b.dispute.responseDeadline) return -1;
      if (!a.dispute.responseDeadline && b.dispute.responseDeadline) return 1;
      
      // Sort by deadline if both have one
      if (a.dispute.responseDeadline && b.dispute.responseDeadline) {
        return a.dispute.responseDeadline.getTime() - b.dispute.responseDeadline.getTime();
      }
      
      // Fall back to created date
      return (b.dispute.createdAt?.getTime() || 0) - (a.dispute.createdAt?.getTime() || 0);
    });

    return NextResponse.json({
      disputes: filteredResults.map(({ dispute: d, client: c }) => {
        return {
          id: d.id,
          client_id: d.clientId,
          client_name: safeDecryptClientName(c),
          negative_item_id: d.negativeItemId,
          bureau: d.bureau,
          dispute_reason: d.disputeReason,
          dispute_type: d.disputeType,
          status: d.status,
          round: d.round,
          letter_content: d.letterContent,
          tracking_number: d.trackingNumber,
          sent_at: d.sentAt?.toISOString(),
          response_deadline: d.responseDeadline?.toISOString(),
          response_received_at: d.responseReceivedAt?.toISOString(),
          outcome: d.outcome,
          response_notes: d.responseNotes,
          response_document_url: d.responseDocumentUrl || null,
          response_channel: d.responseChannel || null,
          score_impact: d.scoreImpact ?? null,
          reason_codes: d.reasonCodes || null,
          analysis_confidence: d.analysisConfidence ?? null,
          auto_selected: d.autoSelected ?? null,
          creditor_name: safeDecryptCreditorName(d.creditorName),
          account_number: d.accountNumber,
          created_at: d.createdAt?.toISOString(),
          updated_at: d.updatedAt?.toISOString(),
        };
      }),
      total: filteredResults.length,
    });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.disputes.error', error: error });
    return NextResponse.json(
      { error: 'Failed to fetch disputes' },
      { status: 500 }
    );
  }
}

// Export rate-limited handlers
export const POST = rateLimited(sensitiveLimiter)(postHandler);
export const GET = rateLimited(sensitiveLimiter)(getHandler);
