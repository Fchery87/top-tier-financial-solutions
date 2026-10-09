import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { buildLetterGenerationPayload } from '@/components/workspace/dispute-wizard/services/buildLetterGenerationPayload';
import type { LetterGenerationBuilderInput } from '@/components/workspace/dispute-wizard/types/letter-generation';
import type { NegativeItem } from '@/components/workspace/dispute-wizard/types';
import { buildCreateDisputeRequestBody } from '@/components/workspace/client-detail/buildCreateDisputeRequestBody';

// Repro: the screens send the bodies built by their real payload builders. The
// routes must decide the dispute policy on the server instead of requiring a
// caller-supplied `policyDecision`.

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
}));
const txMock = vi.hoisted(() => ({ insert: vi.fn(), select: vi.fn(), update: vi.fn() }));
const requireCapabilityMock = vi.hoisted(() => vi.fn());
const generateUniqueDisputeLetterMock = vi.hoisted(() => vi.fn());
const generateMultiItemDisputeLetterMock = vi.hoisted(() => vi.fn());
const requireLatestApprovedReportForClientMock = vi.hoisted(() => vi.fn());
const selectLibraryForGenerationMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));
vi.mock('@/lib/ai-letter-generator', () => ({
  generateUniqueDisputeLetter: generateUniqueDisputeLetterMock,
  generateMultiItemDisputeLetter: generateMultiItemDisputeLetterMock,
  DISPUTE_REASON_CODES: [],
}));
vi.mock('@/lib/letter-generation-library', () => ({ selectLibraryForGeneration: selectLibraryForGenerationMock }));
vi.mock('@/lib/parser-review-gate', () => ({ requireLatestApprovedReportForClient: requireLatestApprovedReportForClientMock }));
vi.mock('@/lib/rate-limit-middleware', () => ({ rateLimited: () => (handler: unknown) => handler }));
vi.mock('@/lib/rate-limit', () => ({ sensitiveLimiter: {} }));
vi.mock('@/lib/db-encryption', () => ({
  decryptDisputeData: (data: unknown) => data,
  decryptClientData: (data: unknown) => data,
}));

const ORDINARY_DECISION_BASE = {
  approved: true,
  requiredEvidence: ['identity_document', 'proof_of_address'],
  claimRisk: 'ordinary',
  targetRecipient: 'bureau',
  violations: [],
};

const tradeline: NegativeItem = {
  id: 'neg-1',
  creditor_name: 'Bank One',
  original_creditor: null,
  account_number: '1234',
  item_type: 'collection',
  amount: 500,
  date_reported: '2026-01-01',
  bureau: 'experian',
  bureaus: ['experian'],
  on_transunion: false,
  on_experian: true,
  on_equifax: false,
  risk_severity: 'high',
  recommended_action: 'dispute',
};

function wizardInput(overrides: Record<string, unknown> = {}): LetterGenerationBuilderInput {
  return {
    selectedClientId: 'client-1',
    negativeItems: [tradeline],
    selectedItems: ['neg-1'],
    personalInfoItems: [],
    selectedPersonalItems: [],
    inquiryItems: [],
    selectedInquiryItems: [],
    generationMethod: 'ai',
    selectedReasonCodes: [],
    effectiveAnalyses: [],
    effectiveSummary: null,
    selectedMethodology: 'factual',
    selectedBureaus: ['experian'],
    targetRecipient: 'bureau',
    selectedDisputeType: 'standard',
    disputeRound: 1,
    customReason: '',
    combineItemsPerBureau: true,
    selectedEvidenceIds: [],
    requestManualReview: false,
    getInstructionText: () => 'The information being reported contains inaccuracies.',
    hasItemInstruction: () => true,
    // Template mode: the staff member chose the "Inaccurate Information" preset.
    getItemReasonCode: () => 'inaccurate_reporting',
    itemAppearsOnBureau: (item: NegativeItem, bureau: string) => (item.bureaus || []).includes(bureau),
    ...overrides,
  } satisfies LetterGenerationBuilderInput;
}

function mockClientLookup() {
  dbMock.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ id: 'client-1', firstName: 'Jane', lastName: 'Sample' }]),
      }),
    }),
  });
}

function insertedDisputeValues(): Record<string, unknown> | undefined {
  return txMock.insert.mock.results[0]?.value.values.mock.calls[0]?.[0];
}

async function postGenerateLetter(body: unknown) {
  const { POST } = await import('@/app/api/workspace/disputes/generate-letter/route');
  const response = await POST(new NextRequest('http://localhost/api/workspace/disputes/generate-letter', {
    method: 'POST',
    body: JSON.stringify(body),
  }));
  return { status: response.status, body: await response.json() };
}

