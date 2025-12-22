import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 0.1,
  debug: false,

  // Capture replays for 10% of all sessions,
  // plus 100% of sessions with an error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

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
