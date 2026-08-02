import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { StepConfigure } from '../StepConfigure';

const useWizardContextMock = vi.hoisted(() => vi.fn());

vi.mock('../WizardContext', () => ({ useWizardContext: useWizardContextMock }));

function buildContext(targetRecipient: 'bureau' | 'creditor' | 'collector' | 'cfpb') {
  return {
    selectedClient: targetRecipient === 'cfpb' ? { id: 'client-1' } : null,
    selectedBureaus: ['experian'],
    disputeRound: targetRecipient === 'bureau' ? 1 : targetRecipient === 'cfpb' ? 3 : 2,
    setDisputeRound: vi.fn(),
    targetRecipient,
    setTargetRecipient: vi.fn(),
    priorDisputeId: targetRecipient === 'cfpb' ? 'cra-dispute-1' : '',
    setPriorDisputeId: vi.fn(),
    selectedMethodology: 'factual',
    setSelectedMethodology: vi.fn(),
    recommendedMethodology: null,
    methodologies: [],
    loadingMethodologies: false,
    generationMethod: 'ai',
    setGenerationMethod: vi.fn(),
    combineItemsPerBureau: false,
    setCombineItemsPerBureau: vi.fn(),
    requestManualReview: false,
    setRequestManualReview: vi.fn(),
    handleToggleBureau: vi.fn(),
    selectedItems: targetRecipient === 'cfpb' ? ['item-1'] : [],
    selectedPersonalItems: [],
    selectedInquiryItems: [],
    evidenceDocuments: [],
    selectedEvidenceIds: [],
    setSelectedEvidenceIds: vi.fn(),
    loadingEvidence: false,
    evidenceOverrideConfirmed: false,
    setEvidenceOverrideConfirmed: vi.fn(),
    setShowEvidenceUploadModal: vi.fn(),
    selectedReasonCodes: [],
    creditReports: [],
    selectedReportId: null,
    setSelectedReportId: vi.fn(),
    discrepancySummary: null,
    loadingDiscrepancies: false,
    confidenceThreshold: 0.5,
    setConfidenceThreshold: vi.fn(),
    showLowConfidenceItems: false,
    setShowLowConfidenceItems: vi.fn(),
    analysisAggressiveness: 'balanced',
    setAnalysisAggressiveness: vi.fn(),
    analysisPreferencesSaved: false,
    saveAnalysisPreferences: vi.fn(),
    renderValidationMessages: () => null,
  };
}

describe('StepConfigure direct-dispute advisory', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['creditor', 'collector'] as const)('shows an advisory for %s without blocking the configuration', (targetRecipient) => {
    useWizardContextMock.mockReturnValue(buildContext(targetRecipient));

    render(<StepConfigure />);

    expect(screen.getByTestId('direct-dispute-advisory')).toHaveTextContent('Regulation V');
    expect(screen.getByTestId('direct-dispute-advisory')).toHaveTextContent('advisory; you can continue');
    expect(screen.queryByText('CFPB complaint packet selected')).not.toBeInTheDocument();
  });

  it('does not show the direct-dispute advisory for a bureau recipient', () => {
    useWizardContextMock.mockReturnValue(buildContext('bureau'));

    render(<StepConfigure />);

    expect(screen.queryByTestId('direct-dispute-advisory')).not.toBeInTheDocument();
  });

  it('shows the server eligibility reason and date for a CFPB predecessor', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      eligible: false,
      reason: 'still_pending',
      eligible_at: '2026-08-15T00:00:00.000Z',
      message: 'CFPB escalation is deferred until 2026-08-15T00:00:00.000Z.',
    }), { status: 200 })) as typeof fetch;
    useWizardContextMock.mockReturnValue(buildContext('cfpb'));

    render(<StepConfigure />);

    await waitFor(() => expect(screen.getByTestId('cfpb-eligibility-preview')).toBeInTheDocument());
    expect(screen.getByTestId('cfpb-eligibility-preview')).toHaveTextContent('still pending');
    expect(screen.getByTestId('cfpb-eligibility-preview')).toHaveTextContent('August 15, 2026');
  });
});
