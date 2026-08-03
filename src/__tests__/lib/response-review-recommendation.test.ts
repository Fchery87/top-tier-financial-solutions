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
    })).toMatchObject({ kind: 'close' });
  });

  it('asks staff to refresh an updated item before another cycle', () => {
    expect(getResponseReviewRecommendation({
      outcome: 'updated',
      currentRound: 1,
      bureau: 'experian',
    })).toMatchObject({ kind: 'refresh_item' });
  });

  it('stops automatic follow-up after a frivolous outcome', () => {
    expect(getResponseReviewRecommendation({
      outcome: 'frivolous',
      currentRound: 1,
      bureau: 'experian',
    })).toMatchObject({ kind: 'no_further_action' });
  });

  it('recommends a method-of-verification draft after a verified first-round dispute', () => {
    const recommendation = getResponseReviewRecommendation({
      outcome: 'verified',
      currentRound: 1,
      bureau: 'experian',
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
    });

    expect(recommendation).toMatchObject({
      kind: 'create_next_draft',
      plan: {
        nextRound: 3,
        targetRecipient: 'creditor',
        reasonCodes: expect.arrayContaining(['no_response']),
      },
    });
  });
});
