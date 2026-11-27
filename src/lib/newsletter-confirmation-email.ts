import 'server-only';

import { sendCustomEmail } from '@/lib/email-service';
import { buildConfirmUrl } from '@/lib/newsletter-confirm-token';
import { logServerEvent } from '@/lib/server-logger';

/** Minimum gap between confirmation emails to the same address. */
export const CONFIRMATION_RESEND_COOLDOWN_MS = 10 * 60 * 1000;

/**
 * Sends the double opt-in email. Never throws: the subscribe endpoint answers every
 * request identically, so a delivery failure is logged rather than surfaced.
 */
export async function sendNewsletterConfirmationEmail(subscriberId: string, email: string): Promise<void> {
  try {
    const url = buildConfirmUrl(subscriberId);
    const company = process.env.COMPANY_NAME || 'Top Tier Financial Solutions';
    const subject = `Confirm your subscription to ${company}`;
    const html = `<p>Please confirm that you want to receive the ${company} newsletter.</p>`
      + `<p><a href="${url}">Confirm my subscription</a></p>`
      + `<p>The link expires in 7 days. If you didn't ask for this, you can ignore this email and you won't be subscribed.</p>`;
    const text = `Please confirm that you want to receive the ${company} newsletter:\n\n${url}\n\n`
      + `The link expires in 7 days. If you didn't ask for this, ignore this email and you won't be subscribed.`;

    const result = await sendCustomEmail(email, subject, html, {
      text,
      metadata: { kind: 'newsletter_confirmation', subscriberId },
    });
    if (!result.success) {
      logServerEvent({
        level: 'error',
        event: 'server.app.api.newsletter.confirmation.send_failed',
        error: new Error(result.error || 'Unknown email failure'),
      });
    }
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.newsletter.confirmation.send_error', error });
  }
}
