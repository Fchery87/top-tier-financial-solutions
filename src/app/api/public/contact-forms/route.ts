import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { consultationRequests } from '@/db/schema';
import { publicLimiter } from '@/lib/rate-limit';
import { rateLimited } from '@/lib/rate-limit-middleware';
import { readJsonBody } from '@/lib/request-validation';
import { logServerEvent } from '@/lib/server-logger';
import { z } from 'zod';

const MAX_FULL_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_MESSAGE_LENGTH = 5_000;
const MAX_PHONE_NUMBER_LENGTH = 50;
const MAX_SOURCE_PAGE_SLUG_LENGTH = 120;

const INVALID_PAYLOAD_ERROR = 'Invalid request payload';
const FULL_NAME_REQUIRED_ERROR = 'Full name is required';
const FULL_NAME_LENGTH_ERROR = 'Full name must be 120 characters or fewer';
const EMAIL_REQUIRED_ERROR = 'A valid email is required';
const EMAIL_LENGTH_ERROR = 'Email must be 254 characters or fewer';
const MESSAGE_LENGTH_ERROR = 'Message must be 5000 characters or fewer';
const PHONE_NUMBER_LENGTH_ERROR = 'Phone number must be 50 characters or fewer';
const SOURCE_PAGE_SLUG_LENGTH_ERROR = 'Source page slug must be 120 characters or fewer';

const contactFormFieldErrors = new Set([
  FULL_NAME_REQUIRED_ERROR,
  FULL_NAME_LENGTH_ERROR,
  EMAIL_REQUIRED_ERROR,
  EMAIL_LENGTH_ERROR,
  MESSAGE_LENGTH_ERROR,
  PHONE_NUMBER_LENGTH_ERROR,
  SOURCE_PAGE_SLUG_LENGTH_ERROR,
]);

const contactFormSchema = z.object({
  full_name: z.string({ error: FULL_NAME_REQUIRED_ERROR })
    .trim()
    .min(1, FULL_NAME_REQUIRED_ERROR)
    .max(MAX_FULL_NAME_LENGTH, FULL_NAME_LENGTH_ERROR),
  email: z.string({ error: EMAIL_REQUIRED_ERROR })
    .trim()
    .min(1, EMAIL_REQUIRED_ERROR)
    .max(MAX_EMAIL_LENGTH, EMAIL_LENGTH_ERROR)
    .refine(isValidEmail, EMAIL_REQUIRED_ERROR),
  message: z.string({ error: INVALID_PAYLOAD_ERROR })
    .trim()
    .max(MAX_MESSAGE_LENGTH, MESSAGE_LENGTH_ERROR)
    .optional(),
  phone_number: z.string({ error: INVALID_PAYLOAD_ERROR })
    .trim()
    .max(MAX_PHONE_NUMBER_LENGTH, PHONE_NUMBER_LENGTH_ERROR)
    .optional(),
  source_page_slug: z.string({ error: INVALID_PAYLOAD_ERROR })
    .trim()
    .max(MAX_SOURCE_PAGE_SLUG_LENGTH, SOURCE_PAGE_SLUG_LENGTH_ERROR)
    .optional(),
}).strict();

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function postHandler(request: NextRequest) {
  try {
    const parsed = await readJsonBody(request, contactFormSchema);

    if (parsed.kind === 'malformed_json') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (parsed.kind === 'invalid_payload') {
      return NextResponse.json(
        { error: getContactFormValidationError(parsed.issues) },
        { status: 400 },
      );
    }

    const { full_name: fullName, email, message, phone_number: phoneNumber, source_page_slug: sourcePageSlug } = parsed.data;

    const [firstName, ...lastNameParts] = fullName.split(/\s+/);
    const now = new Date();
    const id = randomUUID();

    await db.insert(consultationRequests).values({
      id,
      firstName,
      lastName: lastNameParts.join(' '),
      email,
      phoneNumber: phoneNumber || null,
      message: message || null,
      sourcePageSlug: sourcePageSlug || null,
      status: 'new',
      requestedAt: now,
      updatedAt: now,
    });

    return NextResponse.json(
      {
        id,
        message: 'Contact form submitted successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.public.contact.forms.error', error: error });
    return NextResponse.json({ error: 'Failed to submit contact form' }, { status: 500 });
  }
}

function getContactFormValidationError(issues: readonly { message: string }[]): string {
  return issues.find((issue) => contactFormFieldErrors.has(issue.message))?.message
    ?? INVALID_PAYLOAD_ERROR;
}

export const POST = rateLimited(publicLimiter)(postHandler);
