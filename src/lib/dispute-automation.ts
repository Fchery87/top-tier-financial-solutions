export type EscalationTrigger = 'verified' | 'no_response';

/**
 * A verified item can only go back to a bureau with a New Fact: something no
 * earlier letter on the item cited. No-response escalations never need one.
 */
export type EscalationPlanInput =
  | { currentRound: number; trigger: 'verified'; currentBureau: string; newFacts: string[] }
  | { currentRound: number; trigger: 'no_response'; currentBureau: string };

export interface EscalationPlan {
  nextRound: number;
  targetRecipient: 'bureau' | 'cfpb';
  disputeType: 'method_of_verification' | 'new_evidence' | 'fcra_violation_notice';
  methodology: 'method_of_verification' | 'factual';
  reasonCodes: string[];
  customReason: string;
}

export type EscalationHealthStatus = 'healthy' | 'warning' | 'error' | 'disabled';

export interface EscalationHealthInput {
  enabled: boolean;
  lastRunSuccess: boolean | null;
  lastRunAt: string | null;
  staleAfterHours: number;
}

export function calculateDisputeDeadlines(sentAt: Date, escalationPath?: string | null): {
  responseDeadline: Date;
  escalationReadyAt: Date;
} {
  const responseDeadline = new Date(sentAt);
  responseDeadline.setDate(responseDeadline.getDate() + 30);

  const escalationDays = escalationPath === 'creditor' || escalationPath === 'collector' ? 45 : 35;
  const escalationReadyAt = new Date(sentAt);
  escalationReadyAt.setDate(escalationReadyAt.getDate() + escalationDays);

  return { responseDeadline, escalationReadyAt };
}

// Never a Direct Dispute: a furnisher may ignore one this business prepares
// (12 CFR 1022.43(b)(2)). See ADR 0004.
export function buildEscalationPlan(input: EscalationPlanInput): EscalationPlan {
  const nextRound = Math.min((input.currentRound || 1) + 1, 4);

  if (input.trigger === 'verified') {
    if (nextRound === 2) {
      return {
        nextRound,
        targetRecipient: 'bureau',
        disputeType: 'method_of_verification',
        methodology: 'method_of_verification',
        reasonCodes: ['previously_disputed', 'request_verification_method'],
        customReason: `Item verified in Round ${input.currentRound}. Requesting method of verification from ${input.currentBureau}.`,
      };
    }

    if (input.newFacts.length > 0) {
      return {
        nextRound,
        targetRecipient: 'bureau',
        disputeType: 'new_evidence',
        methodology: 'factual',
        reasonCodes: ['previously_disputed', 'new_evidence'],
        customReason: `Item still verified after Round ${input.currentRound}. Disputing again with ${input.currentBureau} on information the earlier disputes did not include: ${input.newFacts.join('; ')}.`,
      };
    }

    return {
      nextRound,
      targetRecipient: 'cfpb',
      disputeType: 'fcra_violation_notice',
      methodology: 'factual',
      reasonCodes: ['repeat_verification', 'fcra_non_compliance'],
      customReason: `Item still verified after Round ${input.currentRound} and there is no new information for another bureau dispute. Preparing a regulator complaint for manual review.`,
    };
  }

  if (nextRound === 2) {
    return {
      nextRound,
      targetRecipient: 'bureau',
      disputeType: 'method_of_verification',
      methodology: 'method_of_verification',
      reasonCodes: ['no_response', 'request_verification_method'],
      customReason: `No timely response to Round ${input.currentRound}. Requesting verification method and reinvestigation.`,
    };
  }

  return {
    nextRound,
    targetRecipient: 'cfpb',
    disputeType: 'fcra_violation_notice',
    methodology: 'factual',
    reasonCodes: ['no_response', 'fcra_non_compliance'],
    customReason: 'No timely response after multiple rounds. Escalating to CFPB for compliance review.',
  };
}

export function getDisputeSlaDefinitionId(): string {
  return 'system-dispute-response-window';
}

export function getDisputeSlaInstanceId(disputeId: string): string {
  return `sla-dispute-${disputeId}`;
}

export function isDryRunRequested(rawValue: string | null): boolean {
  if (!rawValue) return false;
  return ['1', 'true', 'yes', 'y', 'on'].includes(rawValue.trim().toLowerCase());
}

export function getEscalationHealthStatus(input: EscalationHealthInput): EscalationHealthStatus {
  if (!input.enabled) return 'disabled';
  if (input.lastRunSuccess === false) return 'error';
  if (!input.lastRunAt) return 'warning';

  const staleAfterMs = input.staleAfterHours * 60 * 60 * 1000;
  const ageMs = Date.now() - new Date(input.lastRunAt).getTime();
  if (Number.isNaN(ageMs) || ageMs > staleAfterMs) {
    return 'warning';
  }

  return 'healthy';
}
