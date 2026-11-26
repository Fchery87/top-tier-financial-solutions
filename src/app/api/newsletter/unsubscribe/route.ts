import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { emailSubscribers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { publicLimiter } from '@/lib/rate-limit';
import { rateLimited } from '@/lib/rate-limit-middleware';
import { readJsonBody } from '@/lib/request-validation';
import { logServerEvent } from '@/lib/server-logger';
import { verifyUnsubscribeToken } from '@/lib/newsletter-unsubscribe-token';

const unsubscribeSchema = z.object({
  token: z.string({ error: 'Invalid request payload' }).trim().min(1).max(512),
}).strict();

const INVALID_LINK_ERROR = 'This unsubscribe link is invalid.';

async function postHandler(request: NextRequest) {
  try {
    const parsed = await readJsonBody(request, unsubscribeSchema);

    if (parsed.kind !== 'valid') {
      return NextResponse.json({ error: INVALID_LINK_ERROR }, { status: 400 });
    }

    const subscriberId = verifyUnsubscribeToken(parsed.data.token);
    if (!subscriberId) {
      return NextResponse.json({ error: INVALID_LINK_ERROR }, { status: 400 });
    }

    // Idempotent and uniform: the same response whether or not the subscriber
    // exists or was already unsubscribed, so the endpoint reveals nothing.
    const now = new Date();
    await db
      .update(emailSubscribers)
      .set({ status: 'unsubscribed', unsubscribedAt: now, updatedAt: now })
      .where(eq(emailSubscribers.id, subscriberId));

    return NextResponse.json({
      success: true,
      message: 'You have been unsubscribed.',
    });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.newsletter.unsubscribe.error', error });
    return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
  }
}

export const POST = rateLimited(publicLimiter)(postHandler);
