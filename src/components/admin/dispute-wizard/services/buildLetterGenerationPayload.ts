import type { AIAnalysisSummary, DisputeItemPayload, InquiryItem, NegativeItem, PersonalInfoItem } from '../types';
import type {
  LetterGenerationBuilderInput,
  LetterGenerationPayloadPlan,
  SelectedDisputeItemEntry,
} from '../types/letter-generation';

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

function buildSelectedDisputeItems(input: LetterGenerationBuilderInput): SelectedDisputeItemEntry[] {
  const selectedTradelines = input.negativeItems.filter(item => input.selectedItems.includes(item.id));
  const selectedPersonal = input.personalInfoItems.filter(item => input.selectedPersonalItems.includes(item.id));
  const selectedInquiries = input.inquiryItems.filter(item => input.selectedInquiryItems.includes(item.id));

  return [
    ...selectedTradelines.map(item => ({ kind: 'tradeline' as const, raw: item, payload: toTradelinePayload(item) })),
    ...selectedPersonal.map(item => ({ kind: 'personal' as const, raw: item, payload: toPersonalPayload(item) })),
    ...selectedInquiries.map(item => ({ kind: 'inquiry' as const, raw: item, payload: toInquiryPayload(item) })),
  ];
}

function buildReasonCodes(input: LetterGenerationBuilderInput): string[] {
  if (input.generationMethod !== 'ai') return [];

  const reasonCodeSet = new Set(input.effectiveSummary?.allReasonCodes || ['verification_required', 'inaccurate_reporting']);
  const hasSelectedPersonal = input.personalInfoItems.some(item => input.selectedPersonalItems.includes(item.id));
  const selectedInquiries = input.inquiryItems.filter(item => input.selectedInquiryItems.includes(item.id));

  if (hasSelectedPersonal) {
    reasonCodeSet.add('verification_required');
    reasonCodeSet.add('inaccurate_reporting');
  }

  if (selectedInquiries.length > 0) {
    reasonCodeSet.add(selectedInquiries.some(item => item.is_past_fcra_limit) ? 'obsolete' : 'unauthorized_inquiry');
    reasonCodeSet.add('verification_required');
  }

  return Array.from(reasonCodeSet);
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

export function buildLetterGenerationPayload(input: LetterGenerationBuilderInput): LetterGenerationPayloadPlan {
  const selectedDisputeItems = buildSelectedDisputeItems(input);
  const reasonCodesToUse = buildReasonCodes(input);
  const methodologyToUse = methodology(input, input.effectiveSummary);
  const bureausToUse = input.targetRecipient === 'bureau' ? input.selectedBureaus : ['direct'];
  const perItemInstructions = buildPerItemInstructions(input);
  const perItemInstructionsOrUndefined = input.generationMethod === 'template' ? perItemInstructions : undefined;
  const evidenceIds = evidenceDocumentIds(input);

  if (selectedDisputeItems.length === 0) {
    return { selectedDisputeItems, reasonCodesToUse, methodologyToUse, requests: [] };
  }

  if (input.combineItemsPerBureau && input.targetRecipient === 'bureau') {
    const bureausWithItems = bureausToUse.filter(bureau => selectedDisputeItems.some(entry => itemAppliesToBureau(input, entry, bureau)));
    const requests = bureausWithItems.map(bureau => {
      const itemsForThisBureau = selectedDisputeItems.filter(entry => itemAppliesToBureau(input, entry, bureau)).map(entry => entry.payload);
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
          reasonCodes: reasonCodesToUse,
          customReason: input.customReason || undefined,
          combineItems: true,
          methodology: methodologyToUse,
          perItemInstructions: perItemInstructionsOrUndefined,
          metro2Violations: input.generationMethod === 'ai' ? input.effectiveSummary?.allMetro2Violations : undefined,
          evidenceDocumentIds: evidenceIds,
          requestManualReview: input.requestManualReview,
        },
      };
    });
    return { selectedDisputeItems, reasonCodesToUse, methodologyToUse, requests };
  }

  const itemBureauPairs = selectedDisputeItems.flatMap(entry => {
    if (input.targetRecipient !== 'bureau') return [{ entry, bureau: entry.payload.bureau || 'transunion' }];
    return bureausToUse.filter(bureau => itemAppliesToBureau(input, entry, bureau)).map(bureau => ({ entry, bureau }));
  });

  const requests = itemBureauPairs.map(({ entry, bureau }) => {
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
        reasonCodes: reasonCodesToUse,
        customReason: itemInstruction || undefined,
        creditorName: entry.payload.creditorName,
        itemType: entry.payload.itemType,
        amount: entry.payload.amount,
        methodology: methodologyToUse,
        disputeInstruction: itemInstruction,
        metro2Violations: input.generationMethod === 'ai' && entry.kind === 'tradeline'
          ? input.effectiveAnalyses.find(analysis => analysis.itemId === entry.payload.id)?.metro2Violations
          : undefined,
        evidenceDocumentIds: evidenceIds,
        requestManualReview: input.requestManualReview,
      },
    };
  });

  return { selectedDisputeItems, reasonCodesToUse, methodologyToUse, requests };
}
