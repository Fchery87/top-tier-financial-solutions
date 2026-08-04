import type { NextRequest, NextResponse } from 'next/server';
import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth';
import { authLimiter } from '@/lib/rate-limit';
import { rateLimited } from '@/lib/rate-limit-middleware';

const handler = toNextJsHandler(auth);

export const GET = handler.GET;
export const POST = rateLimited(authLimiter)(
  handler.POST as unknown as (request: NextRequest) => Promise<NextResponse>,
);
