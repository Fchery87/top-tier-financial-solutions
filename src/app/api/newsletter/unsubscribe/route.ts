import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { emailSubscribers } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(emailSubscribers)
      .where(eq(emailSubscribers.email, email.toLowerCase()))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Email not found in our list.' 
      });
    }

    await db.update(emailSubscribers).set({
      status: 'unsubscribed',
      unsubscribedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(emailSubscribers.email, email.toLowerCase()));

    return NextResponse.json({ 
      success: true, 
      message: 'You have been unsubscribed.' 
    });
  } catch (error) {
    console.error('Error unsubscribing:', error);
    return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
  }
}
