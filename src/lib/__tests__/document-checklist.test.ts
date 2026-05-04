import { describe, expect, it } from 'vitest';
import { buildDocumentChecklist } from '@/lib/document-checklist';

describe('buildDocumentChecklist', () => {
  it('marks identity and proof-of-address checklist items from uploaded documents', () => {
    const checklist = buildDocumentChecklist([
      { fileType: 'identity_document' },
      { fileType: 'proof_of_address' },
    ]);

    expect(checklist).toEqual([
      { key: 'identity_document', label: 'Identity document', completed: true },
      { key: 'proof_of_address', label: 'Proof of address', completed: true },
    ]);
  });

  it('leaves required checklist items incomplete when matching documents are missing', () => {
    const checklist = buildDocumentChecklist([{ fileType: 'identity_document' }]);

    expect(checklist).toContainEqual({ key: 'identity_document', label: 'Identity document', completed: true });
    expect(checklist).toContainEqual({ key: 'proof_of_address', label: 'Proof of address', completed: false });
  });
});
