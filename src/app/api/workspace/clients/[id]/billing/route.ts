import { NextRequest, NextResponse } from 'next/server';
import { requireCapability } from '@/lib/admin-session';
import { logServerEvent } from '@/lib/server-logger';
import { loadClientBilling } from '@/lib/client-billing';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const adminUser = await requireCapability('billing:client');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const billing = await loadClientBilling(id, new Date());
    if (!billing) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    return NextResponse.json(billing);
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.workspace.clients.id.billing.error', error });
    return NextResponse.json({ error: 'Failed to load client billing' }, { status: 500 });
  }
}
