import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { agreementTemplates, clientAgreements, disclosureAcknowledgments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

// GET - Get single agreement template or client agreement
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'template';

    if (type === 'template') {
      const template = await db
        .select()
        .from(agreementTemplates)
        .where(eq(agreementTemplates.id, id))
        .limit(1);

      if (!template.length) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      return NextResponse.json(template[0]);
    } else {
      // Get client agreement with disclosures
      const agreement = await db
        .select()
        .from(clientAgreements)
        .where(eq(clientAgreements.id, id))
        .limit(1);

      if (!agreement.length) {
        return NextResponse.json({ error: 'Agreement not found' }, { status: 404 });
      }

      const disclosures = await db
        .select()
        .from(disclosureAcknowledgments)
        .where(eq(disclosureAcknowledgments.agreementId, id));

      return NextResponse.json({
        ...agreement[0],
        disclosures,
      });
    }
  } catch (error) {
    console.error('Error fetching agreement:', error);
    return NextResponse.json({ error: 'Failed to fetch agreement' }, { status: 500 });
  }
}

// PUT - Update agreement template or client agreement
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { type } = body;

    if (type === 'template') {
      const { name, content, requiredDisclosures, cancellationPeriodDays, isActive, version } = body;

      await db
        .update(agreementTemplates)
        .set({
          ...(name && { name }),
          ...(content && { content }),
          ...(requiredDisclosures && { requiredDisclosures: JSON.stringify(requiredDisclosures) }),
          ...(cancellationPeriodDays !== undefined && { cancellationPeriodDays }),
          ...(isActive !== undefined && { isActive }),
          ...(version && { version }),
          updatedAt: new Date(),
        })
        .where(eq(agreementTemplates.id, id));

      return NextResponse.json({ message: 'Template updated successfully' });
    } else {
      // Update client agreement status (e.g., cancel)
      const { status, cancellationReason } = body;

      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (status) {
        updateData.status = status;
        if (status === 'cancelled') {
          updateData.cancelledAt = new Date();
          updateData.cancellationReason = cancellationReason || 'Cancelled by admin';
        }
      }

      await db
        .update(clientAgreements)
        .set(updateData)
        .where(eq(clientAgreements.id, id));

      return NextResponse.json({ message: 'Agreement updated successfully' });
    }
  } catch (error) {
    console.error('Error updating agreement:', error);
    return NextResponse.json({ error: 'Failed to update agreement' }, { status: 500 });
  }
}

// DELETE - Delete agreement template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'template';

    if (type === 'template') {
      await db.delete(agreementTemplates).where(eq(agreementTemplates.id, id));
      return NextResponse.json({ message: 'Template deleted successfully' });
    } else {
      // Delete client agreement and its disclosures (cascade)
      await db.delete(clientAgreements).where(eq(clientAgreements.id, id));
      return NextResponse.json({ message: 'Agreement deleted successfully' });
    }
  } catch (error) {
    console.error('Error deleting agreement:', error);
    return NextResponse.json({ error: 'Failed to delete agreement' }, { status: 500 });
  }
}
