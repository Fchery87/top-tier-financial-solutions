import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clients, negativeItems, clientDocuments } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { generateUniqueDisputeLetter, generateMultiItemDisputeLetter, DISPUTE_REASON_CODES } from '@/lib/ai-letter-generator';
import { selectLibraryForGeneration } from '@/lib/letter-generation-library';
import { requireLatestApprovedReportForClient } from '@/lib/parser-review-gate';
import { DOCUMENT_TYPE_LABELS } from '@/lib/dispute-evidence';
import { requireCapability } from '@/lib/admin-session';
import { evaluateDisputeCompliance } from '@/lib/dispute-compliance-policy';
import { approvedPolicyMatchesDisputeInputs } from '@/lib/dispute-policy-decision';
import { persistGeneratedDisputeDraft, type DraftItemSnapshotInput } from '@/lib/dispute-draft-generator';
import { decideEscalation, loadDisputeChain } from '@/lib/dispute-escalation-decision';
import { findAwaitingClientConfirmation } from '@/lib/dispute-evidence';

type DisputeItemKind = 'tradeline' | 'personal' | 'inquiry';

interface DisputeItemPayload {
  id: string;
  kind?: DisputeItemKind;
  bureau?: string | null;
  creditorName?: string;
  originalCreditor?: string | null;
  accountNumber?: string | null;
  itemType?: string;
  amount?: number | null;
  value?: string | null;
  inquiryDate?: string | null;
  dateReported?: string | null;
  riskSeverity?: string | null;
}

async function validateAdmin() {
  return requireCapability('disputes:write');
}

