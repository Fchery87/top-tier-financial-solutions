# Security Remediation Plan

**Generated:** 2025-12-03  
**Overall Risk Level:** HIGH  
**Total Findings:** 10

---

## Critical Priority (Fix Immediately)

### 1. Authorization Bypass in Role Management API

**File:** `src/app/api/admin/set-role/route.ts`  
**Risk:** CRITICAL  
**Effort:** 30 minutes

**Current Issue:**
```typescript
// VULNERABLE: requesterEmail comes from request body - can be spoofed
const { email, role, requesterEmail } = await request.json();
```

**Fix:**
```typescript
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  // Get actual authenticated user from session
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Verify requester is super_admin using ACTUAL session email
  const isRequesterSuperAdmin = await isSuperAdmin(session.user.email);
  
  // Count existing super_admins for first-time setup
  const superAdminCount = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.role, 'super_admin'));

  const isFirstSuperAdmin = superAdminCount.length === 0;

  if (!isFirstSuperAdmin && !isRequesterSuperAdmin) {
    return NextResponse.json(
      { success: false, error: 'Only super_admin can modify roles' },
      { status: 403 }
    );
  }
  
  // ... rest of role update logic
}
```

---

### 2. Admin Access Check Information Disclosure

**File:** `src/app/api/admin/check-access/route.ts`  
**Risk:** CRITICAL  
**Effort:** 30 minutes

**Current Issue:**
```typescript
// VULNERABLE: Anyone can check if any email is admin
const { email } = await request.json();
const authorized = await isSuperAdmin(email);
```

**Fix:**
```typescript
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  // Get session first
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.email) {
    return NextResponse.json({ authorized: false }, { status: 401 });
  }
  
  // Only check authorization for the ACTUAL logged-in user
  const authorized = await isSuperAdmin(session.user.email);
  
  return NextResponse.json({ authorized });
}
```

---

### 3. Rotate Compromised Secrets

**Risk:** CRITICAL  
**Effort:** 1 hour

**Secrets to Rotate:**
- [ ] `DATABASE_URL` - Generate new Neon database password
- [ ] `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` - Regenerate in Cloudflare dashboard
- [ ] `GOOGLE_AI_API_KEY` - Regenerate in Google Cloud Console
- [ ] `BETTER_AUTH_SECRET` - Generate new 64-character hex string

**Steps:**
1. Go to each service dashboard
2. Generate new credentials
3. Update production environment variables (Vercel/hosting provider)
4. Update local `.env` file
5. Verify application still works
6. Revoke old credentials

---

## High Priority (Fix This Week)

### 4. XSS Prevention - Add DOMPurify

**Files:**
- `src/app/admin/agreements/page.tsx:587`
- `src/app/blog/[slug]/page.tsx:123`
- `src/app/portal/agreement/page.tsx:405, 439`

**Risk:** HIGH  
**Effort:** 1 hour

**Install:**
```bash
npm install dompurify
npm install -D @types/dompurify
```

**Fix Pattern:**
```typescript
import DOMPurify from 'dompurify';

// Before (vulnerable)
dangerouslySetInnerHTML={{ __html: content }}

// After (safe)
dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
```

**Files to Update:**
- [ ] `src/app/admin/agreements/page.tsx` - Line 587
- [ ] `src/app/blog/[slug]/page.tsx` - Line 123
- [ ] `src/app/portal/agreement/page.tsx` - Lines 405, 439

---

### 5. Implement Rate Limiting

**Risk:** HIGH  
**Effort:** 2-3 hours

**Option A: Upstash Rate Limiting (Recommended for Vercel)**

```bash
npm install @upstash/ratelimit @upstash/redis
```

Create `src/lib/rate-limit.ts`:
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Create rate limiter instance
export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'), // 10 requests per 10 seconds
  analytics: true,
});

// Stricter limiter for auth endpoints
export const authRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '60 s'), // 5 requests per minute
});
```

**Usage in API routes:**
```typescript
import { ratelimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
  const { success, limit, reset, remaining } = await ratelimit.limit(ip);
  
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
        }
      }
    );
  }
  
  // ... rest of handler
}
```

**Priority Endpoints:**
- [ ] `/api/auth/[...all]` - Auth endpoints
- [ ] `/api/newsletter/subscribe` - Newsletter signup
- [ ] `/api/admin/set-role` - Role management
- [ ] `/api/admin/disputes/generate-letter` - AI generation (expensive)

---

## Medium Priority (Fix This Month)

### 6. Update Vulnerable Dependencies

**Risk:** MEDIUM  
**Effort:** 30 minutes

```bash
# Check current vulnerabilities
npm audit

