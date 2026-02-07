import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clients, negativeItems, clientDocuments } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { generateUniqueDisputeLetter, generateMultiItemDisputeLetter, DISPUTE_REASON_CODES } from '@/lib/ai-letter-generator';
import { DOCUMENT_TYPE_LABELS } from '@/lib/dispute-evidence';
import { getAdminSessionUser } from '@/lib/admin-session';
import { evaluateDisputeCompliance } from '@/lib/dispute-compliance-policy';

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
  return getAdminSessionUser('super_admin');
}

export async function POST(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
                accountNumber: item.id?.slice(-8),
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
      });

      return NextResponse.json({
        letter_content: letterContent,
        client_name: `${client.firstName} ${client.lastName}`,
        bureau: bureau,
        round: round || 1,
        dispute_type: disputeType || 'standard',
        reason_codes: reasonCodes,
        item_count: validItems.length,
        item_ids: validItems.map((i: DisputeItemPayload) => i.id),
        combined: true,
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
          accountNumber: item.id?.slice(-8),
          itemType: item.itemType,
          amount: item.amount,
          dateReported: item.dateReported?.toISOString(),
          riskSeverity: item.riskSeverity,
        };
      }
    }

    // Generate the letter using AI
    const payloadData = mapPayloadToItemData(itemPayload || body);

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
    });

    return NextResponse.json({
      letter_content: letterContent,
      client_name: `${client.firstName} ${client.lastName}`,
      bureau: bureau,
      round: round || 1,
      dispute_type: disputeType || 'standard',
      reason_codes: reasonCodes,
      combined: false,
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
