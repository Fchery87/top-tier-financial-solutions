import { describe, expect, it } from 'vitest';
import { buildLetterGenerationPayload } from '../buildLetterGenerationPayload';
import type { AIAnalysisResult, AIAnalysisSummary, InquiryItem, NegativeItem, PersonalInfoItem } from '../../types';
import type { LetterGenerationBuilderInput } from '../../types/letter-generation';

const tradeline: NegativeItem = {
  id: 'neg-1',
  creditor_name: 'Bank One',
  original_creditor: 'Original Bank',
  account_number: '1234',
  item_type: 'collection',
  amount: 500,
  date_reported: '2026-01-01',
  bureau: 'combined',
  bureaus: ['transunion', 'experian'],
  on_transunion: true,
  on_experian: true,
  on_equifax: false,
  risk_severity: 'high',
  recommended_action: 'dispute',
};

const personalItem: PersonalInfoItem = {
  id: 'pi-1',
  bureau: 'experian',
  type: 'old_address',
  value: '123 Old St',
};

const inquiry: InquiryItem = {
  id: 'inq-1',
  creditor_name: 'Inquiry Bank',
  bureau: 'equifax',
  inquiry_date: '2025-01-01',
  inquiry_type: 'hard',
  is_past_fcra_limit: true,
  days_since_inquiry: 800,
};

const analysis: AIAnalysisResult = {
  itemId: 'neg-1',
  creditorName: 'Bank One',
  itemType: 'collection',
  suggestedMethodology: 'factual',
  autoReasonCodes: ['metro2_violation'],
  metro2Violations: ['Missing DOFD'],
  fcraIssues: ['607b'],
  confidence: 0.9,
  analysisNotes: 'notes',
};

const summary: AIAnalysisSummary = {
  itemCount: 1,
  recommendedMethodology: 'method_of_verification',
  allReasonCodes: ['metro2_violation'],
  allMetro2Violations: ['Missing DOFD', 'Bad status'],
  allFcraIssues: ['607b'],
  averageConfidence: 0.9,
  analysisNotes: 'summary',
};

function baseInput(overrides: Partial<LetterGenerationBuilderInput> = {}): LetterGenerationBuilderInput {
  return {
    selectedClientId: 'client-1',
    negativeItems: [tradeline],
    selectedItems: ['neg-1'],
    personalInfoItems: [],
    selectedPersonalItems: [],
    inquiryItems: [],
    selectedInquiryItems: [],
    generationMethod: 'ai',
    selectedReasonCodes: ['verification_required'],
    effectiveAnalyses: [analysis],
    effectiveSummary: summary,
    selectedMethodology: 'factual',
    selectedBureaus: ['transunion', 'experian', 'equifax'],
    targetRecipient: 'bureau',
    selectedDisputeType: 'standard',
    disputeRound: 2,
    customReason: '',
    combineItemsPerBureau: true,
    selectedEvidenceIds: ['doc-1'],
    requestManualReview: true,
    getInstructionText: itemId => `Instruction for ${itemId}`,
    hasItemInstruction: itemId => itemId === 'neg-1',
    itemAppearsOnBureau: (item, bureau) => {
      if (bureau === 'transunion') return item.on_transunion === true;
      if (bureau === 'experian') return item.on_experian === true;
      if (bureau === 'equifax') return item.on_equifax === true;
      return false;
    },
    ...overrides,
  };
}

describe('buildLetterGenerationPayload', () => {
  it('builds combined bureau requests only for bureaus where selected tradelines appear', () => {
    const plan = buildLetterGenerationPayload(baseInput());

    expect(plan.methodologyToUse).toBe('method_of_verification');
    expect(plan.reasonCodesToUse).toEqual(['metro2_violation']);
    expect(plan.requests).toHaveLength(2);
    expect(plan.requests.map(request => request.bureau)).toEqual(['transunion', 'experian']);
    expect(plan.requests[0].body).toMatchObject({
      clientId: 'client-1',
      bureau: 'transunion',
      combineItems: true,
      methodology: 'method_of_verification',
      reasonCodes: ['metro2_violation'],
      metro2Violations: ['Missing DOFD', 'Bad status'],
      evidenceDocumentIds: ['doc-1'],
      requestManualReview: true,
    });
    expect(plan.requests[0].items[0]).toMatchObject({
      id: 'neg-1',
      kind: 'tradeline',
      creditorName: 'Bank One',
      originalCreditor: 'Original Bank',
      accountNumber: '1234',
      itemType: 'collection',
      amount: 500,
      riskSeverity: 'high',
    });
  });

  it('adds deterministic reason codes for personal information and obsolete inquiries', () => {
    const plan = buildLetterGenerationPayload(baseInput({
      negativeItems: [],
      selectedItems: [],
      personalInfoItems: [personalItem],
      selectedPersonalItems: ['pi-1'],
      inquiryItems: [inquiry],
      selectedInquiryItems: ['inq-1'],
      selectedBureaus: ['experian', 'equifax'],
      effectiveSummary: { ...summary, allReasonCodes: [] },
    }));

    expect(plan.reasonCodesToUse).toEqual(['verification_required', 'inaccurate_reporting', 'obsolete']);
    expect(plan.requests.map(request => request.bureau)).toEqual(['experian', 'equifax']);
    expect(plan.requests[0].items[0]).toMatchObject({
      id: 'pi-1',
      kind: 'personal',
      itemType: 'personal_info_old_address',
      value: '123 Old St',
    });
    expect(plan.requests[1].items[0]).toMatchObject({
      id: 'inq-1',
      kind: 'inquiry',
      creditorName: 'Inquiry Bank',
      isPastFcraLimit: true,
    });
  });

  it('builds per-item direct-recipient requests with item bureau fallback and analysis-specific violations', () => {
    const plan = buildLetterGenerationPayload(baseInput({
      combineItemsPerBureau: false,
      targetRecipient: 'creditor',
      customReason: 'custom direct reason',
    }));

    expect(plan.requests).toHaveLength(1);
    expect(plan.requests[0]).toMatchObject({
      combined: false,
      itemKind: 'tradeline',
      itemId: 'neg-1',
    });
    expect(plan.requests[0].body).toMatchObject({
      bureau: 'combined',
      targetRecipient: 'creditor',
      customReason: 'custom direct reason',
      disputeInstruction: 'custom direct reason',
      creditorName: 'Bank One',
      itemType: 'collection',
      amount: 500,
      metro2Violations: ['Missing DOFD'],
    });
  });

  it('uses template instructions and selected methodology for template generation', () => {
    const plan = buildLetterGenerationPayload(baseInput({
      generationMethod: 'template',
      selectedMethodology: 'debt_validation',
      combineItemsPerBureau: false,
    }));

    expect(plan.reasonCodesToUse).toEqual([]);
    expect(plan.methodologyToUse).toBe('debt_validation');
    expect(plan.requests[0].body).toMatchObject({
      customReason: 'Instruction for neg-1',
      disputeInstruction: 'Instruction for neg-1',
      methodology: 'debt_validation',
      metro2Violations: undefined,
    });
  });

  it('returns no requests when no selected dispute items exist', () => {
    const plan = buildLetterGenerationPayload(baseInput({
      negativeItems: [],
      selectedItems: [],
      effectiveSummary: null,
    }));

    expect(plan.selectedDisputeItems).toEqual([]);
    expect(plan.requests).toEqual([]);
    expect(plan.methodologyToUse).toBe('factual');
  });
});
