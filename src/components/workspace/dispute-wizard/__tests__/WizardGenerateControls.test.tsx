import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WizardGenerateControls } from '../WizardGenerateControls';

const context = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock('../WizardContext', () => ({
  useWizardContext: () => context.value,
}));

function baseContext(overrides: Record<string, unknown>) {
  return {
    generating: false,
    analyzingItems: false,
    analysisProgress: 0,
    estimatedTimeRemaining: null,
    generationProgress: 0,
    generationMethod: 'template',
    combineItemsPerBureau: false,
    validateCurrentStep: () => true,
    canProceed: () => true,
    analyzeItemsWithAI: vi.fn(),
    generateLetters: vi.fn(),
    highRiskClaims: [],
    readyItemCount: 1,
    generationFailure: null,
    ...overrides,
  };
}

describe('WizardGenerateControls', () => {
  it('shows the failure next to Generate so staff know why they stayed on this step', () => {
    context.value = baseContext({ generationFailure: 'Could not generate the experian letter: At least one reason code is required' });

    render(<WizardGenerateControls />);

    expect(screen.getByTestId('generation-failure').textContent).toBe(
      'Could not generate the experian letter: At least one reason code is required',
    );
  });

  it('shows no failure message when generation has not failed', () => {
    context.value = baseContext({ generationFailure: null });

    render(<WizardGenerateControls />);

    expect(screen.queryByTestId('generation-failure')).toBeNull();
  });
});
