'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

// Rendered only when the root layout itself fails, so it replaces the whole
// document and must supply <html> and <body>. Kept dependency-free on purpose:
// the app's providers and styles may be the thing that crashed.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '1rem',
        }}
      >
        <div>
          <h1>Something went wrong</h1>
          <p>We hit an unexpected error. Please try again.</p>
          {error.digest && <p style={{ fontSize: '0.75rem' }}>Error ID: {error.digest}</p>}
          <button type="button" onClick={reset}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
