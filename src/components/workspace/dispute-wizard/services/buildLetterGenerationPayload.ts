import { isHighRiskClaimType } from '@/lib/high-risk-claim-registry';
import type { AIAnalysisSummary, DisputeItemKind, DisputeItemPayload, InquiryItem, NegativeItem, PersonalInfoItem } from '../types';
import type {
  LetterGenerationBuilderInput,
  LetterGenerationPayloadPlan,
  LetterGenerationRequestPlan,
  SelectedDisputeItemEntry,
} from '../types/letter-generation';

/** How the wizard names one selected item across tables: `tradeline:<id>`, `inquiry:<id>`, `personal:<id>`. */
export function disputeItemKey(kind: DisputeItemKind, id: string): string {
  return `${kind}:${id}`;
}

function toTradelinePayload(item: NegativeItem): DisputeItemPayload {
  return {
    id: item.id,
    kind: 'tradeline',
    bureau: item.bureau,
    creditorName: item.creditor_name,
    originalCreditor: item.original_creditor,
    accountNumber: item.account_number,
    itemType: item.item_type,
    amount: item.amount,
    riskSeverity: item.risk_severity,
  };
}

function toPersonalPayload(item: PersonalInfoItem): DisputeItemPayload {
  return {
    id: item.id,
    kind: 'personal',
    bureau: item.bureau,
    itemType: `personal_info_${item.type}`,
    value: item.value,
  };
}

function toInquiryPayload(item: InquiryItem): DisputeItemPayload {
  return {
    id: item.id,
    kind: 'inquiry',
    bureau: item.bureau,
    creditorName: item.creditor_name,
    itemType: 'inquiry',
    inquiryDate: item.inquiry_date,
    inquiryType: item.inquiry_type,
    isPastFcraLimit: item.is_past_fcra_limit,
    daysSinceInquiry: item.days_since_inquiry,
  };
}

/** Every item the staff member selected, in tradeline, personal, inquiry order. */
export function buildSelectedDisputeItems(input: LetterGenerationBuilderInput): SelectedDisputeItemEntry[] {
  const selectedTradelines = input.negativeItems.filter(item => input.selectedItems.includes(item.id));
  const selectedPersonal = input.personalInfoItems.filter(item => input.selectedPersonalItems.includes(item.id));
  const selectedInquiries = input.inquiryItems.filter(item => input.selectedInquiryItems.includes(item.id));

  return [
    ...selectedTradelines.map(item => ({ kind: 'tradeline' as const, raw: item, payload: toTradelinePayload(item) })),
    ...selectedPersonal.map(item => ({ kind: 'personal' as const, raw: item, payload: toPersonalPayload(item) })),
    ...selectedInquiries.map(item => ({ kind: 'inquiry' as const, raw: item, payload: toInquiryPayload(item) })),
  ];
}

const PERSONAL_INFO_REASON_CODES = ['verification_required', 'inaccurate_reporting'];

function inquiryReasonCodes(item: InquiryItem): string[] {
  return [item.is_past_fcra_limit ? 'obsolete' : 'unauthorized_inquiry', 'verification_required'];
}

const DEFAULT_TRADELINE_REASON_CODES = ['verification_required', 'inaccurate_reporting'];

/**
 * AI mode: a tradeline carries the codes its own analysis chose. Without an
 * analysis it falls back to the summary's ordinary codes; a summary-level
 * high-risk code never spreads to an item the analysis did not flag.
 */
function aiTradelineReasonCodes(input: LetterGenerationBuilderInput, itemId: string): string[] {
  const analysis = input.effectiveAnalyses.find(result => result.itemId === itemId);
  if (analysis && analysis.autoReasonCodes.length > 0) return analysis.autoReasonCodes;
  const summaryCodes = (input.effectiveSummary?.allReasonCodes ?? []).filter(code => !isHighRiskClaimType(code));
  return summaryCodes.length > 0 ? summaryCodes : DEFAULT_TRADELINE_REASON_CODES;
}

/**
 * The reason codes for one item. Personal-information and inquiry codes follow
 * from the item data. A tradeline's code is the one the staff member chose
 * (template mode) or its own analysis chose (AI mode).
 */
