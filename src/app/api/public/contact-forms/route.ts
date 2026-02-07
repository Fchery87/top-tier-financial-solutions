import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { consultationRequests } from '@/db/schema';

interface ContactFormPayload {
  full_name?: string;
  email?: string;
  phone_number?: string;
  message?: string;
  source_page_slug?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ContactFormPayload;
    const fullName = body.full_name?.trim();
    const email = body.email?.trim();

    if (!fullName) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }

    const [firstName, ...lastNameParts] = fullName.split(/\s+/);
    const now = new Date();
    const id = randomUUID();

    await db.insert(consultationRequests).values({
      id,
      firstName,
      lastName: lastNameParts.join(' '),
      email,
      phoneNumber: body.phone_number?.trim() || null,
      message: body.message?.trim() || null,
      sourcePageSlug: body.source_page_slug || null,
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
    console.error('Error creating contact form submission:', error);
    return NextResponse.json({ error: 'Failed to submit contact form' }, { status: 500 });
  }
}
