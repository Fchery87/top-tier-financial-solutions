import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const refreshMock = vi.hoisted(() => vi.fn());
const twoFactorMock = vi.hoisted(() => ({
  enable: vi.fn(),
  verifyTotp: vi.fn(),
  generateBackupCodes: vi.fn(),
  disable: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/auth-client', () => ({ twoFactor: twoFactorMock }));

import { TwoFactorSettings, secretFromTotpUri } from '@/components/settings/TwoFactorSettings';

const TOTP_URI = 'otpauth://totp/Top%20Tier:user%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Top%20Tier';
const BACKUP_CODES = ['aaaa-1111', 'bbbb-2222'];

type Props = Partial<React.ComponentProps<typeof TwoFactorSettings>>;

function setup(props: Props = {}) {
  const user = userEvent.setup();
  render(
    <TwoFactorSettings
      enabled={false}
      required={false}
      enrollmentRequired={false}
      continueHref="/workspace"
      {...props}
    />,
  );
  return user;
}

async function submitPassword(user: ReturnType<typeof userEvent.setup>, buttonName: RegExp, password = 'correct horse') {
  await user.type(await screen.findByLabelText(/enter your password/i), password);
  await user.click(screen.getByRole('button', { name: buttonName }));
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('secretFromTotpUri', () => {
  it('extracts the shared secret from an otpauth URI', () => {
    expect(secretFromTotpUri(TOTP_URI)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('returns an empty string for a missing secret or an invalid URI', () => {
    expect(secretFromTotpUri('otpauth://totp/x')).toBe('');
    expect(secretFromTotpUri('not a uri')).toBe('');
  });
});

describe('TwoFactorSettings - status and actions', () => {
  it('offers setup when 2FA is off', () => {
    setup({ enabled: false });

    expect(screen.getByText(/^Off\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /set up two-factor/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /turn off/i })).not.toBeInTheDocument();
  });

  it('offers new backup codes and turning off when 2FA is on for a non-team user', () => {
    setup({ enabled: true, required: false });

    expect(screen.getByText(/^On\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new backup codes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^turn off$/i })).toBeInTheDocument();
  });

  it('does not allow team accounts to turn 2FA off', () => {
    setup({ enabled: true, required: true });

    expect(screen.queryByRole('button', { name: /^turn off$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/required for team accounts, so it can.t be turned off/i)).toBeInTheDocument();
  });

  it('shows the enrollment notice only when enrollment is required', () => {
    setup({ enrollmentRequired: true });
    expect(screen.getByRole('status')).toHaveTextContent(/team accounts must use two-factor/i);
  });
});

describe('TwoFactorSettings - enrolling', () => {
  it('walks through password, QR scan, code confirmation and backup codes', async () => {
    twoFactorMock.enable.mockResolvedValue({ data: { method: 'totp', totpURI: TOTP_URI, backupCodes: BACKUP_CODES }, error: null });
    twoFactorMock.verifyTotp.mockResolvedValue({ data: {}, error: null });
    const user = setup();

    await user.click(screen.getByRole('button', { name: /set up two-factor/i }));
    await submitPassword(user, /^continue$/i);

    expect(twoFactorMock.enable).toHaveBeenCalledWith({ password: 'correct horse' });
    expect(await screen.findByTitle('Two-factor authentication QR code')).toBeInTheDocument();
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/6-digit code/i), '123 456');
    await user.click(screen.getByRole('button', { name: /^turn on$/i }));

    // Spaces are stripped before verification.
    expect(twoFactorMock.verifyTotp).toHaveBeenCalledWith({ code: '123456' });
    expect(await screen.findByText(/two-factor authentication is on/i)).toBeInTheDocument();
    for (const code of BACKUP_CODES) expect(screen.getByText(code)).toBeInTheDocument();
  });

  it('shows a plain-language error and stays on the password step for a wrong password', async () => {
    twoFactorMock.enable.mockResolvedValue({ data: null, error: { code: 'INVALID_PASSWORD' } });
    const user = setup();

    await user.click(screen.getByRole('button', { name: /set up two-factor/i }));
    await submitPassword(user, /^continue$/i, 'wrong');

    expect(await screen.findByRole('alert')).toHaveTextContent("That password isn't correct.");
    expect(screen.getByLabelText(/enter your password/i)).toBeInTheDocument();
    expect(screen.queryByTitle('Two-factor authentication QR code')).not.toBeInTheDocument();
  });

  it('refuses a non-TOTP (email OTP) enrollment result from better-auth 1.7+', async () => {
    twoFactorMock.enable.mockResolvedValue({ data: { method: 'otp' }, error: null });
    const user = setup();

    await user.click(screen.getByRole('button', { name: /set up two-factor/i }));
    await submitPassword(user, /^continue$/i);

    expect(await screen.findByRole('alert')).toHaveTextContent(/authenticator setup is unavailable/i);
    expect(screen.queryByTitle('Two-factor authentication QR code')).not.toBeInTheDocument();
  });

  it('keeps the user on the scan step with an error when the code is wrong', async () => {
    twoFactorMock.enable.mockResolvedValue({ data: { method: 'totp', totpURI: TOTP_URI, backupCodes: BACKUP_CODES }, error: null });
    twoFactorMock.verifyTotp.mockResolvedValue({ data: null, error: { code: 'INVALID_CODE' } });
    const user = setup();

    await user.click(screen.getByRole('button', { name: /set up two-factor/i }));
    await submitPassword(user, /^continue$/i);
    await user.type(await screen.findByLabelText(/6-digit code/i), '000000');
    await user.click(screen.getByRole('button', { name: /^turn on$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/that code didn.t work/i);
    expect(screen.queryByText(BACKUP_CODES[0])).not.toBeInTheDocument();
  });

  it('shows a generic error when the request throws', async () => {
    twoFactorMock.enable.mockRejectedValue(new Error('network'));
    const user = setup();

    await user.click(screen.getByRole('button', { name: /set up two-factor/i }));
    await submitPassword(user, /^continue$/i);

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });

  it('sends a required team member on to the workspace once backup codes are saved', async () => {
    twoFactorMock.enable.mockResolvedValue({ data: { method: 'totp', totpURI: TOTP_URI, backupCodes: BACKUP_CODES }, error: null });
    twoFactorMock.verifyTotp.mockResolvedValue({ data: {}, error: null });
    const user = setup({ required: true, enrollmentRequired: true, continueHref: '/workspace/dashboard' });

    await user.click(screen.getByRole('button', { name: /set up two-factor/i }));
    await submitPassword(user, /^continue$/i);
    await user.type(await screen.findByLabelText(/6-digit code/i), '123456');
    await user.click(screen.getByRole('button', { name: /^turn on$/i }));

    const link = await screen.findByRole('link', { name: /i saved my codes, continue/i });
    expect(link).toHaveAttribute('href', '/workspace/dashboard');
  });

  it('cancel returns to the start without calling the API', async () => {
    const user = setup();

    await user.click(screen.getByRole('button', { name: /set up two-factor/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.getByRole('button', { name: /set up two-factor/i })).toBeInTheDocument();
    expect(twoFactorMock.enable).not.toHaveBeenCalled();
  });
});

describe('TwoFactorSettings - managing', () => {
  it('regenerates backup codes and refreshes the page when done', async () => {
    twoFactorMock.generateBackupCodes.mockResolvedValue({ data: { backupCodes: BACKUP_CODES }, error: null });
    const user = setup({ enabled: true });

    await user.click(screen.getByRole('button', { name: /new backup codes/i }));
    expect(screen.getByText(/old backup codes will stop working/i)).toBeInTheDocument();
    await submitPassword(user, /get new codes/i);

    expect(twoFactorMock.generateBackupCodes).toHaveBeenCalledWith({ password: 'correct horse' });
    expect(await screen.findByText(BACKUP_CODES[0])).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /i saved my codes/i }));
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('turns 2FA off after password confirmation and refreshes', async () => {
    twoFactorMock.disable.mockResolvedValue({ data: {}, error: null });
    const user = setup({ enabled: true, required: false });

    await user.click(screen.getByRole('button', { name: /^turn off$/i }));
    expect(screen.getByText(/protected by your password only/i)).toBeInTheDocument();
    await submitPassword(user, /^turn off$/i);

    await waitFor(() => expect(twoFactorMock.disable).toHaveBeenCalledWith({ password: 'correct horse' }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it('keeps 2FA on and shows the server message when the role requires it', async () => {
    twoFactorMock.disable.mockResolvedValue({ data: null, error: { code: 'MFA_REQUIRED_FOR_ROLE' } });
    const user = setup({ enabled: true, required: false });

    await user.click(screen.getByRole('button', { name: /^turn off$/i }));
    await submitPassword(user, /^turn off$/i);

    expect(await screen.findByRole('alert')).toHaveTextContent(/team accounts must keep two-factor/i);
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
