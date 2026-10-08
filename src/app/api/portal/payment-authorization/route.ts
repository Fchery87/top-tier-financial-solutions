import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import {
  AuthorizationConflictException,
  getActiveAuthorization,
  revokePaymentAuthorization,
  submitPaymentAuthorization,
  toPublicAuthorization,
} from '@/lib/payment-authorization/store';
import { AccountInputException, type AccountType, type Authorization } from '@/lib/payment-authorization/types';

function toResponse(authorization: Authorization) {
  const view = toPublicAuthorization(authorization);
  return {
    id: view.id,
    status: view.status,
    bank_name: view.bankName,
    account_last4: view.accountLast4,
    account_type: view.accountType,
    maximum_amount_cents: view.maximumAmountCents,
    signed_at: view.signedAt,
    revoked_at: view.revokedAt,
    expires_at: view.expiresAt,
  };
}

async function resolveClient() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.userId, session.user.id))
    .limit(1);

  if (!client) {
    return { error: NextResponse.json({ error: 'Client profile not found' }, { status: 404 }) };
  }

  return { client };
}

function clientIp() {
  return headers().then((headersList) => (
    headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || null
  ));
}

export async function GET() {
  try {
    const resolved = await resolveClient();
    if ('error' in resolved) return resolved.error;

    const authorization = await getActiveAuthorization(resolved.client.id, new Date());
    if (!authorization) {
      return NextResponse.json({ authorization: null });
    }
    return NextResponse.json({ authorization: toResponse(authorization) });
  } catch (error) {
    console.error('Error loading payment authorization:', error);
    return NextResponse.json({ error: 'Failed to load payment authorization' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const resolved = await resolveClient();
    if ('error' in resolved) return resolved.error;

    const body = await request.json();
    const accountType = body.account_type;
    if (accountType !== 'checking' && accountType !== 'savings') {
      return NextResponse.json({ error: 'ACCOUNT_TYPE_INVALID', code: 'ACCOUNT_TYPE_INVALID' }, { status: 400 });
    }

    const saved = await submitPaymentAuthorization({
      clientId: resolved.client.id,
      bankName: String(body.bank_name ?? ''),
      routingNumber: String(body.routing_number ?? ''),
      accountNumber: String(body.account_number ?? ''),
      accountType: accountType as AccountType,
      maximumAmountCents: body.maximum_amount_cents,
      signatureData: String(body.signature_data ?? ''),
      signerIpAddress: await clientIp(),
      now: new Date(),
    });

    return NextResponse.json(toResponse(saved.authorization));
  } catch (error) {
    if (error instanceof AccountInputException) {
      return NextResponse.json({ error: error.code, code: error.code }, { status: 400 });
    }
    if (error instanceof AuthorizationConflictException) {
      return NextResponse.json({ error: 'authorization_conflict', code: 'authorization_conflict' }, { status: 409 });
    }
    console.error('Error submitting payment authorization:', error);
    return NextResponse.json({ error: 'Failed to save payment authorization' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const resolved = await resolveClient();
    if ('error' in resolved) return resolved.error;

    const { revoked } = await revokePaymentAuthorization({
      clientId: resolved.client.id,
      signerIpAddress: await clientIp(),
      now: new Date(),
    });

    if (!revoked) {
      return NextResponse.json({ authorization: null });
    }
    return NextResponse.json({ authorization: toResponse(revoked) });
  } catch (error) {
    console.error('Error revoking payment authorization:', error);
    return NextResponse.json({ error: 'Failed to revoke payment authorization' }, { status: 500 });
  }
}
