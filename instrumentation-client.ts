import * as Sentry from '@sentry/nextjs';

/**
 * Client-side Sentry initialization.
 * Next.js (Turbopack and webpack) loads this file in the browser automatically;
 * the old `sentry.client.config.ts` is ignored under Turbopack.
 *
 * Session Replay is intentionally NOT enabled: this app displays credit-report
 * data and other PII, and replay would record it. Enabling it requires
 * `Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })` and a
 * privacy review first.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 0.1,
  debug: false,

  // Ignore specific errors that are not important
  ignoreErrors: [
    // Browser extensions
    'chrome-extension://',
    'moz-extension://',
    // Random plugins/extensions
    'top.GLOBALS',
    // Network errors often beyond our control
    'NetworkError',
    'Network request failed',
  ],

  // Release tracking for version management
  release: process.env.npm_package_version,
});

// Instruments App Router navigations for tracing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