export function entryReasonCodes(input: LetterGenerationBuilderInput, entry: SelectedDisputeItemEntry): string[] {
  if (entry.kind === 'personal') return PERSONAL_INFO_REASON_CODES;
  if (entry.kind === 'inquiry') return inquiryReasonCodes(entry.raw as InquiryItem);
  if (input.generationMethod === 'ai') return aiTradelineReasonCodes(input, entry.payload.id);
  const code = input.getItemReasonCode(entry.payload.id);
  return code ? [code] : [];
}

function reasonCodesForEntries(input: LetterGenerationBuilderInput, entries: SelectedDisputeItemEntry[]): string[] {
  return Array.from(new Set(entries.flatMap(entry => entryReasonCodes(input, entry))));
}

/** True when the item carries a claim that needs the client's own confirmation. */
export function entryHasHighRiskClaim(input: LetterGenerationBuilderInput, entry: SelectedDisputeItemEntry): boolean {
  return entryReasonCodes(input, entry).some(isHighRiskClaimType);
}

function buildPerItemInstructions(input: LetterGenerationBuilderInput): Record<string, string> {
  const perItemInstructions: Record<string, string> = {};
  if (input.generationMethod !== 'template') return perItemInstructions;

  input.selectedItems.forEach(itemId => {
    if (input.hasItemInstruction(itemId)) perItemInstructions[itemId] = input.getInstructionText(itemId);
  });

  return perItemInstructions;
}

function itemAppliesToBureau(input: LetterGenerationBuilderInput, entry: SelectedDisputeItemEntry, bureau: string): boolean {
  if (entry.kind === 'tradeline') return input.itemAppearsOnBureau(entry.raw as NegativeItem, bureau);
  return entry.payload.bureau?.toLowerCase() === bureau.toLowerCase();
}

function evidenceDocumentIds(input: LetterGenerationBuilderInput): string[] | undefined {
  return input.selectedEvidenceIds.length > 0 ? input.selectedEvidenceIds : undefined;
}

function methodology(input: LetterGenerationBuilderInput, summary: AIAnalysisSummary | null): string {
  return input.generationMethod === 'ai' ? (summary?.recommendedMethodology || input.selectedMethodology) : input.selectedMethodology;
}

interface RequestContext {
  methodologyToUse: string;
  bureausToUse: string[];
  perItemInstructions: Record<string, string> | undefined;
  evidenceIds: string[] | undefined;
}

function combinedRequests(
  input: LetterGenerationBuilderInput,
  entries: SelectedDisputeItemEntry[],
  context: RequestContext,
): LetterGenerationRequestPlan[] {
  const bureausWithItems = context.bureausToUse.filter(bureau => entries.some(entry => itemAppliesToBureau(input, entry, bureau)));
  return bureausWithItems.map(bureau => {
    const entriesForThisBureau = entries.filter(entry => itemAppliesToBureau(input, entry, bureau));
    const itemsForThisBureau = entriesForThisBureau.map(entry => entry.payload);
    return {
      key: `combined-${bureau}-${itemsForThisBureau.map(item => item.id).join('-')}`,
      bureau,
      combined: true,
      itemId: itemsForThisBureau[0]?.id || '',
      itemIds: itemsForThisBureau.map(item => item.id),
      items: itemsForThisBureau,
      body: {
        clientId: input.selectedClientId,
        disputeItems: itemsForThisBureau,
        bureau,
        disputeType: input.selectedDisputeType,
        round: input.disputeRound,
        targetRecipient: input.targetRecipient,
        priorDisputeId: input.priorDisputeId || undefined,
        reasonCodes: reasonCodesForEntries(input, entriesForThisBureau),
        customReason: input.customReason || undefined,
        combineItems: true,
        methodology: context.methodologyToUse,
        perItemInstructions: context.perItemInstructions,
        metro2Violations: input.generationMethod === 'ai' ? input.effectiveSummary?.allMetro2Violations : undefined,
        evidenceDocumentIds: context.evidenceIds,
        requestManualReview: input.requestManualReview,
      },
    };
  });
}

