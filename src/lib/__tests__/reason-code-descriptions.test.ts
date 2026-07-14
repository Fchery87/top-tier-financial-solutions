import { beforeAll, describe, expect, it } from 'vitest';
import { buildEscalationPlan } from '@/lib/dispute-automation';

let DISPUTE_REASON_CODES: typeof import('@/lib/ai-letter-generator').DISPUTE_REASON_CODES;
let REASON_CODE_DESCRIPTIONS: typeof import('@/lib/ai-letter-generator').REASON_CODE_DESCRIPTIONS;

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
  ({ DISPUTE_REASON_CODES, REASON_CODE_DESCRIPTIONS } = await import('@/lib/ai-letter-generator'));
});

describe('reason code descriptions', () => {
  it('covers every code produced by escalation plans and dispute reason codes', () => {
    const escalationCodes = new Set<string>([
      ...buildEscalationPlan({ currentRound: 1, trigger: 'verified', currentBureau: 'equifax' }).reasonCodes,
      ...buildEscalationPlan({ currentRound: 2, trigger: 'verified', currentBureau: 'equifax' }).reasonCodes,
      ...buildEscalationPlan({ currentRound: 3, trigger: 'verified', currentBureau: 'equifax' }).reasonCodes,
      ...buildEscalationPlan({ currentRound: 1, trigger: 'no_response', currentBureau: 'equifax' }).reasonCodes,
      ...buildEscalationPlan({ currentRound: 2, trigger: 'no_response', currentBureau: 'equifax' }).reasonCodes,
      ...buildEscalationPlan({ currentRound: 3, trigger: 'no_response', currentBureau: 'equifax' }).reasonCodes,
    ]);

    const missingEscalationCodes = [...escalationCodes].filter(code => !REASON_CODE_DESCRIPTIONS[code]);
    const missingDisputeCodes = DISPUTE_REASON_CODES.filter(({ code }) => !REASON_CODE_DESCRIPTIONS[code]);

    expect(missingEscalationCodes).toEqual([]);
    expect(missingDisputeCodes).toEqual([]);
  });
});
