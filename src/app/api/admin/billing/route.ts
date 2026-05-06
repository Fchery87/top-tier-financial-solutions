import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { feeConfigurations, clientBillingProfiles, invoices, paymentAuditLog, clients, serviceEngagements, servicesRenderedEvents, complianceGateChecks } from '@/db/schema';
import { and, eq, desc, sql } from 'drizzle-orm';
import { headers } from 'next/headers';
import { evaluateComplianceGateAction } from '@/lib/compliance-gate';
import { evaluateBillingReadiness } from '@/lib/billing-readiness';
import { getAdminSessionUser } from '@/lib/admin-session';
import { formatClientDisplayIdentity } from '@/lib/client-display-identity';

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
    const adminUser = await getAdminSessionUser('admin');
    if (!adminUser) {
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
    console.error('Error fetching billing data:', error);
    return NextResponse.json({ error: 'Failed to fetch billing data' }, { status: 500 });
  }
}

// POST - Create fee config, billing profile, or invoice
export async function POST(request: NextRequest) {
  try {
    const adminUser = await getAdminSessionUser('admin');
    if (!adminUser) {
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
      const { clientId, serviceEngagementId, invoiceServiceType, amount, description, dueDate, servicesRendered, feeModel, resultVerified } = body;

      if (!clientId || !amount) {
        return NextResponse.json({ error: 'Client ID and amount are required' }, { status: 400 });
      }

      if (!serviceEngagementId) {
        return NextResponse.json({ error: 'Service engagement ID is required' }, { status: 400 });
      }

      // CROA Compliance: Services must be rendered before invoicing
      if (!servicesRendered) {
        return NextResponse.json({ 
          error: 'CROA Compliance: Services must be documented before creating an invoice',
          code: 'CROA_SERVICES_REQUIRED'
        }, { status: 400 });
      }

      const [engagement] = await db
        .select({
          id: serviceEngagements.id,
          serviceType: serviceEngagements.serviceType,
        })
        .from(serviceEngagements)
        .where(and(
          eq(serviceEngagements.id, serviceEngagementId),
          eq(serviceEngagements.clientId, clientId),
        ))
        .limit(1);

      if (!engagement) {
        return NextResponse.json({ error: 'Service engagement not found for client' }, { status: 404 });
      }

      if (invoiceServiceType === 'credit_audit' && engagement.serviceType !== 'credit_audit') {
        return NextResponse.json({
          error: 'Credit Audit invoices require a separate Credit Audit engagement',
          code: 'CREDIT_AUDIT_ENGAGEMENT_REQUIRED'
        }, { status: 400 });
      }

      const [qualifyingEvent] = await db
        .select({
          id: servicesRenderedEvents.id,
          eventType: servicesRenderedEvents.eventType,
          occurredAt: servicesRenderedEvents.occurredAt,
        })
        .from(servicesRenderedEvents)
        .where(and(
          eq(servicesRenderedEvents.clientId, clientId),
          eq(servicesRenderedEvents.serviceEngagementId, serviceEngagementId),
          eq(servicesRenderedEvents.eventType, 'first_dispute_package_submitted'),
        ))
        .limit(1);

      if (!qualifyingEvent) {
        return NextResponse.json({
          error: 'A qualifying Services Rendered event is required before an invoice can become payable',
          code: 'SERVICES_RENDERED_EVENT_REQUIRED'
        }, { status: 400 });
      }

      const gateRecords = await db
        .select({
          checkKey: complianceGateChecks.checkKey,
          passed: complianceGateChecks.passed,
          checkedAt: complianceGateChecks.checkedAt,
          notes: complianceGateChecks.notes,
        })
        .from(complianceGateChecks)
        .where(eq(complianceGateChecks.engagementId, serviceEngagementId));

      const complianceDecision = evaluateComplianceGateAction({
        records: gateRecords,
        action: 'create_payable_invoice',
      });

      if (!complianceDecision.allowed) {
        return NextResponse.json({
          error: 'Compliance Gate must pass before creating a payable invoice',
          code: complianceDecision.code,
          blocking_checks: complianceDecision.blockingChecks,
        }, { status: 409 });
      }

      const billingReadiness = evaluateBillingReadiness({
        hasQualifyingServicesRenderedEvent: true,
        feeModel,
        hasVerifiedResult: resultVerified === true,
      });

      if (!billingReadiness.payable) {
        return NextResponse.json({
          error: billingReadiness.reason,
          code: billingReadiness.code,
        }, { status: 409 });
      }

      const id = crypto.randomUUID();
      const invoiceNumber = generateInvoiceNumber();

      await db.insert(invoices).values({
        id,
        clientId,
        invoiceNumber,
        amount,
        status: 'pending',
        servicesRendered: JSON.stringify({
          event_id: qualifyingEvent.id,
          event_type: qualifyingEvent.eventType,
          details: servicesRendered,
        }),
        servicesRenderedAt: qualifyingEvent.occurredAt,
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
          readiness_reason: 'qualifying_services_rendered_event',
          service_engagement_id: serviceEngagementId,
          services_rendered_event_id: qualifyingEvent.id,
          services_rendered_event_type: qualifyingEvent.eventType,
          services_rendered_event_occurred_at: qualifyingEvent.occurredAt?.toISOString(),
          services_rendered: servicesRendered 
        }),
        performedById: adminUser.id,
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
