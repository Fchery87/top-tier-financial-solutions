import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { feeConfigurations, clientBillingProfiles, invoices, clients } from '@/db/schema';
import { and, eq, desc, sql } from 'drizzle-orm';
import { headers } from 'next/headers';
import { describeBlocker } from '@/lib/billing-readiness';
import { createInvoice } from '@/lib/billing-store';
import { requireCapability } from '@/lib/admin-session';
import { formatClientDisplayIdentity } from '@/lib/client-display-identity';
import { logServerEvent } from '@/lib/server-logger';

// GET - List fee configs, billing profiles, or invoices
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'invoices';
    const adminUser = await requireCapability(type === 'fee_configs' ? 'billing:system' : 'billing:client');
    if (!adminUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clientId = searchParams.get('client_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    if (type === 'fee_configs') {
      const items = await db
        .select()
        .from(feeConfigurations)
        .orderBy(desc(feeConfigurations.createdAt))
        .limit(limit)
        .offset(offset);

      return NextResponse.json({ items });
    } else if (type === 'billing_profiles') {
      let query = db
        .select({
          id: clientBillingProfiles.id,
          client_id: clientBillingProfiles.clientId,
          fee_config_id: clientBillingProfiles.feeConfigId,
          external_customer_id: clientBillingProfiles.externalCustomerId,
          payment_processor: clientBillingProfiles.paymentProcessor,
          payment_method_last4: clientBillingProfiles.paymentMethodLast4,
          payment_method_type: clientBillingProfiles.paymentMethodType,
          billing_status: clientBillingProfiles.billingStatus,
          next_billing_date: clientBillingProfiles.nextBillingDate,
          created_at: clientBillingProfiles.createdAt,
          client_first_name: clients.firstName,
          client_last_name: clients.lastName,
          client_email: clients.email,
          fee_config_name: feeConfigurations.name,
          fee_amount: feeConfigurations.amount,
        })
        .from(clientBillingProfiles)
        .leftJoin(clients, eq(clientBillingProfiles.clientId, clients.id))
        .leftJoin(feeConfigurations, eq(clientBillingProfiles.feeConfigId, feeConfigurations.id))
        .orderBy(desc(clientBillingProfiles.createdAt))
        .limit(limit)
        .offset(offset);

      if (clientId) {
        query = query.where(eq(clientBillingProfiles.clientId, clientId)) as typeof query;
      }

      const items = await query;
      return NextResponse.json({
        items: items.map(({ client_first_name, client_last_name, client_email, ...item }) => ({
          ...item,
          ...formatClientDisplayIdentity({
            firstName: client_first_name,
            lastName: client_last_name,
            email: client_email,
          }),
        })),
      });
    } else {
      // Invoices
      let query = db
        .select({
          id: invoices.id,
          client_id: invoices.clientId,
          invoice_number: invoices.invoiceNumber,
          amount: invoices.amount,
          status: invoices.status,
          services_rendered: invoices.servicesRendered,
          services_rendered_at: invoices.servicesRenderedAt,
          description: invoices.description,
          due_date: invoices.dueDate,
          paid_at: invoices.paidAt,
          payment_method: invoices.paymentMethod,
          created_at: invoices.createdAt,
          client_first_name: clients.firstName,
          client_last_name: clients.lastName,
          client_email: clients.email,
        })
        .from(invoices)
        .leftJoin(clients, eq(invoices.clientId, clients.id))
        .orderBy(desc(invoices.createdAt))
        .limit(limit)
        .offset(offset);

      if (clientId) {
        query = query.where(eq(invoices.clientId, clientId)) as typeof query;
      }

      const items = await query;
      const formattedItems = items.map(({ client_first_name, client_last_name, client_email, ...item }) => ({
        ...item,
        ...formatClientDisplayIdentity({
          firstName: client_first_name,
          lastName: client_last_name,
          email: client_email,
        }),
      }));

      // Get summary stats
      const stats = await db
        .select({
          total_invoices: sql<number>`COUNT(*)`,
          total_revenue: sql<number>`COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0)`,
          pending_amount: sql<number>`COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0)`,
        })
        .from(invoices);

      return NextResponse.json({ 
        items: formattedItems,
        stats: stats[0],
        page,
        limit,
      });
    }
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.billing.error', error: error });
    return NextResponse.json({ error: 'Failed to fetch billing data' }, { status: 500 });
  }
}

