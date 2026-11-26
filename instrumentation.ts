/**
 * Instrumentation file for Sentry initialization
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
import * as Sentry from '@sentry/nextjs';

export async function register() {
  // Server SDK. Client SDK lives in instrumentation-client.ts.
  // No edge-runtime routes exist, so there is no edge config.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
}

// Reports errors thrown in Server Components, route handlers and the proxy.
export const onRequestError = Sentry.captureRequestError;
