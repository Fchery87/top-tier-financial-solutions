/**
 * Instrumentation file for Sentry initialization
 * This file runs when the Node.js process starts
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only initialize Sentry on the server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  // Initialize client Sentry during build and runtime
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.client.config');
  }
}
