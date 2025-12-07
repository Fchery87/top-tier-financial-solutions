import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { agreementTemplates, clientAgreements, disclosureAcknowledgments, clients } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { DISCLOSURE_TEXTS, REQUIRED_DISCLOSURES_NY } from '@/lib/service-agreement-template';

// GET - List agreement templates or client agreements
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'templates'; // 'templates' or 'agreements'
    const clientId = searchParams.get('client_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    if (type === 'templates') {
      const items = await db
        .select()
        .from(agreementTemplates)
        .orderBy(desc(agreementTemplates.createdAt))
        .limit(limit)
        .offset(offset);

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(agreementTemplates);

      return NextResponse.json({
        items,
        total: Number(countResult[0].count),
        page,
        limit,
      });
    } else {
      // Client agreements
      let query = db
        .select({
          id: clientAgreements.id,
          client_id: clientAgreements.clientId,
          template_id: clientAgreements.templateId,
          template_version: clientAgreements.templateVersion,
          status: clientAgreements.status,
          signed_at: clientAgreements.signedAt,
          cancellation_deadline: clientAgreements.cancellationDeadline,
          cancelled_at: clientAgreements.cancelledAt,
          sent_at: clientAgreements.sentAt,
          expires_at: clientAgreements.expiresAt,
          created_at: clientAgreements.createdAt,
          client_name: sql<string>`${clients.firstName} || ' ' || ${clients.lastName}`,
          client_email: clients.email,
        })
        .from(clientAgreements)
        .leftJoin(clients, eq(clientAgreements.clientId, clients.id))
        .orderBy(desc(clientAgreements.createdAt))
        .limit(limit)
        .offset(offset);

      if (clientId) {
        query = query.where(eq(clientAgreements.clientId, clientId)) as typeof query;
      }

      const items = await query;

      return NextResponse.json({
        items,
        page,
        limit,
      });
    }
  } catch (error) {
    console.error('Error fetching agreements:', error);
    return NextResponse.json({ error: 'Failed to fetch agreements' }, { status: 500 });
  }
}

// POST - Create agreement template or send agreement to client
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type } = body;

    if (type === 'template') {
      // Create agreement template
      const { name, content, requiredDisclosures, cancellationPeriodDays, version, isActive } = body;

      if (!name || !content) {
        return NextResponse.json({ error: 'Name and content are required' }, { status: 400 });
      }

      const id = crypto.randomUUID();
      await db.insert(agreementTemplates).values({
        id,
        name,
        version: version || '1.0',
        content,
        requiredDisclosures: requiredDisclosures ? JSON.stringify(requiredDisclosures) : null,
        cancellationPeriodDays: cancellationPeriodDays || 3,
        isActive: isActive ?? true,
      });

      return NextResponse.json({ id, message: 'Template created successfully' });
    } else {
      // Send agreement to client
      const { clientId, templateId } = body;

      if (!clientId || !templateId) {
        return NextResponse.json({ error: 'Client ID and template ID are required' }, { status: 400 });
      }

      // Get template
      const template = await db
        .select()
        .from(agreementTemplates)
        .where(eq(agreementTemplates.id, templateId))
        .limit(1);

      if (!template.length) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      // Get client
      const client = await db
        .select()
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);

      if (!client.length) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }

      // Replace placeholders in template content
      let content = template[0].content;
      content = content.replace(/\{\{client_name\}\}/g, `${client[0].firstName} ${client[0].lastName}`);
      content = content.replace(/\{\{client_email\}\}/g, client[0].email);
      content = content.replace(/\{\{client_phone\}\}/g, client[0].phone || '');
      content = content.replace(/\{\{date\}\}/g, new Date().toLocaleDateString());
      content = content.replace(/\{\{company_name\}\}/g, 'Top Tier Financial Solutions');

      // Create agreement
      const agreementId = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days if not signed

      await db.insert(clientAgreements).values({
        id: agreementId,
        clientId,
        templateId,
        templateVersion: template[0].version,
        status: 'pending',
        content,
        sentAt: new Date(),
        sentById: session.user.id,
        expiresAt,
      });

      // Create disclosure acknowledgment records (NY GBL Article 28-BB compliant)
      const disclosures = template[0].requiredDisclosures 
        ? JSON.parse(template[0].requiredDisclosures) 
        : REQUIRED_DISCLOSURES_NY;

      for (const disclosureType of disclosures) {
        await db.insert(disclosureAcknowledgments).values({
          id: crypto.randomUUID(),
          agreementId,
          disclosureType,
          disclosureText: DISCLOSURE_TEXTS[disclosureType as keyof typeof DISCLOSURE_TEXTS] || disclosureType,
          acknowledged: false,
        });
      }

      return NextResponse.json({ 
        id: agreementId, 
        message: 'Agreement sent to client successfully' 
      });
    }
  } catch (error) {
    console.error('Error creating agreement:', error);
    return NextResponse.json({ error: 'Failed to create agreement' }, { status: 500 });
  }
}
