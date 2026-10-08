'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/format';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type PublicAuthorizationResponse = {
  id: string;
  status: string;
  bank_name: string;
  account_last4: string;
  account_type: string;
  maximum_amount_cents: number;
  signed_at: string;
  revoked_at: string | null;
  expires_at: string | null;
};

export default function PaymentAuthorizationPage() {
  const [authorization, setAuthorization] = React.useState<PublicAuthorizationResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [bankName, setBankName] = React.useState('');
  const [routingNumber, setRoutingNumber] = React.useState('');
  const [accountNumber, setAccountNumber] = React.useState('');
  const [accountType, setAccountType] = React.useState<'checking' | 'savings'>('checking');
  const [maximumAmount, setMaximumAmount] = React.useState('');
  const [signatureData, setSignatureData] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/portal/payment-authorization');
      if (response.ok) {
        const data = await response.json();
        setAuthorization(data.authorization ?? null);
      }
    } catch (error) {
      console.error('Error loading payment authorization:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const maximumAmountCents = Math.round(Number(maximumAmount) * 100);
    setSubmitting(true);
    try {
      const response = await fetch('/api/portal/payment-authorization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bank_name: bankName,
          routing_number: routingNumber,
          account_number: accountNumber,
          account_type: accountType,
          maximum_amount_cents: maximumAmountCents,
          signature_data: signatureData,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error || 'Could not save the authorization');
        return;
      }
      setRoutingNumber('');
      setAccountNumber('');
      setAuthorization(data);
      toast.success('Payment authorization saved');
    } catch (error) {
      console.error('Error saving payment authorization:', error);
      toast.error('Could not save the authorization');
    } finally {
      setSubmitting(false);
    }
  };

  const revoke = async () => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/portal/payment-authorization', { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error || 'Could not revoke the authorization');
        return;
      }
      setAuthorization(null);
      toast.success(data.authorization ? 'Payment authorization revoked' : 'No active authorization');
    } catch (error) {
      console.error('Error revoking payment authorization:', error);
      toast.error('Could not revoke the authorization');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="portal-shell flex flex-col min-h-screen">
      <section className="bg-background/80 py-8 md:py-12">
        <div className="container mx-auto px-4 md:px-6 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Payment authorization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">
                A signed maximum caps future invoices. It is not a monthly debit, and this system does not create demand drafts.
              </p>
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-secondary" />
                </div>
              ) : authorization ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
                    <p className="font-medium">{authorization.bank_name}</p>
                    <p className="text-muted-foreground">Account ending in {authorization.account_last4}</p>
                    <p className="text-muted-foreground">Maximum {formatCurrency(authorization.maximum_amount_cents)}</p>
                  </div>
                  <Button type="button" variant="outline" onClick={revoke} disabled={submitting}>
                    Revoke authorization
                  </Button>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={submit}>
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">Bank name</span>
                    <input
                      className="h-10 w-full rounded-md border border-border bg-card px-3"
                      value={bankName}
                      onChange={(event) => setBankName(event.target.value)}
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">Routing number</span>
                    <input
                      className="h-10 w-full rounded-md border border-border bg-card px-3"
                      inputMode="numeric"
                      autoComplete="off"
                      value={routingNumber}
                      onChange={(event) => setRoutingNumber(event.target.value)}
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">Account number</span>
                    <input
                      className="h-10 w-full rounded-md border border-border bg-card px-3"
                      inputMode="numeric"
                      autoComplete="off"
                      value={accountNumber}
                      onChange={(event) => setAccountNumber(event.target.value)}
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">Account type</span>
                    <select
                      className="h-10 w-full rounded-md border border-border bg-card px-3"
                      value={accountType}
                      onChange={(event) => setAccountType(event.target.value as 'checking' | 'savings')}
                    >
                      <option value="checking">Checking</option>
                      <option value="savings">Savings</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">Maximum amount (dollars)</span>
                    <input
                      className="h-10 w-full rounded-md border border-border bg-card px-3"
                      inputMode="decimal"
                      value={maximumAmount}
                      onChange={(event) => setMaximumAmount(event.target.value)}
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">Signature</span>
                    <input
                      className="h-10 w-full rounded-md border border-border bg-card px-3"
                      value={signatureData}
                      onChange={(event) => setSignatureData(event.target.value)}
                      required
                    />
                  </label>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Saving…' : 'Sign authorization'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
