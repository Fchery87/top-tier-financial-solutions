import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWizardValidation } from '../useWizardValidation';
import type { TargetRecipient } from '../../types';

function validationInput(generationMethod: 'ai' | 'template') {
  const targetRecipient: TargetRecipient = 'bureau';
  return {
    currentStep: 2,
    selectedClient: { id: 'client-1', first_name: 'Test', last_name: 'Client', email: null, phone: null, status: 'active' },
    selectedItems: ['item-1'],
    selectedPersonalItems: [],
    selectedInquiryItems: [],
    generationMethod,
    itemDisputeInstructions: new Map(),
    selectedBureaus: ['transunion'],
    disputeRound: 1,
    targetRecipient,
    priorDisputeId: '',
    discrepancySummary: null,
    generatedLetters: [],
  };
}

describe('useWizardValidation', () => {
  it('allows selected AI items without template instructions', () => {
    const { result } = renderHook(() => useWizardValidation(validationInput('ai')));

    expect(result.current.canProceed()).toBe(true);
  });

  it('requires a template instruction when template mode is selected', () => {
    const { result } = renderHook(() => useWizardValidation(validationInput('template')));

    expect(result.current.canProceed()).toBe(false);
  });

  it('blocks CFPB generation without one eligible CRA predecessor', () => {
    const { result } = renderHook(() => useWizardValidation({
      ...validationInput('ai'),
      currentStep: 3,
      targetRecipient: 'cfpb',
      priorDisputeId: '',
    }));

    expect(result.current.canProceed()).toBe(false);
    expect(result.current.getStepValidation(3).errors).toContain('A prior CRA dispute is required before CFPB generation');
  });
});
