import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { consultationRequests, testimonials, faqItems, pages } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { count, eq } from 'drizzle-orm';

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

export async function GET() {
  const user = await validateAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [
      newLeadsResult,
      pendingTestimonialsResult,
      publishedFaqsResult,
      activePagesResult,
    ] = await Promise.all([
      db.select({ count: count() }).from(consultationRequests).where(eq(consultationRequests.status, 'new')),
      db.select({ count: count() }).from(testimonials).where(eq(testimonials.isApproved, false)),
      db.select({ count: count() }).from(faqItems).where(eq(faqItems.isPublished, true)),
      db.select({ count: count() }).from(pages).where(eq(pages.isPublished, true)),
    ]);

    return NextResponse.json({
      newLeads: newLeadsResult[0].count,
      pendingTestimonials: pendingTestimonialsResult[0].count,
      publishedFaqs: publishedFaqsResult[0].count,
      activePages: activePagesResult[0].count,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
