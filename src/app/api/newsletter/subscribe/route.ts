import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { emailSubscribers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { publicLimiter } from '@/lib/rate-limit';
import { rateLimited } from '@/lib/rate-limit-middleware';
import { readJsonBody } from '@/lib/request-validation';
import { logServerEvent } from '@/lib/server-logger';
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

    // Check if already subscribed
    const existing = await db
      .select()
      .from(emailSubscribers)
      .where(eq(emailSubscribers.email, email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      if (existing[0].status === 'unsubscribed') {
        // Resubscribe
        await db.update(emailSubscribers).set({
          status: 'active',
          subscribedAt: new Date(),
          unsubscribedAt: null,
          updatedAt: new Date(),
        }).where(eq(emailSubscribers.email, email.toLowerCase()));

        return NextResponse.json({ 
          success: true, 
          message: 'Welcome back! You have been resubscribed.' 
        });
      }
      return NextResponse.json({ 
        success: true, 
        message: 'You are already subscribed!' 
      });
    }

    const id = randomUUID();
    const now = new Date();

    await db.insert(emailSubscribers).values({
      id,
      email: email.toLowerCase(),
      firstName,
      lastName,
      source: source || 'website',
      status: 'active',
      subscribedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Thank you for subscribing!' 
    }, { status: 201 });
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
