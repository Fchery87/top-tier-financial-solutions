import { describe, expect, it } from 'vitest';
import {
  isClientOwnedEvidenceDocument,
  isControlledEvidenceDocumentKey,
} from '@/lib/evidence-documents';

describe('evidence document ownership', () => {
  it('accepts a controlled document key in the client-document namespace', () => {
    expect(isControlledEvidenceDocumentKey('client-documents/user-1/evidence/response.pdf')).toBe(true);
  });

  it('rejects public URLs and unrelated storage namespaces', () => {
    expect(isControlledEvidenceDocumentKey('https://example.com/response.pdf')).toBe(false);
    expect(isControlledEvidenceDocumentKey('credit-reports/report.pdf')).toBe(false);
  });

  it('accepts only a controlled document owned by the client user', () => {
    expect(isClientOwnedEvidenceDocument({
      clientUserId: 'user-1',
      document: {
        userId: 'user-1',
        fileUrl: 'client-documents/user-1/evidence/response.pdf',
      },
    })).toBe(true);

    expect(isClientOwnedEvidenceDocument({
      clientUserId: 'user-1',
      document: {
        userId: 'user-2',
        fileUrl: 'client-documents/user-2/evidence/response.pdf',
      },
    })).toBe(false);
  });
});
