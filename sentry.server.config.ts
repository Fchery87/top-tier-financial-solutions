import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  debug: false,
  enableLogs: true,

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
