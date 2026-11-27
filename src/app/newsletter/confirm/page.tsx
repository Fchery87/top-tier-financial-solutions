'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Status = 'idle' | 'loading' | 'done' | 'error';

// Confirmation needs a deliberate click (a POST), so mail scanners and link
// previewers that merely fetch the URL can't subscribe anyone.
function ConfirmForm() {
  const token = useSearchParams().get('token');
  const [status, setStatus] = useState<Status>('idle');

  async function confirm() {
    setStatus('loading');
    try {
      const response = await fetch('/api/newsletter/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      setStatus(response.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  }

  if (!token) {
    return <p role="alert">This confirmation link is invalid. Please use the link in your email.</p>;
  }

  if (status === 'done') {
    return <p role="status">Thank you! Your subscription is confirmed.</p>;
  }

  return (
    <div className="space-y-4">
      <p>Confirm that you&apos;d like to receive our newsletter.</p>
      <button
        type="button"
        onClick={confirm}
        disabled={status === 'loading'}
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60"
      >
        {status === 'loading' ? 'Confirming…' : 'Confirm subscription'}
      </button>
      {status === 'error' && (
        <p role="alert">This link is invalid or has expired. Please sign up again to get a new one.</p>
      )}
    </div>
  );
}

export default function NewsletterConfirmPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-24">
      <h1 className="mb-6 text-2xl font-semibold">Confirm your subscription</h1>
      <Suspense fallback={null}>
        <ConfirmForm />
      </Suspense>
    </main>
  );
}
