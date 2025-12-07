import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { emailTemplates } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { desc } from 'drizzle-orm';

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
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const templates = await db
      .select()
      .from(emailTemplates)
      .orderBy(desc(emailTemplates.createdAt));

    return NextResponse.json({
      templates: templates.map(t => ({
        id: t.id,
        name: t.name,
        trigger_type: t.triggerType,
        subject: t.subject,
        html_content: t.htmlContent,
        text_content: t.textContent,
        variables: t.variables ? JSON.parse(t.variables) : [],
        is_active: t.isActive,
        created_at: t.createdAt?.toISOString(),
        updated_at: t.updatedAt?.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching email templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email templates' },
      { status: 500 }
    );
  }
}
