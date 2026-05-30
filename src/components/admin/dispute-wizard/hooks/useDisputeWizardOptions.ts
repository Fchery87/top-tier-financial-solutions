import * as React from 'react';
import type { GenerationMethod, TargetRecipient } from '../types';

export function useDisputeWizardOptions() {
  const [disputeRound, setDisputeRound] = React.useState(1);
  const [targetRecipient, setTargetRecipient] = React.useState<TargetRecipient>('bureau');
  const [selectedBureaus, setSelectedBureaus] = React.useState<string[]>(['transunion', 'experian', 'equifax']);
  const [generationMethod, setGenerationMethod] = React.useState<GenerationMethod>('ai');
  const [combineItemsPerBureau, setCombineItemsPerBureau] = React.useState(true);
  const [requestManualReview, setRequestManualReview] = React.useState(false);
  const [selectedReasonCodes, setSelectedReasonCodes] = React.useState<string[]>([]);
  const [selectedDisputeType, _setSelectedDisputeType] = React.useState('standard');
  const [customReason, _setCustomReason] = React.useState('');

  const handleToggleBureau = React.useCallback((bureau: string) => {
    setSelectedBureaus(prev => prev.includes(bureau) ? prev.filter(b => b !== bureau) : [...prev, bureau]);
  }, []);

  return {
    disputeRound,
    setDisputeRound,
    targetRecipient,
    setTargetRecipient,
    selectedBureaus,
    setSelectedBureaus,
    generationMethod,
    setGenerationMethod,
    combineItemsPerBureau,
    setCombineItemsPerBureau,
    requestManualReview,
    setRequestManualReview,
    selectedReasonCodes,
    setSelectedReasonCodes,
    selectedDisputeType,
    customReason,
    handleToggleBureau,
  };
}
