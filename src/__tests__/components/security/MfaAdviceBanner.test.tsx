import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MfaAdviceBanner } from '@/components/security/MfaAdviceBanner';

describe('MfaAdviceBanner', () => {
  it('strongly recommends two-factor and links to enrollment for team members', () => {
    render(<MfaAdviceBanner audience="team" />);

    const region = screen.getByRole('region', { name: /security recommendation/i });
    expect(region).toHaveTextContent(/turn on two-factor authentication/i);
    expect(region).toHaveTextContent(/strongly recommend/i);
    expect(region).toHaveTextContent(/client credit files/i);
    expect(screen.getByRole('link', { name: /set up now/i })).toHaveAttribute('href', '/settings/security');
  });

  it('uses client-appropriate wording for portal clients', () => {
    render(<MfaAdviceBanner audience="client" />);

    expect(screen.getByRole('region')).toHaveTextContent(/your credit and personal information/i);
    expect(screen.getByRole('region')).not.toHaveTextContent(/client credit files/i);
  });

  it('cannot be dismissed', () => {
    render(<MfaAdviceBanner audience="team" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
