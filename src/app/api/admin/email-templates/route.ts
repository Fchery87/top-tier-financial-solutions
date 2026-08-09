import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { emailTemplates } from '@/db/schema';
import { requireCapability } from '@/lib/admin-session';
import { desc } from 'drizzle-orm';
import { logServerEvent } from '@/lib/server-logger';

export async function GET() {
  const adminUser = await requireCapability('content:read');
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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
    logServerEvent({ level: 'error', event: 'server.app.api.admin.email.templates.error', error: error });
    return NextResponse.json(
      { error: 'Failed to fetch email templates' },
      { status: 500 }
    );
  }
}
