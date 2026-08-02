import * as React from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import {
  validateStep1,
  validateStep2,
  validateStep3,
  validateStep4,
} from '@/lib/dispute-wizard-validation';
import { type StepStatus } from '@/components/workspace/DisputeWizardProgressBar';
import {
  type Client,
  type GeneratedLetter,
  type GenerationMethod,
  type ItemDisputeInstruction,
  type TargetRecipient,
  WIZARD_STEPS,
} from '../types';

interface DiscrepancySummary {
  total: number;
  highSeverity: number;
}

interface UseWizardValidationOptions {
  currentStep: number;
  selectedClient: Client | null;
  selectedItems: string[];
  selectedPersonalItems: string[];
  selectedInquiryItems: string[];
  generationMethod: GenerationMethod;
  itemDisputeInstructions: Map<string, ItemDisputeInstruction>;
  selectedBureaus: string[];
  disputeRound: number;
  targetRecipient: TargetRecipient;
  priorDisputeId: string;
  discrepancySummary: DiscrepancySummary | null;
  generatedLetters: GeneratedLetter[];
}

export function useWizardValidation({
  currentStep,
  selectedClient,
  selectedItems,
  selectedPersonalItems,
  selectedInquiryItems,
  generationMethod,
  itemDisputeInstructions,
  selectedBureaus,
  disputeRound,
  targetRecipient,
  priorDisputeId,
  discrepancySummary,
  generatedLetters,
}: UseWizardValidationOptions) {
  const [validationErrors, setValidationErrors] = React.useState<Record<number, string[]>>({});
  const [validationWarnings, setValidationWarnings] = React.useState<Record<number, string[]>>({});

  const getStepValidation = React.useCallback((step: number): { errors: string[]; warnings: string[] } => {
    let validationResult: { errors: string[]; warnings: string[] } | null = null;
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (step) {
      case 1: validationResult = validateStep1(selectedClient?.id ?? null); break;
      case 2: {
        const totalSelected = selectedItems.length + selectedPersonalItems.length + selectedInquiryItems.length;
        if (totalSelected === 0) {
          errors.push('Please select at least one item to dispute');
        }

        if (generationMethod === 'template' && selectedItems.length > 0) {
          const itemReasonCodes = Object.fromEntries(selectedItems.map(itemId => {
            const instruction = itemDisputeInstructions.get(itemId);
            if (!instruction) return [itemId, []];
            if (instruction.instructionType === 'preset' && instruction.presetCode) return [itemId, [instruction.presetCode]];
            if (instruction.instructionType === 'custom' && instruction.customText?.trim()) return [itemId, [instruction.customText]];
            return [itemId, []];
          }));
          const templateValidation = validateStep2(selectedItems, itemReasonCodes);
          errors.push(...templateValidation.errors);
          warnings.push(...templateValidation.warnings);
        }
        break;
      }
      case 3:
        validationResult = validateStep3(selectedBureaus, disputeRound);
        if (discrepancySummary?.highSeverity && discrepancySummary.highSeverity > 0) errors.push('Unable to proceed with high-severity discrepancies detected');
        if (targetRecipient === 'cfpb') {
          const totalSelected = selectedItems.length + selectedPersonalItems.length + selectedInquiryItems.length;
          if (totalSelected !== 1) errors.push('CFPB generation requires exactly one dispute item with one attributable CRA predecessor');
          if (!priorDisputeId.trim()) errors.push('A prior CRA dispute is required before CFPB generation');
        }
        break;
      case 4: validationResult = validateStep4(generatedLetters); break;
    }

    if (validationResult) { errors.push(...validationResult.errors); warnings.push(...validationResult.warnings); }
    return { errors, warnings };
  }, [
    discrepancySummary,
    disputeRound,
    generatedLetters,
    generationMethod,
    itemDisputeInstructions,
    priorDisputeId,
    selectedBureaus,
    selectedClient,
    selectedInquiryItems.length,
    selectedItems,
    selectedPersonalItems.length,
    targetRecipient,
  ]);

  const validateCurrentStep = React.useCallback((): boolean => {
    const { errors, warnings } = getStepValidation(currentStep);
    const newErrors = { ...validationErrors };
    const newWarnings = { ...validationWarnings };
    if (errors.length > 0) newErrors[currentStep] = errors; else delete newErrors[currentStep];
    if (warnings.length > 0) newWarnings[currentStep] = warnings; else delete newWarnings[currentStep];
    setValidationErrors(newErrors);
    setValidationWarnings(newWarnings);
    return errors.length === 0;
  }, [currentStep, getStepValidation, validationErrors, validationWarnings]);

  const canProceed = React.useCallback((): boolean => getStepValidation(currentStep).errors.length === 0, [currentStep, getStepValidation]);

  const renderValidationMessages = React.useCallback(() => {
    const errors = validationErrors[currentStep] || [];
    const warnings = validationWarnings[currentStep] || [];
    return (
      <>
        {errors.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/25 rounded-lg p-4 mb-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1"><h3 className="font-semibold text-destructive mb-2">Validation Errors</h3><ul className="space-y-1">{errors.map((error, idx) => <li key={idx} className="text-destructive text-sm">• {error}</li>)}</ul></div>
            </div>
          </div>
        )}
        {warnings.length > 0 && errors.length === 0 && (
          <div className="bg-warning/10 border border-warning/25 rounded-lg p-4 mb-4">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="flex-1"><h3 className="font-semibold text-warning mb-2">Warnings</h3><ul className="space-y-1">{warnings.map((warning, idx) => <li key={idx} className="text-warning text-sm">• {warning}</li>)}</ul></div>
            </div>
          </div>
        )}
      </>
    );
  }, [currentStep, validationErrors, validationWarnings]);

  const buildStepStatuses = React.useCallback((): StepStatus[] => {
    return WIZARD_STEPS.map((step) => {
      const stepErrors = validationErrors[step.id] || [];
      const stepWarnings = validationWarnings[step.id] || [];
      const isComplete = (step.id === 1 && selectedClient !== null) || (step.id === 2 && selectedItems.length > 0) || (step.id === 3 && selectedBureaus.length > 0) || (step.id === 4 && generatedLetters.length > 0);
      return { stepId: step.id, isComplete, hasErrors: stepErrors.length > 0, hasWarnings: stepWarnings.length > 0, isCurrentStep: currentStep === step.id };
    });
  }, [currentStep, generatedLetters.length, selectedBureaus.length, selectedClient, selectedItems.length, validationErrors, validationWarnings]);

  return {
    validationErrors,
    setValidationErrors,
    validationWarnings,
    setValidationWarnings,
    getStepValidation,
    validateCurrentStep,
    canProceed,
    renderValidationMessages,
    buildStepStatuses,
  };
}
