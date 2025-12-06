import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { db } from '@/db/client';
import { creditReports, creditAccounts, negativeItems } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { deleteFromR2 } from '@/lib/r2-storage';

async function validateAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.email) {
    return null;
  }
  
  const isAdmin = await isSuperAdmin(session.user.email);
  if (!isAdmin) {
    return null;
  }
  
  return session.user;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      console.error('Error deleting file from R2:', r2Error);
      // Continue with database deletion even if R2 delete fails
    }

    // 4. Delete the credit report record
    await db.delete(creditReports).where(eq(creditReports.id, id));

    return NextResponse.json({ success: true, message: 'Credit report deleted successfully' });
  } catch (error) {
    console.error('Error deleting credit report:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete credit report' },
      { status: 500 }
    );
  }
}