function singleRequests(
  input: LetterGenerationBuilderInput,
  entries: SelectedDisputeItemEntry[],
  context: RequestContext,
): LetterGenerationRequestPlan[] {
  const itemBureauPairs = entries.flatMap(entry => {
    if (input.targetRecipient !== 'bureau') return [{ entry, bureau: entry.payload.bureau || 'transunion' }];
    return context.bureausToUse.filter(bureau => itemAppliesToBureau(input, entry, bureau)).map(bureau => ({ entry, bureau }));
  });

  return itemBureauPairs.map(({ entry, bureau }) => {
    const itemInstruction = input.generationMethod === 'template' && entry.kind === 'tradeline'
      ? input.getInstructionText(entry.payload.id)
      : input.customReason || undefined;

    return {
      key: `single-${bureau}-${entry.payload.id}`,
      bureau,
      combined: false,
      itemKind: entry.kind,
      itemId: entry.payload.id,
      items: [entry.payload],
      body: {
        clientId: input.selectedClientId,
        disputeItems: [entry.payload],
        bureau: input.targetRecipient === 'bureau' ? bureau : entry.payload.bureau || 'transunion',
        disputeType: input.selectedDisputeType,
        round: input.disputeRound,
        targetRecipient: input.targetRecipient,
        priorDisputeId: input.priorDisputeId || undefined,
        reasonCodes: entryReasonCodes(input, entry),
        customReason: itemInstruction || undefined,
        creditorName: entry.payload.creditorName,
        itemType: entry.payload.itemType,
        amount: entry.payload.amount,
        methodology: context.methodologyToUse,
        disputeInstruction: itemInstruction,
        metro2Violations: input.generationMethod === 'ai' && entry.kind === 'tradeline'
          ? input.effectiveAnalyses.find(analysis => analysis.itemId === entry.payload.id)?.metro2Violations
          : undefined,
        evidenceDocumentIds: context.evidenceIds,
        requestManualReview: input.requestManualReview,
      },
    };
  });
}

/**
 * Plans one request per letter. Each request carries only its own items'
 * reason codes, because the server applies every code in a request to every
 * item in it. In combine mode an item with a high-risk claim therefore gets
 * its own letter, so a blocked item never blocks the combined one.
 * `excludedItemKeys` leaves out items that cannot be generated yet.
 */
export function buildLetterGenerationPayload(input: LetterGenerationBuilderInput): LetterGenerationPayloadPlan {
  const excluded = input.excludedItemKeys;
  const selectedDisputeItems = buildSelectedDisputeItems(input)
    .filter(entry => !excluded?.has(disputeItemKey(entry.kind, entry.payload.id)));
  const reasonCodesToUse = reasonCodesForEntries(input, selectedDisputeItems);
  const methodologyToUse = methodology(input, input.effectiveSummary);
  const perItemInstructions = buildPerItemInstructions(input);
  const context: RequestContext = {
    methodologyToUse,
    bureausToUse: input.targetRecipient === 'bureau' ? input.selectedBureaus : ['direct'],
    perItemInstructions: input.generationMethod === 'template' ? perItemInstructions : undefined,
    evidenceIds: evidenceDocumentIds(input),
  };

  if (selectedDisputeItems.length === 0) {
    return { selectedDisputeItems, reasonCodesToUse, methodologyToUse, requests: [] };
  }

  if (input.combineItemsPerBureau && input.targetRecipient === 'bureau') {
    const highRisk = selectedDisputeItems.filter(entry => entryHasHighRiskClaim(input, entry));
    const ordinary = selectedDisputeItems.filter(entry => !entryHasHighRiskClaim(input, entry));
    const requests = [
      ...combinedRequests(input, ordinary, context),
      ...singleRequests(input, highRisk, context),
    ];
    return { selectedDisputeItems, reasonCodesToUse, methodologyToUse, requests };
  }

  const requests = singleRequests(input, selectedDisputeItems, context);
  return { selectedDisputeItems, reasonCodesToUse, methodologyToUse, requests };
}
