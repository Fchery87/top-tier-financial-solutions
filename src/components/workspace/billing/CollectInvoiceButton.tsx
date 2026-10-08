'use client';

import * as React from 'react';
import { CHARGE_REFUSAL_COPY } from '@/lib/payment-authorization/types';
import type { ChargeRefusal } from '@/lib/payment-authorization/types';

export function CollectInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [message, setMessage] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const collect = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/billing/invoices/${invoiceId}/collect`, {
        method: 'POST',
      });
      const body = await response.json().catch(() => ({}));
      const outcome = body.outcome as ChargeRefusal['outcome'] | undefined;
      if (outcome && outcome in CHARGE_REFUSAL_COPY) {
        setMessage(CHARGE_REFUSAL_COPY[outcome]);
        return;
      }
      setMessage(body.error || 'Collection was refused.');
    } catch (error) {
      console.error('Error submitting invoice for collection:', error);
      setMessage('Collection was refused.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={collect}
        disabled={submitting}
        className="text-sm font-medium text-secondary hover:underline disabled:opacity-50"
      >
        {submitting ? 'Checking…' : 'Request collection'}
      </button>
      {message && <p className="max-w-xs text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