// POST - Create fee config, billing profile, or invoice
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const adminUser = await requireCapability(body.type === 'fee_config' ? 'billing:system' : 'billing:client');
    if (!adminUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { type } = body;
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || null;

    if (type === 'fee_config') {
      const { name, description, feeModel, amount, frequency, setupFee } = body;

      if (!name || !feeModel || !amount) {
        return NextResponse.json({ error: 'Name, fee model, and amount are required' }, { status: 400 });
      }

      const id = crypto.randomUUID();
      await db.insert(feeConfigurations).values({
        id,
        name,
        description,
        feeModel,
        amount,
        frequency,
        setupFee: setupFee || 0,
        isActive: true,
      });

      return NextResponse.json({ id, message: 'Fee configuration created successfully' });
    } else if (type === 'billing_profile') {
      const { clientId, feeConfigId } = body;

      if (!clientId || !feeConfigId) {
        return NextResponse.json({ error: 'Client ID and fee plan are required' }, { status: 400 });
      }

      const [feeConfig] = await db
        .select({ id: feeConfigurations.id })
        .from(feeConfigurations)
        .where(and(eq(feeConfigurations.id, feeConfigId), eq(feeConfigurations.isActive, true)))
        .limit(1);

      if (!feeConfig) {
        return NextResponse.json({ error: 'Fee plan not found' }, { status: 404 });
      }

      const [existing] = await db
        .select({ id: clientBillingProfiles.id })
        .from(clientBillingProfiles)
        .where(eq(clientBillingProfiles.clientId, clientId))
        .orderBy(desc(clientBillingProfiles.createdAt))
        .limit(1);

      if (existing) {
        await db
          .update(clientBillingProfiles)
          .set({ feeConfigId, updatedAt: new Date() })
          .where(eq(clientBillingProfiles.id, existing.id));
        return NextResponse.json({ id: existing.id, message: 'Billing profile updated successfully' });
      }

      const id = crypto.randomUUID();
      await db.insert(clientBillingProfiles).values({
        id,
        clientId,
        feeConfigId,
        billingStatus: 'active',
      });

      return NextResponse.json({ id, message: 'Billing profile created successfully' });
    } else {
      // feeModel and resultVerified in the body are deliberately ignored: payability comes from stored facts.
      const { clientId, serviceEngagementId, servicesRenderedEventId, invoiceServiceType, amount, description, dueDate } = body;

      if (!clientId || !serviceEngagementId) {
        return NextResponse.json({ error: 'Client ID and service engagement ID are required' }, { status: 400 });
      }

      const parsedDueDate = dueDate ? new Date(dueDate) : null;
      if (parsedDueDate && Number.isNaN(parsedDueDate.getTime())) {
        return NextResponse.json({ error: 'Due date must be a date' }, { status: 400 });
      }

      const created = await createInvoice({
        clientId,
        serviceEngagementId,
        servicesRenderedEventId: typeof servicesRenderedEventId === 'string' ? servicesRenderedEventId : null,
        invoiceServiceType: typeof invoiceServiceType === 'string' ? invoiceServiceType : null,
        amountCents: amount,
        description: typeof description === 'string' && description.trim() ? description.trim() : null,
        dueDate: parsedDueDate,
        actorUserId: adminUser.id,
        ipAddress,
        now: new Date(),
      });

      if (created.result === 'rejected') {
        return NextResponse.json({
          error: created.error,
          code: created.code,
          ...(created.blockers
            ? { blockers: created.blockers.map((blocker) => ({ kind: blocker.kind, message: describeBlocker(blocker) })) }
            : {}),
        }, { status: created.status });
      }

      return NextResponse.json({
        id: created.id,
        invoiceNumber: created.invoiceNumber,
        amount: created.amountCents,
        message: 'Invoice created successfully',
      });
    }
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.billing.error', error: error });
    return NextResponse.json({ error: 'Failed to create billing record' }, { status: 500 });
  }
}
