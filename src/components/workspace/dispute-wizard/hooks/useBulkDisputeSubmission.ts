import * as React from 'react';
import { toast } from 'sonner';
import type { AIAnalysisSummary, Client, GeneratedLetter, GenerationMethod, NegativeItem, TargetRecipient } from '../types';

interface UseBulkDisputeSubmissionOptions {
  getSelectedClient: () => Client | null;
  getGeneratedLetters: () => GeneratedLetter[];
  getNegativeItems: () => NegativeItem[];
  getSelectedReasonCodes: () => string[];
  getSelectedDisputeType: () => string;
  getDisputeRound: () => number;
  getGenerationMethod: () => GenerationMethod;
  getAiAnalysisSummary: () => AIAnalysisSummary | null;
  getAutoSelectSummary: () => unknown;
  getTargetRecipient: () => TargetRecipient;
}

export function useBulkDisputeSubmission({
  getSelectedClient,
  getGeneratedLetters,
  getNegativeItems,
  getSelectedReasonCodes,
  getSelectedDisputeType,
  getDisputeRound,
  getGenerationMethod,
  getAiAnalysisSummary,
  getAutoSelectSummary,
  getTargetRecipient,
}: UseBulkDisputeSubmissionOptions) {
  const [bulkTrackingNumber, setBulkTrackingNumber] = React.useState('');
  const [bulkSendDate, setBulkSendDate] = React.useState('');
  const [markingAsSent, setMarkingAsSent] = React.useState(false);
  const [bulkSentSuccess, setBulkSentSuccess] = React.useState(false);

  const handleBulkMarkAsSent = React.useCallback(async () => {
    const selectedClient = getSelectedClient();
    const generatedLetters = getGeneratedLetters();
    if (!selectedClient || generatedLetters.length === 0) return;

    setMarkingAsSent(true);
    setBulkSentSuccess(false);
    try {
      const sendDate = bulkSendDate ? new Date(bulkSendDate) : new Date();
      const responseDeadline = new Date(sendDate);
      responseDeadline.setDate(responseDeadline.getDate() + 30);

      const negativeItems = getNegativeItems();
      const selectedReasonCodes = getSelectedReasonCodes();
      const selectedDisputeType = getSelectedDisputeType();
      const disputeRound = getDisputeRound();
      const generationMethod = getGenerationMethod();
      const aiAnalysisSummary = getAiAnalysisSummary();
      const autoSelectSummary = getAutoSelectSummary();
      const targetRecipient = getTargetRecipient();

      for (const letter of generatedLetters) {
        const item = negativeItems.find(i => i.id === letter.itemId);
        const payload = letter.items?.[0];
        await fetch('/api/admin/disputes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: selectedClient.id, negativeItemId: letter.itemId, bureau: letter.bureau,
            disputeReason: selectedReasonCodes.join(', '), disputeType: selectedDisputeType, round: disputeRound,
            status: 'sent', letterContent: letter.content, trackingNumber: bulkTrackingNumber || null,
            sentAt: sendDate.toISOString(), responseDeadline: responseDeadline.toISOString(),
            creditorName: payload?.creditorName || item?.creditor_name,
            accountNumber: payload?.accountNumber || item?.account_number || null,
            generatedByAi: generationMethod === 'ai', reasonCodes: selectedReasonCodes,
            analysisConfidence: aiAnalysisSummary?.averageConfidence ? Math.round(aiAnalysisSummary.averageConfidence * 100) : undefined,
            autoSelected: !!autoSelectSummary, targetRecipient,
          }),
        });
      }
      setBulkSentSuccess(true);
    } catch (error) {
      console.error('Error marking disputes as sent:', error);
      toast.error('Failed to save some disputes. Please try again.');
    } finally {
      setMarkingAsSent(false);
    }
  }, [
    bulkSendDate,
    bulkTrackingNumber,
    getAiAnalysisSummary,
    getAutoSelectSummary,
    getDisputeRound,
    getGeneratedLetters,
    getGenerationMethod,
    getNegativeItems,
    getSelectedClient,
    getSelectedDisputeType,
    getSelectedReasonCodes,
    getTargetRecipient,
  ]);

  return {
    bulkTrackingNumber,
    setBulkTrackingNumber,
    bulkSendDate,
    setBulkSendDate,
    markingAsSent,
    setMarkingAsSent,
    bulkSentSuccess,
    setBulkSentSuccess,
    handleBulkMarkAsSent,
  };
}
