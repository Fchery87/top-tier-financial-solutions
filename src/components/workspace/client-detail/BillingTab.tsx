'use client';

import * as React from 'react';
import { CheckCircle2, CircleDashed, CreditCard, FileText, Loader2, Receipt, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/format';
import type { ClientBillingView } from '@/lib/client-billing';

type Engagement = ClientBillingView['engagements'][number];
type Invoice = ClientBillingView['invoices'][number];
type GateCheck = Engagement['gate']['checks'][number];

type Dialog =
  | { kind: 'payment' | 'refund'; invoice: Invoice }
  | { kind: 'void'; invoice: Invoice }
  | { kind: 'invoice'; engagement: Engagement }
  | { kind: 'attest'; engagement: Engagement; check: GateCheck };

const SALES_CHANNEL_OPTIONS = [
  { value: '', label: 'Not recorded' },
  { value: 'telemarketing', label: 'Telemarketing (phone sale)' },
  { value: 'online', label: 'Online' },
  { value: 'in_person', label: 'In person' },
];

const METHOD_OPTIONS = [
  { value: 'zelle', label: 'Zelle' },
  { value: 'check', label: 'Check' },
  { value: 'bank_ach', label: 'Bank transfer (client-initiated)' },
  { value: 'card_external', label: 'Card (external terminal)' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

const INVOICE_STATUS_VARIANT: Record<string, BadgeVariant> = {
  draft: 'default',
  pending: 'warning',
  paid: 'success',
  refunded: 'info',
  void: 'danger',
};

const dayInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
const dayToIso = (day: string) => (day ? `${day}T00:00:00.000Z` : null);
const today = () => new Date().toISOString().slice(0, 10);

function dollarsToCents(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  return Math.round(Number(value) * 100);
}

async function send(url: string, method: string, body: unknown): Promise<boolean> {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (response.ok) return true;
  const data = await response.json().catch(() => ({}));
  const blockers = Array.isArray(data.blockers) ? data.blockers.map((b: { message: string }) => b.message).join(' ') : '';
  toast.error([data.error || 'Request failed', blockers].filter(Boolean).join(' '));
  return false;
}

function Modal({ title, description, onClose, children }: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <Card className="bg-card border-border shadow-2xl">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-4">{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

export function BillingTab({ clientId }: { clientId: string }) {
  const [data, setData] = React.useState<ClientBillingView | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [dialog, setDialog] = React.useState<Dialog | null>(null);

  const load = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/workspace/clients/${clientId}/billing`);
      if (!response.ok) throw new Error('Failed to load billing');
      setData(await response.json());
    } catch (error) {
      console.error('Error loading billing:', error);
      toast.error('Could not load billing for this client');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const done = async (ok: boolean, message: string) => {
    if (!ok) return;
    toast.success(message);
    setDialog(null);
    await load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground text-center py-8">Billing is unavailable for this client.</p>;
  }

  const engagementById = new Map(data.engagements.map((engagement) => [engagement.id, engagement]));

  return (
    <div className="space-y-6">
      <FeePlanCard data={data} clientId={clientId} onSaved={(ok) => done(ok, 'Fee plan saved')} />

      {data.engagements.length === 0 ? (
        <Card className="bg-card border border-border">
          <CardContent className="py-8 text-sm text-muted-foreground text-center">
            This client has no service engagement yet.
          </CardContent>
        </Card>
      ) : (
        data.engagements.map((engagement) => (
          <EngagementCard
            key={engagement.id}
            engagement={engagement}
            reports={data.credit_reports}
            onSaved={(ok) => done(ok, 'Billing facts saved')}
            onAttest={(check) => setDialog({ kind: 'attest', engagement, check })}
            onCreateInvoice={() => setDialog({ kind: 'invoice', engagement })}
          />
        ))
      )}

      <Card className="bg-card border border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4 text-secondary" />
            Services rendered
          </CardTitle>
          <CardDescription>Recorded service events that can back an invoice.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.services_rendered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No services rendered yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.services_rendered.map((event) => (
                <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="capitalize">{event.event_type.replace(/_/g, ' ')}</span>
                  <span className="text-muted-foreground">
                    {event.occurred_at ? new Date(event.occurred_at).toLocaleDateString() : '—'}
                    {event.invoice_id ? ' · invoiced' : ' · not invoiced'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Receipt className="h-4 w-4 text-secondary" />
            Invoices
          </CardTitle>
          <CardDescription>Payments received outside the app are recorded here against each invoice.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No invoices yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3 font-medium">Invoice</th>
                    <th className="py-2 pr-3 font-medium text-right">Amount</th>
                    <th className="py-2 pr-3 font-medium text-right">Paid</th>
                    <th className="py-2 pr-3 font-medium text-right">Balance</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map((invoice) => {
                    const engagement = invoice.service_engagement_id ? engagementById.get(invoice.service_engagement_id) : undefined;
                    const payable = engagement?.payable === true;
                    return (
                      <tr key={invoice.id} className="border-b border-border/50 align-top">
                        <td className="py-2 pr-3 font-mono text-xs">{invoice.invoice_number}</td>
                        <td className="py-2 pr-3 text-right">{formatCurrency(invoice.amount_cents)}</td>
                        <td className="py-2 pr-3 text-right">{formatCurrency(invoice.net_paid_cents)}</td>
                        <td className="py-2 pr-3 text-right">{formatCurrency(invoice.balance_cents)}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={INVOICE_STATUS_VARIANT[invoice.status] ?? 'default'} className="capitalize">{invoice.status}</Badge>
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap justify-end gap-2">
                            {invoice.status === 'pending' && (
                              <Button size="sm" variant="outline" disabled={!payable} onClick={() => setDialog({ kind: 'payment', invoice })}>
                                Record payment
                              </Button>
                            )}
                            {invoice.net_paid_cents > 0 && (
                              <Button size="sm" variant="outline" onClick={() => setDialog({ kind: 'refund', invoice })}>
                                Record refund
                              </Button>
                            )}
                            {invoice.status !== 'void' && invoice.net_paid_cents === 0 && (
                              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDialog({ kind: 'void', invoice })}>
                                Void
                              </Button>
                            )}
                          </div>
                          {invoice.status === 'pending' && !payable && (
                            <p className="mt-1 text-xs text-muted-foreground text-right">
                              Payments are blocked until the engagement is payable. See the reasons above.
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {(dialog?.kind === 'payment' || dialog?.kind === 'refund') && (
        <LedgerEntryDialog
          kind={dialog.kind}
          invoice={dialog.invoice}
          onClose={() => setDialog(null)}
          onSubmit={async (body) => done(
            await send(`/api/workspace/billing/invoices/${dialog.invoice.id}/payments`, 'POST', body),
            dialog.kind === 'payment' ? 'Payment recorded' : 'Refund recorded',
          )}
        />
      )}

      {dialog?.kind === 'void' && (
        <VoidDialog
          invoice={dialog.invoice}
          onClose={() => setDialog(null)}
          onSubmit={async (reason) => done(
            await send(`/api/workspace/billing/invoices/${dialog.invoice.id}/void`, 'POST', { reason }),
            'Invoice voided',
          )}
        />
      )}

      {dialog?.kind === 'invoice' && (
        <CreateInvoiceDialog
          engagement={dialog.engagement}
          events={data.services_rendered.filter((event) => event.service_engagement_id === dialog.engagement.id && !event.invoice_id)}
          defaultAmountCents={data.fee_plan?.amount_cents ?? null}
          onClose={() => setDialog(null)}
          onSubmit={async (body) => done(
            await send('/api/workspace/billing', 'POST', { type: 'invoice', clientId, serviceEngagementId: dialog.engagement.id, ...body }),
            'Invoice created',
          )}
        />
      )}

      {dialog?.kind === 'attest' && (
        <AttestDialog
          check={dialog.check}
          onClose={() => setDialog(null)}
          onSubmit={async (passed, notes) => done(
            await send(`/api/workspace/service-engagements/${dialog.engagement.id}/compliance-gate`, 'POST', {
              checkKey: dialog.check.key,
              passed,
              notes,
            }),
            'Check updated',
          )}
        />
      )}
    </div>
  );
}

function FeePlanCard({ data, clientId, onSaved }: {
  data: ClientBillingView;
  clientId: string;
  onSaved: (ok: boolean) => void;
}) {
  const [feeConfigId, setFeeConfigId] = React.useState(data.fee_plan?.fee_config_id ?? '');
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    try {
      onSaved(await send('/api/workspace/billing', 'POST', { type: 'billing_profile', clientId, feeConfigId }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-card border border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <CreditCard className="h-4 w-4 text-secondary" />
          Fee plan
        </CardTitle>
        <CardDescription>
          {data.fee_plan
            ? `${data.fee_plan.name}: ${formatCurrency(data.fee_plan.amount_cents)}${data.fee_plan.frequency ? ` (${data.fee_plan.frequency.replace(/_/g, ' ')})` : ''}`
            : 'No fee plan. Agreements cannot be sent until one is set.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Select
            value={feeConfigId}
            onChange={(e) => setFeeConfigId(e.target.value)}
            placeholder="Choose a fee plan"
            options={data.fee_configs.map((config) => ({
              value: config.id,
              label: `${config.name} (${formatCurrency(config.amount_cents)})`,
            }))}
          />
        </div>
        <Button onClick={save} disabled={saving || !feeConfigId || feeConfigId === data.fee_plan?.fee_config_id}>
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Save fee plan
        </Button>
      </CardContent>
    </Card>
  );
}

function EngagementCard({ engagement, reports, onSaved, onAttest, onCreateInvoice }: {
  engagement: Engagement;
  reports: ClientBillingView['credit_reports'];
  onSaved: (ok: boolean) => void;
  onAttest: (check: GateCheck) => void;
  onCreateInvoice: () => void;
}) {
  const [facts, setFacts] = React.useState({
    salesChannel: engagement.sales_channel ?? '',
    servicePeriodEndsAt: dayInput(engagement.service_period_ends_at),
    resultsAchievedAt: dayInput(engagement.results_achieved_at),
    resultsVerificationReportId: engagement.results_verification_report_id ?? '',
  });
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    try {
      onSaved(await send(`/api/workspace/service-engagements/${engagement.id}/billing-facts`, 'PATCH', {
        salesChannel: facts.salesChannel || null,
        servicePeriodEndsAt: dayToIso(facts.servicePeriodEndsAt),
        resultsAchievedAt: dayToIso(facts.resultsAchievedAt),
        resultsVerificationReportId: facts.resultsVerificationReportId || null,
      }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-card border border-border">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold capitalize">
            <ShieldCheck className="h-4 w-4 text-secondary" />
            {engagement.service_type.replace(/_/g, ' ')} engagement
          </CardTitle>
          <CardDescription className="capitalize">
            {engagement.status} · {engagement.lifecycle_stage.replace(/_/g, ' ')}
          </CardDescription>
        </div>
        <Badge variant={engagement.payable ? 'success' : 'warning'}>
          {engagement.payable ? 'Payable' : 'Not payable yet'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sales channel">
            <Select
              value={facts.salesChannel}
              onChange={(e) => setFacts({ ...facts, salesChannel: e.target.value })}
              options={SALES_CHANNEL_OPTIONS}
            />
          </Field>
          <Field label="Represented service period ends">
            <Input type="date" value={facts.servicePeriodEndsAt} onChange={(e) => setFacts({ ...facts, servicePeriodEndsAt: e.target.value })} />
          </Field>
          <Field label="Results achieved on">
            <Input type="date" value={facts.resultsAchievedAt} onChange={(e) => setFacts({ ...facts, resultsAchievedAt: e.target.value })} />
          </Field>
          <Field label="Verifying credit report">
            <Select
              value={facts.resultsVerificationReportId}
              onChange={(e) => setFacts({ ...facts, resultsVerificationReportId: e.target.value })}
              options={[
                { value: '', label: 'None' },
                ...reports.map((report) => ({
                  value: report.id,
                  label: `${report.report_date ? report.report_date.slice(0, 10) : 'No date'} · ${report.bureau ?? 'report'} · ${report.file_name}`,
                })),
              ]}
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Save billing facts
          </Button>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Compliance gate</p>
          <ul className="space-y-1">
            {engagement.gate.checks.map((check) => (
              <li key={check.key} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  {check.passed
                    ? <CheckCircle2 className="h-4 w-4 text-success" />
                    : <CircleDashed className="h-4 w-4 text-muted-foreground" />}
                  {check.label}
                  {!check.passed && check.notes && <span className="text-xs text-muted-foreground">({check.notes})</span>}
                </span>
                {check.source === 'attested' ? (
                  <Button size="sm" variant="ghost" onClick={() => onAttest(check)}>
                    {check.passed ? 'Revoke' : 'Attest'}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">From records</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          {engagement.blockers.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
              {engagement.blockers.map((blocker) => <li key={blocker.kind}>{blocker.message}</li>)}
            </ul>
          )}
          <div className="flex justify-end">
            <Button onClick={onCreateInvoice} disabled={!engagement.payable}>Create invoice</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LedgerEntryDialog({ kind, invoice, onClose, onSubmit }: {
  kind: 'payment' | 'refund';
  invoice: Invoice;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const max = kind === 'payment' ? invoice.balance_cents : invoice.net_paid_cents;
  const [form, setForm] = React.useState({
    amount: (max / 100).toFixed(2),
    method: 'zelle',
    reference: '',
    receivedAt: today(),
    notes: '',
  });
  const [submitting, setSubmitting] = React.useState(false);
  const amountCents = dollarsToCents(form.amount);
  const valid = amountCents !== null && amountCents > 0 && amountCents <= max && Boolean(form.receivedAt);

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    try {
      await onSubmit({
        kind,
        method: form.method,
        amountCents,
        reference: form.reference,
        receivedAt: dayToIso(form.receivedAt),
        notes: form.notes,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={kind === 'payment' ? 'Record payment' : 'Record refund'}
      description={`${invoice.invoice_number} · up to ${formatCurrency(max)}`}
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Amount ($)">
          <Input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field label={kind === 'payment' ? 'Received on' : 'Returned on'}>
          <Input type="date" max={today()} value={form.receivedAt} onChange={(e) => setForm({ ...form, receivedAt: e.target.value })} />
        </Field>
      </div>
      <Field label="Method">
        <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} options={METHOD_OPTIONS} />
      </Field>
      <Field label="Reference (check number, confirmation code)">
        <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
      </Field>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" onClick={submit} disabled={!valid || submitting}>
          {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Save
        </Button>
      </div>
    </Modal>
  );
}

function VoidDialog({ invoice, onClose, onSubmit }: {
  invoice: Invoice;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(reason.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Void invoice" description={`${invoice.invoice_number} cannot be reopened once voided.`} onClose={onClose}>
      <Field label="Reason">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button variant="destructive" className="flex-1" onClick={submit} disabled={!reason.trim() || submitting}>
          {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Void invoice
        </Button>
      </div>
    </Modal>
  );
}

function CreateInvoiceDialog({ engagement, events, defaultAmountCents, onClose, onSubmit }: {
  engagement: Engagement;
  events: ClientBillingView['services_rendered'];
  defaultAmountCents: number | null;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = React.useState({
    eventId: events[0]?.id ?? '',
    amount: defaultAmountCents !== null ? (defaultAmountCents / 100).toFixed(2) : '',
    description: '',
    dueDate: '',
  });
  const [submitting, setSubmitting] = React.useState(false);
  const amountCents = dollarsToCents(form.amount);
  const valid = Boolean(form.eventId) && amountCents !== null && amountCents > 0;

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    try {
      await onSubmit({
        servicesRenderedEventId: form.eventId,
        amount: amountCents,
        description: form.description,
        dueDate: dayToIso(form.dueDate),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Create invoice"
      description={`Bills a services-rendered event on the ${engagement.service_type.replace(/_/g, ' ')} engagement.`}
      onClose={onClose}
    >
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Every services-rendered event on this engagement already has an open invoice.</p>
      ) : (
        <Field label="Services-rendered event">
          <Select
            value={form.eventId}
            onChange={(e) => setForm({ ...form, eventId: e.target.value })}
            options={events.map((event) => ({
              value: event.id,
              label: `${event.event_type.replace(/_/g, ' ')} · ${event.occurred_at ? event.occurred_at.slice(0, 10) : ''}`,
            }))}
          />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Amount ($)">
          <Input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field label="Due date">
          <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        </Field>
      </div>
      <Field label="Description">
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" onClick={submit} disabled={!valid || submitting}>
          {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Create invoice
        </Button>
      </div>
    </Modal>
  );
}

function AttestDialog({ check, onClose, onSubmit }: {
  check: GateCheck;
  onClose: () => void;
  onSubmit: (passed: boolean, notes: string) => Promise<void>;
}) {
  const passed = !check.passed;
  const [notes, setNotes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(passed, notes.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={passed ? `Attest: ${check.label}` : `Revoke: ${check.label}`}
      description="The note is saved with the check, and the change is logged under your name."
      onClose={onClose}
    >
      <Field label={passed ? 'What did you confirm, and where is the record?' : 'Why is this no longer true?'}>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" onClick={submit} disabled={!notes.trim() || submitting}>
          {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {passed ? 'Attest' : 'Revoke'}
        </Button>
      </div>
    </Modal>
  );
}
