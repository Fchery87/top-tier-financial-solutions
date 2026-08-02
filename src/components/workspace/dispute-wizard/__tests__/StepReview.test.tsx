import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepReview } from '../StepReview';

const useWizardContextMock = vi.hoisted(() => vi.fn());
const letterStudioMock = vi.hoisted(() => vi.fn(({ disputeId }: { disputeId: string }) => <div data-testid="letter-studio">{disputeId}</div>));

vi.mock('../WizardContext', () => ({ useWizardContext: useWizardContextMock }));
vi.mock('@/components/workspace/disputes/LetterStudio', () => ({ LetterStudio: letterStudioMock }));

function buildContext() {
  return {
    generationMethod: 'ai',
    aiAnalysisResults: [],
    aiAnalysisSummary: null,
    confidenceThreshold: 0.5,
    generatedLetters: [{
      id: 'draft-1',
      content: 'Generated draft',
      bureau: 'experian',
      round: 1,
      disputeType: 'standard',
      reasonCodes: ['verification_required'],
      items: [{ id: 'item-1', kind: 'tradeline', creditorName: 'Example Bank' }],
      combined: false,
    }],
    setGeneratedLetters: vi.fn(),
    bulkTrackingNumber: '',
    setBulkTrackingNumber: vi.fn(),
    bulkSendDate: '',
    setBulkSendDate: vi.fn(),
    markingAsSent: false,
    bulkSentSuccess: false,
    handleBulkMarkAsSent: vi.fn(),
    selectedEvidenceIds: [],
    evidenceDocuments: [],
    setShowEvidenceUploadModal: vi.fn(),
    handleRemoveEvidence: vi.fn(),
    copyToClipboard: vi.fn(),
    downloadLetter: vi.fn(),
    renderValidationMessages: () => null,
  };
}

describe('StepReview Letter Studio integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mounts Letter Studio with the persisted generated dispute ID', () => {
    useWizardContextMock.mockReturnValue(buildContext());

    render(<StepReview />);

    expect(screen.getByTestId('letter-studio')).toHaveTextContent('draft-1');
    expect(letterStudioMock.mock.calls[0]?.[0]).toMatchObject({
      disputeId: 'draft-1',
      initialLetter: 'Generated draft',
    });
  });
});
