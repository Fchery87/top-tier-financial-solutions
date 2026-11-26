'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Status = 'idle' | 'loading' | 'done' | 'error';

function UnsubscribeForm() {
  const token = useSearchParams().get('token');
  const [status, setStatus] = useState<Status>('idle');

  async function confirm() {
    setStatus('loading');
    try {
      const response = await fetch('/api/newsletter/unsubscribe', {
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
    return <p role="alert">This unsubscribe link is invalid. Please use the link in your email.</p>;
  }

  if (status === 'done') {
    return <p role="status">You have been unsubscribed. You will no longer receive our newsletter.</p>;
  }

  return (
    <div className="space-y-4">
      <p>Click below to stop receiving our newsletter.</p>
      <button
        type="button"
        onClick={confirm}
        disabled={status === 'loading'}
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60"
      >
        {status === 'loading' ? 'Unsubscribing…' : 'Confirm unsubscribe'}
      </button>
      {status === 'error' && (
        <p role="alert">We couldn&apos;t process that link. Please try again or contact us.</p>
      )}
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <main className="mx-auto max-w-md px-4 py-24">
      <h1 className="mb-6 text-2xl font-semibold">Unsubscribe</h1>
      <Suspense fallback={null}>
        <UnsubscribeForm />
      </Suspense>
    </main>
  );
}
