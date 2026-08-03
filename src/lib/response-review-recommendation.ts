import {
  buildEscalationPlan,
  type EscalationPlan,
} from '@/lib/dispute-automation';

export type ResponseReviewOutcome =
  | 'deleted'
  | 'updated'
  | 'verified'
  | 'no_response'
  | 'frivolous';

interface ResponseReviewRecommendationBase {
  title: string;
  detail: string;
}

export type ResponseReviewRecommendation =
  | (ResponseReviewRecommendationBase & { kind: 'close' })
  | (ResponseReviewRecommendationBase & { kind: 'refresh_item' })
  | (ResponseReviewRecommendationBase & { kind: 'no_further_action' })
  | (ResponseReviewRecommendationBase & {
    kind: 'create_next_draft';
    plan: EscalationPlan;
  });

export function getResponseReviewRecommendation(input: {
  outcome: ResponseReviewOutcome;
  currentRound: number;
  bureau: string;
}): ResponseReviewRecommendation {
  switch (input.outcome) {
    case 'deleted':
      return {
        kind: 'close',
        title: 'Close this item',
        detail: 'The item was deleted. Close this dispute after confirming the reported change.',
      };
    case 'updated':
      return {
        kind: 'refresh_item',
        title: 'Refresh item facts',
        detail: 'The item changed. Review the refreshed report data before deciding whether another cycle is appropriate.',
      };
    case 'frivolous':
      return {
        kind: 'no_further_action',
        title: 'No automatic follow-up',
        detail: 'The response marked the dispute frivolous. Preserve the review record and decide any further action manually.',
      };
    case 'verified':
    case 'no_response': {
      const plan = buildEscalationPlan({
        currentRound: input.currentRound,
        trigger: input.outcome,
        currentBureau: input.bureau,
      });
      return {
        kind: 'create_next_draft',
        title: `Create Round ${plan.nextRound} draft`,
        detail: plan.customReason,
        plan,
      };
    }
    default: {
      const exhaustiveOutcome: never = input.outcome;
      return exhaustiveOutcome;
    }
  }
}
