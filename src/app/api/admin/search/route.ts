import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';

import { clients, disputes } from '@/db/schema';
import { db } from '@/db/client';
import { requireCapability } from '@/lib/admin-session';
import { decryptClientData, decryptDisputeData } from '@/lib/db-encryption';
import {
  normalizeWorkspaceSearchQuery,
  searchWorkspaceRecords,
} from '@/lib/workspace-search';
import { rateLimited } from '@/lib/rate-limit-middleware';
import { sensitiveLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_SEARCH_SCAN_ROWS = 500;

async function getHandler(request: NextRequest) {
  const [clientReader, disputeReader] = await Promise.all([
    requireCapability('clients:read'),
    requireCapability('disputes:read'),
  ]);

  if (!clientReader && !disputeReader) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const normalizedQuery = normalizeWorkspaceSearchQuery(request.nextUrl.searchParams.get('q') || '');
  if (!normalizedQuery) {
    return NextResponse.json({ query: '', results: [] });
  }

  try {
    const clientRows = clientReader
      ? await db
          .select({
            id: clients.id,
            firstName: clients.firstName,
            lastName: clients.lastName,
            email: clients.email,
            status: clients.status,
          })
          .from(clients)
          .orderBy(desc(clients.updatedAt))
          .limit(MAX_SEARCH_SCAN_ROWS)
      : [];

    const disputeRows = disputeReader
      ? await db
          .select({
            id: disputes.id,
            clientFirstName: clients.firstName,
            clientLastName: clients.lastName,
            creditorName: disputes.creditorName,
            disputeReason: disputes.disputeReason,
            bureau: disputes.bureau,
            status: disputes.status,
            round: disputes.round,
          })
          .from(disputes)
          .leftJoin(clients, eq(disputes.clientId, clients.id))
          .orderBy(desc(disputes.updatedAt))
          .limit(MAX_SEARCH_SCAN_ROWS)
      : [];

    const searchableClients = clientRows.map((row) => {
      const decrypted = decryptClientData({
        firstName: row.firstName,
        lastName: row.lastName,
      });

      return {
        id: row.id,
        firstName: String(decrypted.firstName || ''),
        lastName: String(decrypted.lastName || ''),
        email: row.email,
        status: row.status,
      };
    });

    const searchableDisputes = disputeRows.map((row) => {
      const decrypted = decryptDisputeData({ creditorName: row.creditorName });
      const clientName = [row.clientFirstName, row.clientLastName]
        .filter((value): value is string => Boolean(value))
        .map((value) => String(value))
        .join(' ');

      return {
        id: row.id,
        clientName: clientName || 'Unknown client',
        creditorName: decrypted.creditorName ? String(decrypted.creditorName) : null,
        disputeReason: row.disputeReason,
        bureau: row.bureau,
        status: row.status,
        round: row.round,
      };
    });

    return NextResponse.json({
      query: normalizedQuery,
      results: searchWorkspaceRecords({
        query: normalizedQuery,
        clients: searchableClients,
        disputes: searchableDisputes,
      }),
    });
  } catch (error) {
    console.error('Workspace search failed:', error);
    return NextResponse.json({ error: 'Failed to search workspace records' }, { status: 500 });
  }
}

export const GET = rateLimited(sensitiveLimiter)(getHandler);
