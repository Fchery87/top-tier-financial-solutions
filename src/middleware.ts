import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Check if this is the audit-report API route (needs to be embedded in iframe)
  const isAuditReportRoute = request.nextUrl.pathname.includes('/audit-report');

  // Security Headers
  const securityHeaders = {
    // HTTPS Strict Transport Security - force HTTPS for 1 year
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    // Prevent clickjacking - allow same-origin for audit report iframe
    'X-Frame-Options': isAuditReportRoute ? 'SAMEORIGIN' : 'DENY',
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    // XSS Protection
    'X-XSS-Protection': '1; mode=block',
    // Referrer Policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Permissions Policy
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    // Content Security Policy
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://plausible.io https://app.cal.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://www.google-analytics.com https://plausible.io https://api.cal.com https://*.cal.com",
      "frame-src 'self' https://app.cal.com https://*.cal.com",
      // Allow same-origin framing for audit report, deny for everything else
      isAuditReportRoute ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
    ].join('; '),
  };

  // Apply security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Redirect HTTP to HTTPS in production
  const proto = request.headers.get('x-forwarded-proto');
  const host = request.headers.get('host');
  
  if (
    process.env.NODE_ENV === 'production' &&
    proto === 'http' &&
    host &&
    !host.includes('localhost')
  ) {
    return NextResponse.redirect(
      `https://${host}${request.nextUrl.pathname}${request.nextUrl.search}`,
      301
    );
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
