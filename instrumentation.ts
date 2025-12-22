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

  // Note: Client Sentry is initialized in src/app/layout.tsx for browser context
  // It should not be imported here as edge runtime doesn't support all integrations
}
