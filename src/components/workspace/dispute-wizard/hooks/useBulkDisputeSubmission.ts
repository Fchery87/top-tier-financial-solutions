import * as React from 'react';
import { toast } from 'sonner';
import type { Client, GeneratedLetter, TargetRecipient } from '../types';

interface UseBulkDisputeSubmissionOptions {
  getSelectedClient: () => Client | null;
  getGeneratedLetters: () => GeneratedLetter[];
  getTargetRecipient: () => TargetRecipient;
}

export function useBulkDisputeSubmission({
  getSelectedClient,
  getGeneratedLetters,
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

      const targetRecipient = getTargetRecipient();

      for (const letter of generatedLetters) {
        const response = await fetch(`/api/workspace/disputes/${letter.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'sent',
            trackingNumber: bulkTrackingNumber || null,
            sentAt: sendDate.toISOString(),
            responseDeadline: responseDeadline.toISOString(),
            submissionMethod: 'online',
            submissionRecipient: targetRecipient,
            submissionDate: sendDate.toISOString(),
          }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(typeof body.error === 'string' ? body.error : `Failed to mark ${letter.id} as sent`);
        }
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
    getGeneratedLetters,
    getSelectedClient,
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
