export type DocumentChecklistInput = {
  fileType: string | null;
};

const requiredDocumentChecklist = [
  { key: 'identity_document', label: 'Identity document', matchingTypes: ['identity_document', 'id_document', 'government_id'] },
  { key: 'proof_of_address', label: 'Proof of address', matchingTypes: ['proof_of_address'] },
] as const;

export function buildDocumentChecklist(documents: DocumentChecklistInput[]) {
  const uploadedTypes = new Set(documents.map((document) => document.fileType).filter(Boolean));

  return requiredDocumentChecklist.map((item) => ({
    key: item.key,
    label: item.label,
    completed: item.matchingTypes.some((type) => uploadedTypes.has(type)),
  }));
}
