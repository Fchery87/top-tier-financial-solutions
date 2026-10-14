import { describe, expect, it } from 'vitest';
import {
  getResponseReviewRecommendation,
} from '@/lib/response-review-recommendation';

describe('response-review recommendations', () => {
  it('closes a deleted item without creating a draft', () => {
    expect(getResponseReviewRecommendation({
      outcome: 'deleted',
      currentRound: 1,
      bureau: 'experian',
      newFacts: [],
    })).toMatchObject({ kind: 'close' });
  });

  it('asks staff to refresh an updated item before another cycle', () => {
    expect(getResponseReviewRecommendation({
      outcome: 'updated',
      currentRound: 1,
      bureau: 'experian',
      newFacts: [],
    })).toMatchObject({ kind: 'refresh_item' });
  });

  it('stops automatic follow-up after a frivolous outcome', () => {
    expect(getResponseReviewRecommendation({
      outcome: 'frivolous',
      currentRound: 1,
      bureau: 'experian',
      newFacts: [],
    })).toMatchObject({ kind: 'no_further_action' });
  });

  it('recommends a method-of-verification draft after a verified first-round dispute', () => {
    const recommendation = getResponseReviewRecommendation({
      outcome: 'verified',
      currentRound: 1,
      bureau: 'experian',
      newFacts: [],
    });

    expect(recommendation).toMatchObject({
      kind: 'create_next_draft',
      plan: {
        nextRound: 2,
        targetRecipient: 'bureau',
        disputeType: 'method_of_verification',
      },
    });
  });

  it('recommends an explicit no-response escalation draft', () => {
    const recommendation = getResponseReviewRecommendation({
      outcome: 'no_response',
      currentRound: 2,
      bureau: 'equifax',
      newFacts: [],
    });

    expect(recommendation).toMatchObject({
      kind: 'create_next_draft',
      plan: {
        nextRound: 3,
        targetRecipient: 'cfpb',
        reasonCodes: expect.arrayContaining(['no_response']),
      },
    });
  });

  it('recommends a new-evidence bureau dispute after a verified second round with a new fact', () => {
    const recommendation = getResponseReviewRecommendation({
      outcome: 'verified',
      currentRound: 2,
      bureau: 'transunion',
      newFacts: ['client-supplied payment record evidence (1 document) not included in an earlier dispute'],
    });

    expect(recommendation).toMatchObject({
      kind: 'create_next_draft',
      title: 'Create Round 3 draft',
      plan: { nextRound: 3, targetRecipient: 'bureau', disputeType: 'new_evidence' },
    });
  });
});
