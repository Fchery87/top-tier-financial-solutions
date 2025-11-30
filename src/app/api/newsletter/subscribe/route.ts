import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { emailSubscribers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, first_name, last_name, source } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
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
      firstName: first_name,
      lastName: last_name,
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
