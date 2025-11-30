import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { consultationRequests } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { desc, count, eq } from 'drizzle-orm';

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

export async function GET(request: NextRequest) {
  const user = await validateAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const status = searchParams.get('status');
  const offset = (page - 1) * limit;

  try {
    let query = db.select().from(consultationRequests);
    let countQuery = db.select({ count: count() }).from(consultationRequests);
    
    if (status && status !== 'all') {
      query = query.where(eq(consultationRequests.status, status)) as typeof query;
      countQuery = countQuery.where(eq(consultationRequests.status, status)) as typeof countQuery;
    }
    
    const [items, totalResult] = await Promise.all([
      query.orderBy(desc(consultationRequests.requestedAt)).limit(limit).offset(offset),
      countQuery,
    ]);

    return NextResponse.json({
      items: items.map(l => ({
        id: l.id,
        first_name: l.firstName,
        last_name: l.lastName,
        email: l.email,
        phone_number: l.phoneNumber,
        message: l.message,
        source_page_slug: l.sourcePageSlug,
        status: l.status,
        requested_at: l.requestedAt?.toISOString(),
        updated_at: l.updatedAt?.toISOString(),
      })),
      total: totalResult[0].count,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}
