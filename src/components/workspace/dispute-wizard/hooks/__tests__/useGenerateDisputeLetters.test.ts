import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useGenerateDisputeLetters } from '../useGenerateDisputeLetters';
import type { LetterGenerationRequestPlan } from '../../types/letter-generation';

const request = {
  bureau: 'experian',
  itemId: 'item-1',
  itemIds: ['item-1'],
  itemKind: 'tradeline',
  items: [{ kind: 'tradeline', id: 'item-1' }],
  combined: false,
  body: {},
} as unknown as LetterGenerationRequestPlan;

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock('../../services/buildLetterGenerationPayload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/buildLetterGenerationPayload')>()),
  buildLetterGenerationPayload: () => ({ requests: [request], selectedDisputeItems: [{ kind: 'tradeline', payload: { id: 'item-1' } }] }),
}));

function options(overrides: Record<string, unknown>) {
  return {
    selectedClient: { id: 'client-1' },
    negativeItems: [],
    selectedItems: ['item-1'],
    personalInfoItems: [],
    selectedPersonalItems: [],
    inquiryItems: [],
    selectedInquiryItems: [],
    generationMethod: 'template',
    selectedReasonCodes: ['inaccurate_balance'],
    aiAnalysisResults: [],
    aiAnalysisSummary: null,
    selectedMethodology: 'factual',
    selectedBureaus: ['experian'],
    targetRecipient: 'bureau',
    priorDisputeId: '',
    selectedDisputeType: 'standard',
    disputeRound: 1,
    customReason: '',
    combineItemsPerBureau: false,
    selectedEvidenceIds: [],
    requestManualReview: false,
    getInstructionText: () => '',
    hasItemInstruction: () => false,
    getItemReasonCode: () => null,
    itemAppearsOnBureau: () => true,
    generateLettersFromPlan: vi.fn(),
    setCurrentStep: vi.fn(),
    reviewStepId: 3,
    ...overrides,
  } as never;
}

describe('useGenerateDisputeLetters', () => {
  it('stays on the configure step and keeps the server message when no letter is generated', async () => {
    const setCurrentStep = vi.fn();
    const generateLettersFromPlan = vi.fn(async (_requests, opts) => {
      opts?.onError?.(new Error('At least one reason code is required'), request);
      return { letters: [] };
    });

    const { result } = renderHook(() => useGenerateDisputeLetters(options({ generateLettersFromPlan, setCurrentStep })));

    await act(async () => { await result.current.generateLetters(); });

    expect(setCurrentStep).not.toHaveBeenCalled();
    expect(result.current.generationFailure).toBe('Could not generate the experian letter: At least one reason code is required');
  });

  it('advances to review and clears the failure once letters exist', async () => {
    const setCurrentStep = vi.fn();
    const generateLettersFromPlan = vi.fn(async () => ({ letters: [{ id: 'dispute-1' }] }));

    const { result } = renderHook(() => useGenerateDisputeLetters(options({ generateLettersFromPlan, setCurrentStep })));

    await act(async () => { await result.current.generateLetters(); });

    expect(setCurrentStep).toHaveBeenCalledWith(3);
    expect(result.current.generationFailure).toBeNull();
  });
});
