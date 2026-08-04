interface EvidenceDocumentOwnershipInput {
  clientUserId: string | null;
  document: {
    userId: string;
    fileUrl: string;
  };
}

const CONTROLLED_EVIDENCE_KEY_PREFIX = 'client-documents/';

export function isControlledEvidenceDocumentKey(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(CONTROLLED_EVIDENCE_KEY_PREFIX);
}

export function isClientOwnedEvidenceDocument({
  clientUserId,
  document,
}: EvidenceDocumentOwnershipInput): boolean {
  return clientUserId !== null
    && document.userId === clientUserId
    && isControlledEvidenceDocumentKey(document.fileUrl);
}
