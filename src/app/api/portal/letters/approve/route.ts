import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clients, letterApprovals } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return null;
  }

  return session.user;
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { approval_id, signature_text } = body as { approval_id?: string; signature_text?: string };

    if (!approval_id) {
      return NextResponse.json({ error: 'Missing approval_id' }, { status: 400 });
    }

    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.userId, user.id))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client profile not found' }, { status: 404 });
    }

    const [approval] = await db
      .select()
      .from(letterApprovals)
      .where(eq(letterApprovals.id, approval_id))
      .limit(1);

    if (!approval || approval.clientId !== client.id) {
      return NextResponse.json({ error: 'Letter approval not found' }, { status: 404 });
    }

    // Idempotent: if already approved, just return success
    if (approval.status === 'approved' && approval.approvedAt) {
      return NextResponse.json({ success: true, alreadyApproved: true });
    }

    const headerList = await headers();
    const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    const userAgent = headerList.get('user-agent') || null;
    const now = new Date();

    await db
      .update(letterApprovals)
      .set({
        status: 'approved',
        approvalMethod: 'portal_click',
        signatureText: signature_text || null,
        signatureIp: ip,
        signatureUserAgent: userAgent,
        approvedAt: now,
        rejectedAt: null,
        updatedAt: now,
      })
      .where(eq(letterApprovals.id, approval.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error approving letter:', error);
    return NextResponse.json({ error: 'Failed to approve letter' }, { status: 500 });
  }
}
