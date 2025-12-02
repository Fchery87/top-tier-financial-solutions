import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clientAgreements, disclosureAcknowledgments, clients, user } from '@/db/schema';
import { eq, and, desc, or } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

// GET - Get client's pending or most recent agreement
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the client record for this user
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.userId, session.user.id))
      .limit(1);

    if (!client) {
      return NextResponse.json({ 
        agreement: null,
        message: 'No client profile found. Please contact us to get started.' 
      });
    }

    // Get the most recent pending or signed agreement
    const [agreement] = await db
      .select({
        id: clientAgreements.id,
        status: clientAgreements.status,
        content: clientAgreements.content,
        sent_at: clientAgreements.sentAt,
        expires_at: clientAgreements.expiresAt,
        signed_at: clientAgreements.signedAt,
        cancellation_deadline: clientAgreements.cancellationDeadline,
      })
      .from(clientAgreements)
      .where(
        and(
          eq(clientAgreements.clientId, client.id),
          or(
            eq(clientAgreements.status, 'pending'),
            eq(clientAgreements.status, 'signed')
          )
        )
      )
      .orderBy(desc(clientAgreements.createdAt))
      .limit(1);

    if (!agreement) {
      return NextResponse.json({ 
        agreement: null,
        message: 'No agreement found' 
      });
    }

    // Get disclosures for this agreement
    const disclosures = await db
      .select({
        id: disclosureAcknowledgments.id,
        disclosure_type: disclosureAcknowledgments.disclosureType,
        disclosure_text: disclosureAcknowledgments.disclosureText,
        acknowledged: disclosureAcknowledgments.acknowledged,
      })
      .from(disclosureAcknowledgments)
      .where(eq(disclosureAcknowledgments.agreementId, agreement.id));

    return NextResponse.json({
      agreement: {
        ...agreement,
        disclosures,
      },
    });
  } catch (error) {
    console.error('Error fetching agreement:', error);
    return NextResponse.json({ error: 'Failed to fetch agreement' }, { status: 500 });
  }
}
