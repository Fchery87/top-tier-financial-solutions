import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { feeConfigurations, clientBillingProfiles, invoices, paymentAuditLog, clients } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

// Helper to generate invoice number
function generateInvoiceNumber(): string {
  const prefix = 'INV';
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${year}${month}-${random}`;
}

// GET - List fee configs, billing profiles, or invoices
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'invoices';
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
          client_name: sql<string>`${clients.firstName} || ' ' || ${clients.lastName}`,
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
      return NextResponse.json({ items });
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
          client_name: sql<string>`${clients.firstName} || ' ' || ${clients.lastName}`,
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

      // Get summary stats
      const stats = await db
        .select({
          total_invoices: sql<number>`COUNT(*)`,
          total_revenue: sql<number>`COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0)`,
          pending_amount: sql<number>`COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0)`,
        })
        .from(invoices);

      return NextResponse.json({ 
        items,
        stats: stats[0],
        page,
        limit,
      });
    }
  } catch (error) {
    console.error('Error fetching billing data:', error);
    return NextResponse.json({ error: 'Failed to fetch billing data' }, { status: 500 });
  }
}

// POST - Create fee config, billing profile, or invoice
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type } = body;
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'unknown';

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

      if (!clientId) {
        return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
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
      // Create invoice
      const { clientId, amount, description, dueDate, servicesRendered } = body;

      if (!clientId || !amount) {
        return NextResponse.json({ error: 'Client ID and amount are required' }, { status: 400 });
      }

      // CROA Compliance: Services must be rendered before invoicing
      if (!servicesRendered) {
        return NextResponse.json({ 
          error: 'CROA Compliance: Services must be documented before creating an invoice',
          code: 'CROA_SERVICES_REQUIRED'
        }, { status: 400 });
      }

      const id = crypto.randomUUID();
      const invoiceNumber = generateInvoiceNumber();

      await db.insert(invoices).values({
        id,
        clientId,
        invoiceNumber,
        amount,
        status: 'pending',
        servicesRendered: JSON.stringify(servicesRendered),
        servicesRenderedAt: new Date(),
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
      });

      // Log audit entry
      await db.insert(paymentAuditLog).values({
        id: crypto.randomUUID(),
        clientId,
        invoiceId: id,
        action: 'invoice_created',
        details: JSON.stringify({ 
          invoice_number: invoiceNumber, 
          amount, 
          services_rendered: servicesRendered 
        }),
        performedById: session.user.id,
        ipAddress,
      });

      return NextResponse.json({ 
        id, 
        invoiceNumber,
        message: 'Invoice created successfully' 
      });
    }
  } catch (error) {
    console.error('Error creating billing record:', error);
    return NextResponse.json({ error: 'Failed to create billing record' }, { status: 500 });
  }
}
