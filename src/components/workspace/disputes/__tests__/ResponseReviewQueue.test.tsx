import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResponseReviewQueue } from '@/components/workspace/disputes/ResponseReviewQueue';

describe('ResponseReviewQueue', () => {
  it('shows overdue reviews before later deadlines', () => {
    render(
      <ResponseReviewQueue
        disputes={[
          { id: 'later', clientName: 'Later Client', bureau: 'experian', round: 1, responseDeadline: '2099-01-10T00:00:00.000Z' },
          { id: 'overdue', clientName: 'Overdue Client', bureau: 'equifax', round: 2, responseDeadline: '2020-01-01T00:00:00.000Z' },
        ]}
        onReview={vi.fn()}
      />,
    );

    const labels = screen.getAllByRole('button', { name: /review response/i }).map(button => button.parentElement?.textContent);
    expect(labels[0]).toContain('Overdue Client');
    expect(labels[1]).toContain('Later Client');
    expect(screen.getByText(/overdue since/i)).toBeInTheDocument();
  });

  it('renders an empty state when no responses need review', () => {
    render(<ResponseReviewQueue disputes={[]} onReview={vi.fn()} />);

    expect(screen.getByText('No response reviews are waiting.')).toBeInTheDocument();
  });

  it('opens the selected dispute for review', () => {
    const onReview = vi.fn();
    const dispute = { id: 'review-1', clientName: 'Review Client', bureau: 'transunion', round: 1, responseDeadline: null };
    render(<ResponseReviewQueue disputes={[dispute]} onReview={onReview} />);

    fireEvent.click(screen.getByRole('button', { name: /review response/i }));

    expect(onReview).toHaveBeenCalledWith(dispute);
  });
});
