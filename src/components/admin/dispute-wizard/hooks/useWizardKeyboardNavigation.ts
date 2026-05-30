import * as React from 'react';

interface UseWizardKeyboardNavigationOptions {
  currentStep: number;
  maxSteps: number;
  validationErrors: Record<number, string[]>;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
}

export function useWizardKeyboardNavigation({
  currentStep,
  maxSteps,
  validationErrors,
  setCurrentStep,
}: UseWizardKeyboardNavigationOptions) {
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) return;

      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        if (currentStep < maxSteps) {
          const stepErrors = validationErrors[currentStep];
          if (!stepErrors || stepErrors.length === 0) setCurrentStep(currentStep + 1);
        }
      }

      if (e.key === 'Escape' && currentStep > 1) {
        e.preventDefault();
        setCurrentStep(currentStep - 1);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => { window.removeEventListener('keydown', handleKeyPress); };
  }, [currentStep, maxSteps, validationErrors, setCurrentStep]);
}
