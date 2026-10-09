import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { HighRiskConfirmationPanel } from '../HighRiskConfirmationPanel';
import { WizardGenerateControls } from '../WizardGenerateControls';
import type { EvidenceDocument, HighRiskItemClaim } from '../types';

const useWizardContextMock = vi.hoisted(() => vi.fn());
vi.mock('../WizardContext', () => ({ useWizardContext: useWizardContextMock }));

const documents: EvidenceDocument[] = [
  { id: 'doc-1', file_name: 'drivers-license.pdf', file_type: 'id_document', file_url: 'client-documents/u/1', created_at: '2026-10-01' },
  { id: 'doc-2', file_name: 'utility-bill.pdf', file_type: 'proof_of_address', file_url: 'client-documents/u/2', created_at: '2026-10-01' },
];

function claim(confirmation: HighRiskItemClaim['confirmation'], overrides: Partial<HighRiskItemClaim> = {}): HighRiskItemClaim {
  return {
    key: 'tradeline:neg-1:not_mine',
    itemKind: 'tradeline',
    itemId: 'neg-1',
    itemLabel: 'Bank One',
    bureau: 'experian',
    claimType: 'not_mine',
    confirmation,
    ...overrides,
  };
}

describe('HighRiskConfirmationPanel', () => {
  it('none: staff pick supporting documents and request the client confirmation', () => {
    const onRequestConfirmation = vi.fn();
    const noneClaim = claim({ state: 'none' });
    render(<HighRiskConfirmationPanel claims={[noneClaim]} evidenceDocuments={documents} onRequestConfirmation={onRequestConfirmation} onRefresh={vi.fn()} />);

    const panel = screen.getByTestId('client-confirmation-tradeline:neg-1:not_mine');
    expect(panel).toHaveTextContent('Bank One');
    expect(panel).toHaveTextContent('Experian');
    expect(panel).toHaveTextContent('Not my account');

    const request = within(panel).getByRole('button', { name: 'Request client confirmation' });
    expect(request).toBeDisabled();

    fireEvent.click(within(panel).getByText('drivers-license.pdf'));
    expect(request).toBeEnabled();
    fireEvent.click(request);

    expect(onRequestConfirmation).toHaveBeenCalledWith(noneClaim, ['doc-1']);
  });

  it('awaiting_client_confirmation: waits for the portal and can be refreshed', () => {
    const onRefresh = vi.fn();
    const awaitingClaim = claim({ state: 'awaiting_client_confirmation', packetId: 'packet-1' });
    render(<HighRiskConfirmationPanel claims={[awaitingClaim]} evidenceDocuments={documents} onRequestConfirmation={vi.fn()} onRefresh={onRefresh} />);

    const panel = screen.getByTestId('client-confirmation-tradeline:neg-1:not_mine');
    expect(panel).toHaveTextContent('Waiting for the client to confirm in their portal');
    expect(within(panel).queryByRole('button', { name: 'Request client confirmation' })).not.toBeInTheDocument();

    fireEvent.click(within(panel).getByRole('button', { name: 'Refresh' }));
    expect(onRefresh).toHaveBeenCalledWith(awaitingClaim);
  });

  it('confirmed: shows the client confirmation with a check mark', () => {
    render(<HighRiskConfirmationPanel claims={[claim({ state: 'confirmed', packetId: 'packet-1' })]} evidenceDocuments={documents} onRequestConfirmation={vi.fn()} onRefresh={vi.fn()} />);

    const panel = screen.getByTestId('client-confirmation-tradeline:neg-1:not_mine');
    expect(panel).toHaveTextContent('Client confirmed');
    expect(within(panel).getByTestId('client-confirmed-check')).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Request client confirmation' })).not.toBeInTheDocument();
  });

  it('offers no way for staff to confirm for the client', () => {
    render(<HighRiskConfirmationPanel claims={[claim({ state: 'awaiting_client_confirmation', packetId: 'packet-1' })]} evidenceDocuments={documents} onRequestConfirmation={vi.fn()} onRefresh={vi.fn()} />);

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/override/i)).not.toBeInTheDocument();
  });
});

describe('WizardGenerateControls', () => {
  function context(overrides: Record<string, unknown> = {}) {
    return {
      generating: false,
      analyzingItems: false,
      analysisProgress: 0,
      estimatedTimeRemaining: null,
      generationProgress: 0,
      generationMethod: 'template',
      combineItemsPerBureau: false,
      canProceed: () => true,
      validateCurrentStep: () => true,
      analyzeItemsWithAI: vi.fn(),
      generateLetters: vi.fn(),
      highRiskClaims: [],
      readyItemCount: 0,
      ...overrides,
    };
  }

  beforeEach(() => useWizardContextMock.mockReset());

  it('disables Generate and lists the blockers in plain words while a high-risk item is not confirmed', () => {
    useWizardContextMock.mockReturnValue(context({
      highRiskClaims: [
        claim({ state: 'awaiting_client_confirmation', packetId: 'packet-1' }),
        claim({ state: 'none' }, { key: 'inquiry:inq-1:unauthorized_inquiry', itemKind: 'inquiry', itemId: 'inq-1', itemLabel: 'Inquiry Bank', claimType: 'unauthorized_inquiry' }),
      ],
      readyItemCount: 0,
    }));

    render(<WizardGenerateControls />);

    expect(screen.getByRole('button', { name: /Generate Letters/ })).toBeDisabled();
    const blockers = screen.getByTestId('high-risk-blockers');
    expect(blockers).toHaveTextContent('Bank One (Experian), Not my account: waiting for the client to confirm in their portal');
    expect(blockers).toHaveTextContent('Inquiry Bank (Experian), Unauthorized inquiry: client confirmation has not been requested');
  });

  it('lets staff generate the ready items while another item is blocked', () => {
    const generateLetters = vi.fn();
    useWizardContextMock.mockReturnValue(context({
      highRiskClaims: [claim({ state: 'awaiting_client_confirmation', packetId: 'packet-1' })],
      readyItemCount: 2,
      combineItemsPerBureau: true,
      generateLetters,
    }));

    render(<WizardGenerateControls />);

    expect(screen.getByRole('button', { name: /Generate Letters/ })).toBeDisabled();
    expect(screen.getByTestId('high-risk-blockers')).toHaveTextContent('The combined letter will leave out blocked items');
    fireEvent.click(screen.getByRole('button', { name: 'Generate 2 ready items' }));
    expect(generateLetters).toHaveBeenCalledWith(null, { readyOnly: true });
  });

  it('enables Generate once every high-risk item is confirmed', () => {
    useWizardContextMock.mockReturnValue(context({
      highRiskClaims: [claim({ state: 'confirmed', packetId: 'packet-1' })],
      readyItemCount: 1,
    }));

    render(<WizardGenerateControls />);

    expect(screen.getByRole('button', { name: /Generate Letters/ })).toBeEnabled();
    expect(screen.queryByTestId('high-risk-blockers')).not.toBeInTheDocument();
  });
});
