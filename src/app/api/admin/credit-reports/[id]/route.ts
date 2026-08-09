import { NextRequest, NextResponse } from 'next/server';
import { requireCapability } from '@/lib/admin-session';
import { db } from '@/db/client';
import { creditReports, creditAccounts, negativeItems } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { deleteFromR2 } from '@/lib/r2-storage';
import { logServerEvent } from '@/lib/server-logger';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await requireCapability('disputes:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  try {
    // Get the report to find file URL and client ID
    const [report] = await db
      .select()
      .from(creditReports)
      .where(eq(creditReports.id, id))
      .limit(1);

    if (!report) {
      return NextResponse.json({ error: 'Credit report not found' }, { status: 404 });
    }

    // Delete associated data in order (due to foreign key constraints)
    // 1. Delete negative items for this report
    await db.delete(negativeItems).where(eq(negativeItems.creditReportId, id));

    // 2. Delete credit accounts for this report
    await db.delete(creditAccounts).where(eq(creditAccounts.creditReportId, id));

    // 3. Delete the file from R2 storage
    try {
      await deleteFromR2(report.fileUrl);
    } catch (r2Error) {
      logServerEvent({ level: 'error', event: 'server.app.api.admin.credit.reports.id.error', error: r2Error });
      // Continue with database deletion even if R2 delete fails
    }

    // 4. Delete the credit report record
    await db.delete(creditReports).where(eq(creditReports.id, id));

    return NextResponse.json({ success: true, message: 'Credit report deleted successfully' });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.credit.reports.id.error', error: error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete credit report' },
      { status: 500 }
    );
  }
}
