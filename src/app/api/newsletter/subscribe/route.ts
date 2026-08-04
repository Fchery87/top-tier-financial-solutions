import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { emailSubscribers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { publicLimiter } from '@/lib/rate-limit';
import { rateLimited } from '@/lib/rate-limit-middleware';

const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 100;
const MAX_SOURCE_LENGTH = 120;

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
    const email = readTextField(body, 'email');
    const firstName = readTextField(body, 'first_name');
    const lastName = readTextField(body, 'last_name');
    const source = readTextField(body, 'source');

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    if (email.length > MAX_EMAIL_LENGTH) {
      return NextResponse.json(
        { error: 'Email must be 254 characters or fewer' },
        { status: 400 },
      );
    }

    if (firstName && firstName.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: 'First name must be 100 characters or fewer' },
        { status: 400 },
      );
    }

    if (lastName && lastName.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: 'Last name must be 100 characters or fewer' },
        { status: 400 },
      );
    }

    if (source && source.length > MAX_SOURCE_LENGTH) {
      return NextResponse.json(
        { error: 'Source must be 120 characters or fewer' },
        { status: 400 },
      );
    }

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
    console.error('Error subscribing:', error);
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}

export const POST = rateLimited(publicLimiter)(postHandler);
