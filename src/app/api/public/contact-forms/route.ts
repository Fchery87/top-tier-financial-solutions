import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { consultationRequests } from '@/db/schema';
import { publicLimiter } from '@/lib/rate-limit';
import { rateLimited } from '@/lib/rate-limit-middleware';
import { logServerEvent } from '@/lib/server-logger';

const MAX_FULL_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_MESSAGE_LENGTH = 5_000;
const MAX_PHONE_NUMBER_LENGTH = 50;
const MAX_SOURCE_PAGE_SLUG_LENGTH = 120;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readTextField(body: unknown, field: string): string | undefined {
  if (!isRecord(body)) return undefined;
  const value = body[field];
  return typeof value === 'string' ? value.trim() || undefined : undefined;
}

async function postHandler(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const fullName = readTextField(body, 'full_name');
    const email = readTextField(body, 'email');
    const message = readTextField(body, 'message');
    const phoneNumber = readTextField(body, 'phone_number');
    const sourcePageSlug = readTextField(body, 'source_page_slug');

    if (!fullName) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }

    if (fullName.length > MAX_FULL_NAME_LENGTH) {
      return NextResponse.json(
        { error: 'Full name must be 120 characters or fewer' },
        { status: 400 },
      );
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }

    if (email.length > MAX_EMAIL_LENGTH) {
      return NextResponse.json(
        { error: 'Email must be 254 characters or fewer' },
        { status: 400 },
      );
    }

    if (message && message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: 'Message must be 5000 characters or fewer' },
        { status: 400 },
      );
    }

    if (phoneNumber && phoneNumber.length > MAX_PHONE_NUMBER_LENGTH) {
      return NextResponse.json(
        { error: 'Phone number must be 50 characters or fewer' },
        { status: 400 },
      );
    }

    if (sourcePageSlug && sourcePageSlug.length > MAX_SOURCE_PAGE_SLUG_LENGTH) {
      return NextResponse.json(
        { error: 'Source page slug must be 120 characters or fewer' },
        { status: 400 },
      );
    }

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

export const POST = rateLimited(publicLimiter)(postHandler);