export async function POST(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      clientId,
      negativeItemId,
      negativeItemIds, // Support for multiple items
      disputeItems, // New: generic dispute item payloads
      bureau,
      disputeType,
      round,
      targetRecipient,
      reasonCodes,
      customReason,
      combineItems, // Flag to indicate combined letter mode
      methodology, // NEW: Dispute methodology (factual, metro2_compliance, etc.)
      metro2Violations, // NEW: Specific Metro 2 field violations
      priorDisputeDate, // NEW: For method of verification letters
      priorDisputeResult, // NEW: Result of prior dispute
      evidenceDocumentIds, // Optional: evidence attachments (clientDocuments IDs)
      clientConfirmedOwnershipClaims,
      policyDecision,
      priorDisputeId,
    } = body;

    if (!clientId || !bureau) {
      return NextResponse.json(
        { error: 'Client ID and bureau are required' },
        { status: 400 }
      );
    }

    if (!reasonCodes || reasonCodes.length === 0) {
      return NextResponse.json(
        { error: 'At least one reason code is required' },
        { status: 400 }
      );
    }

    if (!policyDecision?.approved) {
      return NextResponse.json(
        { error: 'Approved policy decision is required before letter generation' },
        { status: 400 }
      );
    }

    if (!approvedPolicyMatchesDisputeInputs({
      policyDecision,
      reasonCodes,
      evidenceDocumentIds,
      clientConfirmedOwnershipClaims,
    })) {
      return NextResponse.json(
        { error: 'Approved policy decision does not match requested dispute inputs' },
        { status: 400 }
      );
    }

    const compliance = evaluateDisputeCompliance({
      reasonCodes,
      evidenceDocumentIds,
      clientConfirmedOwnershipClaims,
    });

    if (!compliance.isCompliant) {
      return NextResponse.json(
        { error: 'Dispute failed compliance checks', violations: compliance.violations },
        { status: 400 }
      );
    }

    if (targetRecipient === 'cfpb') {
      const requestedItemIds = [
        ...(Array.isArray(disputeItems) ? disputeItems.map(item => item?.id) : []),
        ...(Array.isArray(negativeItemIds) ? negativeItemIds : []),
        typeof negativeItemId === 'string' ? negativeItemId : null,
      ].filter((itemId): itemId is string => typeof itemId === 'string' && itemId.length > 0);
      const uniqueRequestedItemIds = [...new Set(requestedItemIds)];
      if (uniqueRequestedItemIds.length !== 1) {
        return NextResponse.json({ error: 'CFPB generation requires exactly one item per eligible CRA predecessor' }, { status: 400 });
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
          reasonCodes,
          customReason: customReason || 'CFPB complaint packet',
        },
      });
      if (decision.kind === 'blocked') {
        return NextResponse.json({ error: decision.message, reason: decision.eligibility.reason, eligible_at: decision.eligibility.eligibleAt?.toISOString() || null }, { status: 409 });
      }
      if (history[0]?.clientId !== clientId) {
        return NextResponse.json({ error: 'The prior CRA dispute does not belong to this client' }, { status: 409 });
      }
      const craDispute = history.find(entry => entry.targetRecipient === 'bureau' && entry.sentAt !== null);
      if (
        !craDispute
        || craDispute.clientId !== clientId
        || craDispute.negativeItemId !== uniqueRequestedItemIds[0]
      ) {
        return NextResponse.json({ error: 'The prior CRA dispute does not match the selected item' }, { status: 409 });
      }
    }

    const confirmationDisputeId = [body.disputeId, body.dispute_id, priorDisputeId].find(
      (value): value is string => typeof value === 'string' && value.trim().length > 0,
    );
    if (confirmationDisputeId) {
      const awaitingConfirmation = await findAwaitingClientConfirmation(confirmationDisputeId);
      if (awaitingConfirmation) {
        return NextResponse.json({ error: 'High-risk evidence packet is awaiting client confirmation' }, { status: 409 });
      }
    }

    const reportGate = await requireLatestApprovedReportForClient(clientId);
    if (!reportGate.allowed) {
      return NextResponse.json(
        { error: reportGate.reason || 'The latest credit report must be approved before letter generation.' },
        { status: 409 }
      );
    }

    // Get client info
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Fetch evidence documents if provided to build enclosures list
    let enclosures: { documentType: string; documentName: string }[] = [];
    if (evidenceDocumentIds && evidenceDocumentIds.length > 0) {
      const evidenceDocs = await db
        .select()
        .from(clientDocuments)
        .where(inArray(clientDocuments.id, evidenceDocumentIds));
      
      enclosures = evidenceDocs.map(doc => ({
        documentType: doc.fileType || 'other',
        documentName: DOCUMENT_TYPE_LABELS[doc.fileType as keyof typeof DOCUMENT_TYPE_LABELS] || doc.fileName,
      }));
    }

    const mapPayloadToItemData = (payload?: DisputeItemPayload | null) => ({
      creditorName: payload?.creditorName || (payload?.kind === 'personal' ? 'Personal Information' : payload?.kind === 'inquiry' ? 'Inquiry' : 'Unknown Creditor'),
      originalCreditor: payload?.originalCreditor || undefined,
      accountNumber: payload?.accountNumber || (payload?.kind === 'personal' ? payload?.value : undefined) || undefined,
      itemType: payload?.itemType || 'unknown',
      amount: payload?.amount || undefined,
      dateReported: payload?.dateReported || payload?.inquiryDate || undefined,
      bureau: payload?.bureau || bureau,
    });

    const mapPayloadToSnapshot = (payload: DisputeItemPayload): DraftItemSnapshotInput => ({
      kind: payload.kind || 'tradeline',
      bureau: payload.bureau || bureau,
      creditorName: payload.creditorName,
      originalCreditor: payload.originalCreditor,
      accountNumber: payload.accountNumber || payload.value,
      itemType: payload.itemType,
      amount: payload.amount,
      dateReported: payload.dateReported,
      inquiryDate: payload.inquiryDate,
    });

    // Handle multi-item combined letter
    if (combineItems && ((disputeItems && disputeItems.length > 0) || (negativeItemIds && negativeItemIds.length > 0))) {
      // Use provided dispute items if available, otherwise fetch legacy negative items
      const itemPayloads: DisputeItemPayload[] = disputeItems && disputeItems.length > 0
        ? disputeItems
        : (await Promise.all(
            (negativeItemIds || []).map(async (itemId: string) => {
              const [item] = await db
                .select()
                .from(negativeItems)
                .where(eq(negativeItems.id, itemId))
                .limit(1);
              if (!item) return null;
              return {
                id: item.id,
                kind: 'tradeline',
                bureau: bureau,
                creditorName: item.creditorName,
                originalCreditor: item.originalCreditor,
                accountNumber: item.id?.slice(-4),
                itemType: item.itemType,
                amount: item.amount,
                dateReported: item.dateReported?.toISOString(),
                riskSeverity: item.riskSeverity,
              } satisfies DisputeItemPayload;
            })
          )).filter(Boolean) as DisputeItemPayload[];

      const validItems = itemPayloads.filter(Boolean) as DisputeItemPayload[];

      if (validItems.length === 0) {
        return NextResponse.json({ error: 'No valid items found' }, { status: 400 });
      }

      // Generate combined letter
      const combinedSelection = await selectLibraryForGeneration({
        round: round || 1,
        targetRecipient: targetRecipient || 'bureau',
        bureau,
        itemType: validItems[0]?.itemType || 'unknown',
        reasonCodes,
        methodology: methodology || undefined,
      });
      const letterContent = await generateMultiItemDisputeLetter({
        disputeType: disputeType || 'standard',
        round: round || 1,
        targetRecipient: targetRecipient || 'bureau',
        clientData: {
          name: `${client.firstName} ${client.lastName}`,
          address: undefined,
          city: undefined,
          state: undefined,
          zip: undefined,
        },
        items: validItems.map(item => ({
          ...mapPayloadToItemData(item),
        })),
        bureau: bureau,
        reasonCodes: reasonCodes,
        customReason: customReason,
        methodology: methodology,
        metro2Violations: metro2Violations,
        enclosures: enclosures,
        librarySelection: combinedSelection,
      });

      const persistedDraft = await persistGeneratedDisputeDraft({
        clientId,
        bureau,
        negativeItemId: validItems.length === 1 && validItems[0]?.kind === 'tradeline' ? validItems[0].id : null,
        disputeReason: reasonCodes.join(', '),
        disputeType: disputeType || 'standard',
        round: round || 1,
        reasonCodes,
        policyDecision,
        escalationPath: targetRecipient || 'bureau',
        priorDisputeId: priorDisputeId || null,
        methodology: methodology || null,
        letterContent,
        generatedByAi: true,
        creditorName: validItems.length === 1 ? validItems[0]?.creditorName : null,
        accountNumber: validItems.length === 1 ? validItems[0]?.accountNumber : null,
        items: validItems.map(mapPayloadToSnapshot),
        selection: combinedSelection,
        actorUserId: adminUser.id,
      });

      return NextResponse.json({
        dispute_id: persistedDraft.disputeId,
        revision: persistedDraft.revision,
        letter_content: letterContent,
        client_name: `${client.firstName} ${client.lastName}`,
        bureau: bureau,
        round: round || 1,
        dispute_type: disputeType || 'standard',
        reason_codes: reasonCodes,
        item_count: validItems.length,
        item_ids: validItems.map((i: DisputeItemPayload) => i.id),
        combined: true,
        library_selection: combinedSelection,
      });
    }

    // Single item letter (original behavior)
    let itemPayload: DisputeItemPayload | null = null;
    if (disputeItems && disputeItems.length > 0) {
      itemPayload = disputeItems[0];
    } else if (negativeItemId) {
      const [item] = await db
        .select()
        .from(negativeItems)
        .where(eq(negativeItems.id, negativeItemId))
        .limit(1);
      if (item) {
        itemPayload = {
          id: item.id,
          kind: 'tradeline',
          bureau: bureau,
          creditorName: item.creditorName,
          originalCreditor: item.originalCreditor,
          accountNumber: item.id?.slice(-4),
          itemType: item.itemType,
          amount: item.amount,
          dateReported: item.dateReported?.toISOString(),
          riskSeverity: item.riskSeverity,
        };
      }
    }

    // Generate the letter using AI
    const payloadData = mapPayloadToItemData(itemPayload || body);
    const selection = await selectLibraryForGeneration({
      round: round || 1,
      targetRecipient: targetRecipient || 'bureau',
      bureau,
      itemType: payloadData.itemType,
      reasonCodes,
      methodology: methodology || undefined,
    });

    const letterContent = await generateUniqueDisputeLetter({
      disputeType: disputeType || 'standard',
      round: round || 1,
      targetRecipient: targetRecipient || 'bureau',
      methodology: methodology,
      metro2Violations: metro2Violations,
      priorDisputeDate: priorDisputeDate,
      priorDisputeResult: priorDisputeResult,
      enclosures: enclosures,
      clientData: {
        name: `${client.firstName} ${client.lastName}`,
        address: undefined,
        city: undefined,
        state: undefined,
        zip: undefined,
      },
      itemData: {
        creditorName: payloadData.creditorName,
        originalCreditor: payloadData.originalCreditor,
        accountNumber: payloadData.accountNumber,
        itemType: payloadData.itemType,
        amount: payloadData.amount,
        dateReported: payloadData.dateReported,
        bureau: bureau,
      },
      reasonCodes: reasonCodes,
      customReason: customReason,
      librarySelection: selection,
    });

    const snapshotItem: DisputeItemPayload = itemPayload || {
      id: negativeItemId || 'generated-item',
      kind: 'tradeline',
      bureau,
      creditorName: payloadData.creditorName,
      originalCreditor: payloadData.originalCreditor,
      accountNumber: payloadData.accountNumber,
      itemType: payloadData.itemType,
      amount: payloadData.amount,
      dateReported: payloadData.dateReported,
    };
    const persistedDraft = await persistGeneratedDisputeDraft({
      clientId,
      bureau,
      negativeItemId: snapshotItem.kind === 'tradeline' ? negativeItemId || snapshotItem.id : null,
      disputeReason: reasonCodes.join(', '),
      disputeType: disputeType || 'standard',
      round: round || 1,
      reasonCodes,
      policyDecision,
      escalationPath: targetRecipient || 'bureau',
      priorDisputeId: priorDisputeId || null,
      methodology: methodology || null,
      letterContent,
      generatedByAi: true,
      creditorName: payloadData.creditorName,
      accountNumber: payloadData.accountNumber,
      items: [mapPayloadToSnapshot(snapshotItem)],
      selection,
      actorUserId: adminUser.id,
    });

    return NextResponse.json({
      dispute_id: persistedDraft.disputeId,
      revision: persistedDraft.revision,
      letter_content: letterContent,
      client_name: `${client.firstName} ${client.lastName}`,
      bureau: bureau,
      round: round || 1,
      dispute_type: disputeType || 'standard',
      reason_codes: reasonCodes,
      combined: false,
      library_selection: selection,
    });
  } catch (error) {
    console.error('Error generating dispute letter:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate letter' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Return available reason codes
  return NextResponse.json({
    reason_codes: DISPUTE_REASON_CODES,
    dispute_types: [
      { code: 'standard', label: 'Standard Bureau Dispute' },
      { code: 'method_of_verification', label: 'Method of Verification' },
      { code: 'direct_creditor', label: 'Direct to Creditor' },
      { code: 'debt_validation', label: 'Debt Validation' },
      { code: 'goodwill', label: 'Goodwill Request' },
      { code: 'cease_desist', label: 'Cease and Desist' },
    ],
    target_recipients: [
      { code: 'bureau', label: 'Credit Bureau' },
      { code: 'creditor', label: 'Creditor/Furnisher' },
      { code: 'collector', label: 'Collection Agency' },
    ],
  });
}
