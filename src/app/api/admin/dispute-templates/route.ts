import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { disputeLetterTemplates } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

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
      .from(disputeLetterTemplates)
      .where(eq(disputeLetterTemplates.isActive, true))
      .orderBy(desc(disputeLetterTemplates.createdAt));

    return NextResponse.json({
      templates: templates.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        dispute_type: t.disputeType,
        target_recipient: t.targetRecipient,
        content: t.content,
        variables: t.variables ? JSON.parse(t.variables) : [],
        is_active: t.isActive,
        created_at: t.createdAt?.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, dispute_type, target_recipient, content, variables } = body;

    if (!name || !dispute_type || !content) {
      return NextResponse.json({ error: 'Name, dispute type, and content are required' }, { status: 400 });
    }

    const id = randomUUID();
    const now = new Date();

    await db.insert(disputeLetterTemplates).values({
      id,
      name,
      description,
      disputeType: dispute_type,
      targetRecipient: target_recipient || 'bureau',
      content,
      variables: variables ? JSON.stringify(variables) : null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ id, name, dispute_type }, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