# Auto-fix where possible
npm audit fix

# For breaking changes (drizzle-kit)
npm audit fix --force
# OR wait for patched drizzle-kit version
```

**Current Vulnerabilities:**
- esbuild <= 0.24.2 (via drizzle-kit) - Development server request hijacking

---

### 7. Strengthen Content Security Policy

**File:** `src/middleware.ts`  
**Risk:** MEDIUM  
**Effort:** 2 hours

**Current (allows inline scripts):**
```typescript
"script-src 'self' 'unsafe-inline' 'unsafe-eval' ..."
```

**Improved (using nonces):**
```typescript
import { nanoid } from 'nanoid';

export function middleware(request: NextRequest) {
  const nonce = nanoid();
  
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://www.googletagmanager.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // ... rest of CSP
  ].join('; ');
  
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-nonce', nonce); // Pass to app
  
  return response;
}
```

**Note:** Requires updating inline scripts in pages to use nonce attribute.

---

### 8. Add Security Logging

**Risk:** MEDIUM  
**Effort:** 3 hours

Create `src/lib/security-logger.ts`:
```typescript
export async function logSecurityEvent(event: {
  type: 'AUTH_FAILURE' | 'PERMISSION_DENIED' | 'RATE_LIMITED' | 'SUSPICIOUS_ACTIVITY';
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}) {
  // Log to database or external service (Sentry, DataDog, etc.)
  console.warn('[SECURITY]', JSON.stringify({
    ...event,
    timestamp: new Date().toISOString(),
  }));
  
  // Optional: Send to external monitoring
  // await sendToSentry(event);
}
```

**Usage:**
```typescript
// In auth routes
if (!session) {
  await logSecurityEvent({
    type: 'AUTH_FAILURE',
    ip: request.headers.get('x-forwarded-for'),
    details: { endpoint: '/api/admin/...' }
  });
}
```

---

### 9. Add CSRF Protection

**Risk:** MEDIUM  
**Effort:** 2 hours

**Option: Use better-auth's built-in CSRF protection**

Better-auth already includes CSRF protection. Verify it's enabled:
```typescript
// src/lib/auth.ts
export const auth = betterAuth({
  // ... existing config
  advanced: {
    csrf: {
      enabled: true,
    },
  },
});
```

For custom forms, include CSRF token:
```typescript
// Client-side
import { useSession } from '@/lib/auth-client';

const { data: session } = useSession();
// Include session.csrfToken in form submissions
```

---

## Low Priority (Ongoing)

### 10. Security Testing in CI/CD

**Risk:** LOW  
**Effort:** 4 hours

Add to `.github/workflows/security.yml`:
```yaml
name: Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0' # Weekly

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run npm audit
        run: npm audit --audit-level=moderate
        
      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
          
      - name: Run CodeQL analysis
        uses: github/codeql-action/analyze@v2
```

---

## Checklist Summary

### Critical (Do Today)
- [ ] Fix `/api/admin/set-role` authorization bypass
- [ ] Fix `/api/admin/check-access` information disclosure
- [ ] Rotate database password
- [ ] Rotate R2 access keys
- [ ] Rotate Google AI API key
- [ ] Rotate Better Auth secret

### High (This Week)
- [ ] Install and implement DOMPurify
- [ ] Set up Upstash rate limiting
- [ ] Apply rate limits to auth endpoints
- [ ] Apply rate limits to newsletter endpoint

### Medium (This Month)
- [ ] Update vulnerable dependencies
- [ ] Implement CSP nonces
- [ ] Add security event logging
- [ ] Verify CSRF protection

### Low (Ongoing)
- [ ] Set up security CI/CD pipeline
- [ ] Regular dependency audits
- [ ] Penetration testing

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Headers](https://nextjs.org/docs/advanced-features/security-headers)
- [better-auth Security](https://www.better-auth.com/docs/concepts/security)
- [Upstash Rate Limiting](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)
- [DOMPurify](https://github.com/cure53/DOMPurify)
