import * as React from 'react';
import { WIZARD_STEPS } from '../types';

export function useWizardNavigation() {
  const [currentStep, setCurrentStep] = React.useState(1);
  const maxSteps = WIZARD_STEPS.length;
  const reviewStepId = 4;

  const handleStepClick = React.useCallback((stepId: number) => {
    if (stepId < currentStep) setCurrentStep(stepId);
  }, [currentStep]);

  return {
    currentStep,
    setCurrentStep,
    maxSteps,
    reviewStepId,
    handleStepClick,
  };
}
