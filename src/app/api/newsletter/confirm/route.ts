import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { emailSubscribers } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { publicLimiter } from '@/lib/rate-limit';
import { rateLimited } from '@/lib/rate-limit-middleware';
import { readJsonBody } from '@/lib/request-validation';
import { logServerEvent } from '@/lib/server-logger';
import { verifyConfirmToken } from '@/lib/newsletter-confirm-token';

const confirmSchema = z.object({
  token: z.string({ error: 'Invalid request payload' }).trim().min(1).max(512),
}).strict();

const INVALID_LINK_ERROR = 'This confirmation link is invalid or has expired.';

async function postHandler(request: NextRequest) {
  try {
    const parsed = await readJsonBody(request, confirmSchema);
    if (parsed.kind !== 'valid') {
      return NextResponse.json({ error: INVALID_LINK_ERROR }, { status: 400 });
    }

    const subscriberId = verifyConfirmToken(parsed.data.token);
    if (!subscriberId) {
      return NextResponse.json({ error: INVALID_LINK_ERROR }, { status: 400 });
    }

    // Only a pending subscriber is activated. Someone who unsubscribed after
    // requesting the link stays unsubscribed, and repeat clicks are harmless.
    const now = new Date();
    await db
      .update(emailSubscribers)
      .set({ status: 'active', subscribedAt: now, unsubscribedAt: null, updatedAt: now })
      .where(and(eq(emailSubscribers.id, subscriberId), eq(emailSubscribers.status, 'pending')));

    return NextResponse.json({ success: true, message: 'Your subscription is confirmed.' });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.newsletter.confirm.error', error });
    return NextResponse.json({ error: 'Failed to confirm subscription' }, { status: 500 });
  }
}

export const POST = rateLimited(publicLimiter)(postHandler);
