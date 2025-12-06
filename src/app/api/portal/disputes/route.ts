import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { disputes, clients, negativeItems } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { eq, desc } from 'drizzle-orm';

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.id) {
    return null;
  }
  
  return session.user;
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // First, find the client record for this user
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.userId, user.id))
      .limit(1);

    if (!client) {
      return NextResponse.json({ 
        disputes: [],
        stats: {
          total: 0,
          in_progress: 0,
          deleted: 0,
          awaiting: 0,
        }
      });
    }

    // Fetch disputes for this client
    const clientDisputes = await db
      .select({
        dispute: disputes,
        negativeItem: negativeItems,
      })
      .from(disputes)
      .leftJoin(negativeItems, eq(disputes.negativeItemId, negativeItems.id))
      .where(eq(disputes.clientId, client.id))
      .orderBy(desc(disputes.createdAt));

    // Calculate stats
    const stats = {
      total: clientDisputes.length,
      in_progress: clientDisputes.filter(d => ['sent', 'in_progress'].includes(d.dispute.status || '')).length,
      deleted: clientDisputes.filter(d => d.dispute.outcome === 'deleted').length,
      awaiting: clientDisputes.filter(d => d.dispute.status === 'sent' && !d.dispute.outcome).length,
    };

    // Map disputes for client view (hide sensitive internal data)
    const mappedDisputes = clientDisputes.map(({ dispute, negativeItem }) => ({
      id: dispute.id,
      bureau: dispute.bureau,
      status: dispute.status,
      round: dispute.round,
      creditor_name: dispute.creditorName || negativeItem?.creditorName || 'Item under dispute',
      item_type: negativeItem?.itemType || null,
      sent_at: dispute.sentAt?.toISOString() || null,
      response_deadline: dispute.responseDeadline?.toISOString() || null,
      outcome: dispute.outcome,
      outcome_date: dispute.responseReceivedAt?.toISOString() || null,
      created_at: dispute.createdAt?.toISOString() || null,
    }));

    return NextResponse.json({ 
      disputes: mappedDisputes,
      stats,
    });
  } catch (error) {
    console.error('Error fetching portal disputes:', error);
    return NextResponse.json({ error: 'Failed to fetch disputes' }, { status: 500 });
  }
}
