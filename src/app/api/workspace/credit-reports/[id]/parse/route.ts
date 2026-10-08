import { NextRequest, NextResponse } from 'next/server';
import { requireCapability } from '@/lib/admin-session';
import { analyzeCreditReport } from '@/lib/credit-analysis';
import { logServerEvent } from '@/lib/server-logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await requireCapability('disputes:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  try {
    await analyzeCreditReport(id);
    return NextResponse.json({ success: true, message: 'Credit report analyzed successfully' });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.credit.reports.id.parse.error', error: error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse credit report' },
      { status: 500 }
    );
  }
}
