import * as React from 'react';
import type { EvidenceDocument } from '../types';

interface EvidenceSelectionOptions {
  getClientId: () => string | null | undefined;
  onOperationError?: (message: string) => void;
}

export function useEvidenceSelection({ getClientId, onOperationError }: EvidenceSelectionOptions) {
  const [evidenceDocuments, setEvidenceDocuments] = React.useState<EvidenceDocument[]>([]);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = React.useState<string[]>([]);
  const [loadingEvidence, setLoadingEvidence] = React.useState(false);
  const [evidenceOverrideConfirmed, setEvidenceOverrideConfirmed] = React.useState(false);
  const [showEvidenceUploadModal, setShowEvidenceUploadModal] = React.useState(false);

  const fetchEvidence = React.useCallback(async (clientId: string) => {
    setLoadingEvidence(true);
    try {
      const response = await fetch(`/api/admin/disputes/evidence?clientId=${clientId}`);
      if (response.ok) {
        const data = await response.json();
        setEvidenceDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Error fetching evidence:', error);
    } finally {
      setLoadingEvidence(false);
    }
  }, []);

  const handleUploadEvidence = React.useCallback(async (files: File[]) => {
    const clientId = getClientId();
    if (!clientId) return;

    const formData = new FormData();
    formData.append('clientId', clientId);
    files.forEach((file) => formData.append('files', file));

    try {
      const response = await fetch('/api/admin/disputes/evidence/upload', { method: 'POST', body: formData });
      if (response.ok) {
        const data = await response.json();
        const newDocuments: EvidenceDocument[] = data.documents || [];
        setEvidenceDocuments((prev) => [...prev, ...newDocuments]);
        setSelectedEvidenceIds((prev) => [...prev, ...newDocuments.map((doc) => doc.id)]);
        setShowEvidenceUploadModal(false);
      } else {
        throw new Error(await response.text() || 'Failed to upload evidence');
      }
    } catch (error) {
      console.error('Error uploading evidence:', error);
      onOperationError?.(error instanceof Error ? error.message : 'Failed to upload evidence documents');
    }
  }, [getClientId, onOperationError]);

  const handleRemoveEvidence = React.useCallback(async (documentId: string) => {
    const clientId = getClientId();
    if (!clientId) return;

    try {
      const response = await fetch('/api/admin/disputes/evidence/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, documentId }),
      });
      if (response.ok) {
        setEvidenceDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
        setSelectedEvidenceIds((prev) => prev.filter((id) => id !== documentId));
      } else {
        throw new Error(await response.text() || 'Failed to remove evidence');
      }
    } catch (error) {
      console.error('Error removing evidence:', error);
      onOperationError?.(error instanceof Error ? error.message : 'Failed to remove evidence document');
    }
  }, [getClientId, onOperationError]);

  return {
    evidenceDocuments,
    setEvidenceDocuments,
    selectedEvidenceIds,
    setSelectedEvidenceIds,
    loadingEvidence,
    setLoadingEvidence,
    evidenceOverrideConfirmed,
    setEvidenceOverrideConfirmed,
    showEvidenceUploadModal,
    setShowEvidenceUploadModal,
    fetchEvidence,
    handleUploadEvidence,
    handleRemoveEvidence,
  };
}
