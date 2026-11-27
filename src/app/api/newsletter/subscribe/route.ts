import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/db/client';
import { emailSubscribers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { publicLimiter } from '@/lib/rate-limit';
import { rateLimited } from '@/lib/rate-limit-middleware';
import { readJsonBody } from '@/lib/request-validation';
import { logServerEvent } from '@/lib/server-logger';
import {
  CONFIRMATION_RESEND_COOLDOWN_MS,
  sendNewsletterConfirmationEmail,
} from '@/lib/newsletter-confirmation-email';
import { z } from 'zod';

const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 100;
const MAX_SOURCE_LENGTH = 120;

const INVALID_PAYLOAD_ERROR = 'Invalid request payload';
const EMAIL_REQUIRED_ERROR = 'Valid email is required';
const EMAIL_LENGTH_ERROR = 'Email must be 254 characters or fewer';
const FIRST_NAME_LENGTH_ERROR = 'First name must be 100 characters or fewer';
const LAST_NAME_LENGTH_ERROR = 'Last name must be 100 characters or fewer';
const SOURCE_LENGTH_ERROR = 'Source must be 120 characters or fewer';

// Every valid request gets this exact response (status and body), whether the
// address is new, pending, active, or previously unsubscribed. Differing replies
// would let anyone probe the list for a given email address.
function subscribedResponse() {
  return NextResponse.json({
    success: true,
    message: 'Almost done! Check your email and click the link to confirm your subscription.',
  }, { status: 201 });
}

// Double opt-in: nobody becomes 'active' from this endpoint. The confirmation
// email is sent after the response so new and existing addresses take about
// the same time to answer.
function sendConfirmationAfterResponse(subscriberId: string, email: string) {
  after(() => sendNewsletterConfirmationEmail(subscriberId, email));
}

const newsletterFieldErrors = new Set([
  EMAIL_REQUIRED_ERROR,
  EMAIL_LENGTH_ERROR,
  FIRST_NAME_LENGTH_ERROR,
  LAST_NAME_LENGTH_ERROR,
  SOURCE_LENGTH_ERROR,
]);

const newsletterSubscriptionSchema = z.object({
  email: z.string({ error: EMAIL_REQUIRED_ERROR })
    .trim()
    .min(1, EMAIL_REQUIRED_ERROR)
    .max(MAX_EMAIL_LENGTH, EMAIL_LENGTH_ERROR)
    .refine((email) => email.includes('@'), EMAIL_REQUIRED_ERROR),
  first_name: z.string({ error: INVALID_PAYLOAD_ERROR })
    .trim()
    .max(MAX_NAME_LENGTH, FIRST_NAME_LENGTH_ERROR)
    .optional(),
  last_name: z.string({ error: INVALID_PAYLOAD_ERROR })
    .trim()
    .max(MAX_NAME_LENGTH, LAST_NAME_LENGTH_ERROR)
    .optional(),
  source: z.string({ error: INVALID_PAYLOAD_ERROR })
    .trim()
    .max(MAX_SOURCE_LENGTH, SOURCE_LENGTH_ERROR)
    .optional(),
}).strict();

async function postHandler(request: NextRequest) {
  try {
    const parsed = await readJsonBody(request, newsletterSubscriptionSchema);

    if (parsed.kind === 'malformed_json') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (parsed.kind === 'invalid_payload') {
      return NextResponse.json(
        { error: getNewsletterValidationError(parsed.issues) },
        { status: 400 },
      );
    }

    const { email, first_name: firstName, last_name: lastName, source } = parsed.data;

    // Existing subscribers are handled silently; see subscribedResponse().
    const existing = await db
      .select()
      .from(emailSubscribers)
      .where(eq(emailSubscribers.email, email.toLowerCase()))
      .limit(1);

    const normalizedEmail = email.toLowerCase();

    if (existing.length > 0) {
      const subscriber = existing[0];
      const now = new Date();

      if (subscriber.status === 'unsubscribed') {
        // Coming back needs a fresh confirmation; the address is not reactivated
        // just because someone submitted it.
        await db.update(emailSubscribers).set({
          status: 'pending',
          updatedAt: now,
        }).where(eq(emailSubscribers.id, subscriber.id));
        sendConfirmationAfterResponse(subscriber.id, normalizedEmail);
      } else if (subscriber.status === 'pending') {
        // Resend, but not often enough to be used to flood an inbox.
        const lastSent = subscriber.updatedAt?.getTime() ?? 0;
        if (now.getTime() - lastSent >= CONFIRMATION_RESEND_COOLDOWN_MS) {
          await db.update(emailSubscribers).set({ updatedAt: now })
            .where(eq(emailSubscribers.id, subscriber.id));
          sendConfirmationAfterResponse(subscriber.id, normalizedEmail);
        }
      }
      // 'active' and 'bounced': nothing to do, and nothing to reveal.
      return subscribedResponse();
    }

    const id = randomUUID();
    const now = new Date();

    await db.insert(emailSubscribers).values({
      id,
      email: normalizedEmail,
      firstName,
      lastName,
      source: source || 'website',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    sendConfirmationAfterResponse(id, normalizedEmail);

    return subscribedResponse();
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.newsletter.subscribe.error', error: error });
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}

function getNewsletterValidationError(issues: readonly { message: string }[]): string {
  return issues.find((issue) => newsletterFieldErrors.has(issue.message))?.message
    ?? INVALID_PAYLOAD_ERROR;
}

export const POST = rateLimited(publicLimiter)(postHandler);
