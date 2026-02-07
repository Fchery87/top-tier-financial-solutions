export type EscalationTrigger = 'verified' | 'no_response';

export interface EscalationPlanInput {
  currentRound: number;
  trigger: EscalationTrigger;
  currentBureau: string;
}

export interface EscalationPlan {
  nextRound: number;
  targetRecipient: 'bureau' | 'creditor' | 'cfpb';
  disputeType: 'method_of_verification' | 'direct_creditor' | 'fcra_violation_notice';
  methodology: 'method_of_verification' | 'consumer_law';
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

    if (nextRound === 3) {
      return {
        nextRound,
        targetRecipient: 'creditor',
        disputeType: 'direct_creditor',
        methodology: 'consumer_law',
        reasonCodes: ['verification_required', 'metro2_violation'],
        customReason: `Item remained verified after method-of-verification in Round ${input.currentRound}. Escalating to creditor directly.`,
      };
    }

    return {
      nextRound,
      targetRecipient: 'cfpb',
      disputeType: 'fcra_violation_notice',
      methodology: 'consumer_law',
      reasonCodes: ['repeat_verification', 'fcra_non_compliance'],
      customReason: `Repeated verification without sufficient documentation by Round ${input.currentRound}. Preparing regulatory escalation.`,
    };
  }

  if (nextRound <= 2) {
    return {
      nextRound,
      targetRecipient: 'bureau',
      disputeType: 'method_of_verification',
      methodology: 'method_of_verification',
      reasonCodes: ['no_response', 'request_verification_method'],
      customReason: `No timely response to Round ${input.currentRound}. Requesting verification method and reinvestigation.`,
    };
  }

  if (nextRound === 3) {
    return {
      nextRound,
      targetRecipient: 'creditor',
      disputeType: 'direct_creditor',
      methodology: 'consumer_law',
      reasonCodes: ['no_response', 'verification_required'],
      customReason: `No timely response after prior rounds. Escalating directly to the furnisher/creditor.`,
    };
  }

  return {
    nextRound,
    targetRecipient: 'cfpb',
    disputeType: 'fcra_violation_notice',
    methodology: 'consumer_law',
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