describe('dispute screens -> server-decided dispute policy', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireCapabilityMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'super_admin' });
    requireLatestApprovedReportForClientMock.mockResolvedValue({ allowed: true });
    selectLibraryForGenerationMock.mockResolvedValue({ chosen: null, score: 0, rationale: [], runnersUp: [] });
    generateUniqueDisputeLetterMock.mockResolvedValue({ letter: 'Generated single-item letter', source: 'ai' });
    generateMultiItemDisputeLetterMock.mockResolvedValue({ letter: 'Generated combined letter', source: 'ai' });
    mockClientLookup();
    txMock.insert.mockImplementation(() => ({ values: vi.fn().mockResolvedValue(undefined) }));
    dbMock.transaction.mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock));
    dbMock.update.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) });
  });

  describe('wizard -> POST /api/workspace/disputes/generate-letter', () => {
    it('accepts the AI-mode combined request and persists the server decision', async () => {
      const plan = buildLetterGenerationPayload(wizardInput({ generationMethod: 'ai', combineItemsPerBureau: true }));
      expect(plan.requests).toHaveLength(1);

      const result = await postGenerateLetter(plan.requests[0].body);

      expect({ status: result.status, error: result.body.error }).toEqual({ status: 200, error: undefined });
      expect(JSON.parse(insertedDisputeValues()?.policyDecision as string)).toEqual({
        ...ORDINARY_DECISION_BASE,
        reasonCodes: ['verification_required', 'inaccurate_reporting'],
      });
    }, 30000);

    it('accepts the AI-mode single-item request and persists the server decision', async () => {
      const plan = buildLetterGenerationPayload(wizardInput({ generationMethod: 'ai', combineItemsPerBureau: false }));
      expect(plan.requests).toHaveLength(1);

      const result = await postGenerateLetter(plan.requests[0].body);

      expect({ status: result.status, error: result.body.error }).toEqual({ status: 200, error: undefined });
      expect(JSON.parse(insertedDisputeValues()?.policyDecision as string)).toEqual({
        ...ORDINARY_DECISION_BASE,
        reasonCodes: ['verification_required', 'inaccurate_reporting'],
      });
    }, 30000);

    it('accepts the template-mode request using the reason code the staff member chose', async () => {
      const plan = buildLetterGenerationPayload(wizardInput({ generationMethod: 'template', combineItemsPerBureau: false }));
      expect(plan.requests).toHaveLength(1);

      const result = await postGenerateLetter(plan.requests[0].body);

      expect({ status: result.status, error: result.body.error }).toEqual({ status: 200, error: undefined });
      expect(JSON.parse(insertedDisputeValues()?.policyDecision as string)).toEqual({
        ...ORDINARY_DECISION_BASE,
        reasonCodes: ['inaccurate_reporting'],
      });
    }, 30000);

    it('refuses a forged approved policyDecision for a high-risk claim without evidence', async () => {
      const result = await postGenerateLetter({
        clientId: 'client-1',
        bureau: 'experian',
        disputeItems: [{ id: 'neg-1', kind: 'tradeline', creditorName: 'Bank One', itemType: 'collection' }],
        reasonCodes: ['not_mine'],
        clientConfirmedOwnershipClaims: true,
        policyDecision: {
          approved: true,
          reasonCodes: ['not_mine'],
          requiredEvidence: ['identity_document', 'proof_of_address', 'claim_specific_evidence'],
          claimRisk: 'high',
          targetRecipient: 'bureau',
          violations: [],
        },
      });

      expect(result.status).toBe(400);
      expect(result.body.violations).toContain('High-risk claims require claim-specific evidence.');
      expect(generateUniqueDisputeLetterMock).not.toHaveBeenCalled();
      expect(dbMock.transaction).not.toHaveBeenCalled();
    }, 30000);
  });

  describe('client profile Disputes tab -> POST /api/workspace/disputes', () => {
    async function postCreateDispute(body: unknown) {
      const { POST } = await import('@/app/api/workspace/disputes/route');
      const response = await POST(new NextRequest('http://localhost/api/workspace/disputes', {
        method: 'POST',
        body: JSON.stringify(body),
      }));
      return { status: response.status, body: await response.json() };
    }

    it('accepts the request body the Disputes tab sends and persists the server decision', async () => {
      const createdDispute = {
        id: 'dispute-1',
        clientId: 'client-1',
        bureau: 'experian',
        reasonCodes: JSON.stringify(['verification_required']),
        policyDecision: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      };
      dbMock.select
        .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'client-1', firstName: 'Jane', lastName: 'Sample' }]) }) }) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'neg-1', creditorName: 'Bank One', itemType: 'collection', amount: 500 }]) }) }) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([createdDispute]) }) }) });

      const body = buildCreateDisputeRequestBody({
        clientId: 'client-1',
        negativeItemId: 'neg-1',
        bureau: 'experian',
        disputeReason: 'This collection is inaccurate and should be removed.',
        disputeType: 'standard',
        reasonCode: 'verification_required',
      });
      const result = await postCreateDispute(body);

      expect({ status: result.status, error: result.body.error }).toEqual({ status: 201, error: undefined });
      expect(JSON.parse(insertedDisputeValues()?.policyDecision as string)).toEqual({
        ...ORDINARY_DECISION_BASE,
        reasonCodes: ['verification_required'],
      });
    }, 30000);

    it('refuses a forged approved policyDecision for a high-risk claim without evidence', async () => {
      const result = await postCreateDispute({
        clientId: 'client-1',
        negativeItemId: 'neg-1',
        bureau: 'experian',
        disputeReason: 'Client states this account is not theirs.',
        reasonCodes: ['identity_theft'],
        clientConfirmedOwnershipClaims: true,
        policyDecision: {
          approved: true,
          reasonCodes: ['identity_theft'],
          requiredEvidence: ['identity_document', 'proof_of_address', 'claim_specific_evidence'],
          claimRisk: 'high',
          targetRecipient: 'bureau',
          violations: [],
        },
      });

      expect(result.status).toBe(400);
      expect(result.body.violations).toContain('High-risk claims require claim-specific evidence.');
      expect(generateUniqueDisputeLetterMock).not.toHaveBeenCalled();
      expect(dbMock.transaction).not.toHaveBeenCalled();
    }, 30000);
  });
});
