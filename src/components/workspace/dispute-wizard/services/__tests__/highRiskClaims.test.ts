import { describe, expect, it } from 'vitest';
import { HighRiskConfirmationRequiredError, claimBlockerText, highRiskClaimTargets } from '../highRiskClaims';
import type { InquiryItem, NegativeItem } from '../../types';
import type { LetterGenerationBuilderInput } from '../../types/letter-generation';

const tradeline: NegativeItem = {
  id: 'neg-1',
  creditor_name: 'Bank One',
  original_creditor: null,
  item_type: 'collection',
  amount: 500,
  date_reported: '2026-01-01',
  bureau: 'combined',
  on_transunion: true,
  on_experian: true,
  on_equifax: false,
  risk_severity: 'high',
  recommended_action: 'dispute',
};

const inquiry: InquiryItem = { id: 'inq-1', creditor_name: 'Inquiry Bank', bureau: 'equifax', is_past_fcra_limit: false };
const oldInquiry: InquiryItem = { id: 'inq-2', creditor_name: 'Old Bank', bureau: 'equifax', is_past_fcra_limit: true };

function input(overrides: Partial<LetterGenerationBuilderInput> = {}): LetterGenerationBuilderInput {
  return {
    selectedClientId: 'client-1',
    negativeItems: [tradeline],
    selectedItems: ['neg-1'],
    personalInfoItems: [],
    selectedPersonalItems: [],
    inquiryItems: [inquiry, oldInquiry],
    selectedInquiryItems: ['inq-1', 'inq-2'],
    generationMethod: 'template',
    selectedReasonCodes: [],
    effectiveAnalyses: [],
    effectiveSummary: null,
    selectedMethodology: 'factual',
    selectedBureaus: ['transunion', 'experian', 'equifax'],
    targetRecipient: 'bureau',
    selectedDisputeType: 'standard',
    disputeRound: 1,
    customReason: '',
    combineItemsPerBureau: true,
    selectedEvidenceIds: [],
    requestManualReview: false,
    getInstructionText: () => '',
    hasItemInstruction: () => false,
    getItemReasonCode: () => 'not_mine',
    itemAppearsOnBureau: () => true,
    ...overrides,
  };
}

describe('highRiskClaimTargets', () => {
  it('lists one claim per selected item and high-risk code, and skips ordinary items', () => {
    expect(highRiskClaimTargets(input())).toEqual([
      { key: 'tradeline:neg-1:not_mine', itemKind: 'tradeline', itemId: 'neg-1', itemLabel: 'Bank One', bureau: 'transunion,experian', claimType: 'not_mine' },
      { key: 'inquiry:inq-1:unauthorized_inquiry', itemKind: 'inquiry', itemId: 'inq-1', itemLabel: 'Inquiry Bank', bureau: 'equifax', claimType: 'unauthorized_inquiry' },
    ]);
  });
});

describe('claimBlockerText', () => {
  it('says what blocks each claim in plain words', () => {
    const [target] = highRiskClaimTargets(input());
    expect(claimBlockerText({ ...target, confirmation: { state: 'missing_documents', packetId: 'p' } }))
      .toBe('Bank One (TransUnion, Experian), Not my account: the confirmation request has no supporting documents');
    expect(claimBlockerText({ ...target, confirmation: { state: 'none' }, loading: true }))
      .toBe('Bank One (TransUnion, Experian), Not my account: checking whether the client has confirmed');
  });
});

describe('HighRiskConfirmationRequiredError.fromResponse', () => {
  const items = [{ id: 'inq-1', kind: 'inquiry' as const, creditorName: 'Inquiry Bank', bureau: 'equifax' }];

  it('turns the route 409 per-item blockers into a plain message', () => {
    const error = HighRiskConfirmationRequiredError.fromResponse(409, {
      code: 'HIGH_RISK_CONFIRMATION_REQUIRED',
      items: [{ itemId: 'inq-1', itemKind: 'inquiry', claimType: 'unauthorized_inquiry', state: 'awaiting_client_confirmation' }],
    }, items);

    expect(error?.blockers).toHaveLength(1);
    expect(error?.message).toBe('Client confirmation is needed. Inquiry Bank (Equifax), Unauthorized inquiry: waiting for the client to confirm in their portal.');
  });

  it('ignores any other refusal', () => {
    expect(HighRiskConfirmationRequiredError.fromResponse(400, { code: 'HIGH_RISK_CONFIRMATION_REQUIRED', items: [] }, items)).toBeNull();
    expect(HighRiskConfirmationRequiredError.fromResponse(409, { error: 'Conflict' }, items)).toBeNull();
  });
});
