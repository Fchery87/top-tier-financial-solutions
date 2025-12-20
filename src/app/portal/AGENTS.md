# Client Portal - Agent Development Guide

## Package Identity
Client-facing portal for credit repair customers to track progress, sign agreements, view audit reports, and manage documents. Built with Next.js App Router, TypeScript, and authentication integration.

## Setup & Run
```bash
# From project root
npm run dev                    # Start development server
npm run typecheck             # TypeScript validation
npm run lint                  # ESLint validation
npm run test                  # Component tests
```

## Patterns & Conventions

### File Organization
- Layout: `src/app/portal/layout.tsx` - Portal-specific layout
- Main dashboard: `src/app/portal/page.tsx` - Client overview
- Agreement signing: `src/app/portal/agreement/` - CROA compliance
- Audit reports: `src/app/portal/audit-report/` - Client credit reports
- Sub-routes: Follow Next.js App Router conventions

### Authentication Pattern
Portal routes require client authentication:
```typescript
// ✅ DO: Check client authentication
import { auth } from '@/lib/auth';

async function validateClientAccess() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.email) {
    redirect('/login');
  }
  
  return session.user;
}
```

### Client Data Access Pattern
Secure client-specific data fetching:
```typescript
// ✅ DO: Fetch only client's own data
const clientData = await db
  .select()
  .from(clients)
  .where(eq(clients.email, session.user.email))
  .limit(1);

if (!clientData.length) {
  return NextResponse.json({ error: 'Client not found' }, { status: 404 });
}
```

### Agreement Signing Pattern
CROA-compliant agreement workflow:
```typescript
// ✅ DO: Track agreement signing with audit trail
const agreementData = {
  clientId: client.id,
  ipAddress: request.ip,
  userAgent: request.headers.get('user-agent'),
  signedAt: new Date(),
  // Store IP and timestamp for legal compliance
};
```

## Touch Points / Key Files
- Portal layout: `src/app/portal/layout.tsx`
- Main dashboard: `src/app/portal/page.tsx`
- Agreement page: `src/app/portal/agreement/page.tsx`
- Audit report: `src/app/portal/audit-report/page.tsx`
- Service agreement template: `src/lib/service-agreement-template.ts`

## JIT Index Hints
- Find portal pages: `find src/app/portal -name "page.tsx"`
- Find client-specific routes: `find src/app/api/portal -name "route.ts"`
- Search for client validation: `rg -n "validateClient|client.*auth" src/app/portal/`
- Find agreement logic: `rg -n "agreement|CROA" src/app/portal/`
- Search for client data: `rg -n "clients.*email|client.*access" src/app/portal/`

## Common Gotchas
- All portal routes must validate client access
- Never expose other clients' data
- Agreement signing must be audit-ready (IP, timestamp, user agent)
- Use absolute imports: `@/lib/auth`, `@/db/client`
- Client portal should be read-only except for agreements
- PII data requires secure handling
- Mobile responsiveness is critical for portal users

## CROA Compliance Notes
- 3-day cancellation period must be tracked
- Service agreements require electronic signature with audit trail
- Fee structures must be clearly disclosed
- Client consent required before accessing credit reports
- All communications must be documented and accessible

## Pre-PR Checks
```bash
npm run typecheck && npm run lint && npm run test
# Test client authentication flows manually
# Verify data isolation between clients
```
