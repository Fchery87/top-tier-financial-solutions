# API Routes - Agent Development Guide

## Package Identity
Next.js API Routes handling authentication, admin operations, client portal, and public endpoints. Uses Better Auth for authentication and Drizzle ORM for database operations.

## Setup & Run
```bash
# From project root
npm run dev                    # Starts Next.js with API routes
npm run typecheck             # TypeScript validation
npm run lint                  # ESLint validation
```

## Patterns & Conventions

### File Organization
- Route structure mirrors URL paths (`/api/admin/clients/route.ts`)
- Each route file exports HTTP method functions (GET, POST, PUT, DELETE)
- Authentication handled via `auth.api.getSession()` pattern
- Database operations use Drizzle ORM with proper error handling

### Authentication Pattern
All protected routes must validate sessions:
```typescript
// ✅ DO: Copy from src/app/api/admin/clients/route.ts
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

async function validateSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.email) {
    return null;
  }
  
  return session.user;
}
```

### Response Pattern
Consistent JSON response structure:
```typescript
// ✅ DO: Success response
return NextResponse.json({
  items: formattedData,
  total: totalCount,
  page,
  limit,
});

// ✅ DO: Error response
return NextResponse.json({ error: 'Error message' }, { status: 400 });
```

### Database Operations
Use Drizzle with proper joins and error handling:
```typescript
// ✅ DO: Copy pattern from admin clients route
try {
  const items = await db
    .select({...})
    .from(clients)
    .leftJoin(user, eq(clients.userId, user.id))
    .where(whereClause)
    .orderBy(orderDirection(sortColumn))
    .limit(limit)
    .offset(offset);
    
  return NextResponse.json({ items });
} catch (error) {
  console.error('Error fetching data:', error);
  return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
}
```

### Query Parameters Pattern
Consistent parameter handling with defaults:
```typescript
// ✅ DO: Copy from admin clients route
const searchParams = request.nextUrl.searchParams;
const page = parseInt(searchParams.get('page') || '1');
const limit = parseInt(searchParams.get('limit') || '10');
const search = searchParams.get('search') || '';
const sortBy = searchParams.get('sort_by') || 'created_at';
const sortOrder = searchParams.get('sort_order') || 'desc';
```

## Touch Points / Key Files
- Authentication config: `src/lib/auth.ts`
- Database client: `src/db/client.ts`
- Database schema: `src/db/schema.ts`
- Admin auth utilities: `src/lib/admin-auth.ts`
- Email service: `src/lib/email-service.ts`

## JIT Index Hints
- Find all API routes: `find src/app/api -name "route.ts"`
- Find admin APIs: `find src/app/api/admin -name "route.ts"`
- Find portal APIs: `find src/app/api/portal -name "route.ts"`
- Search for authentication: `rg -n "auth\.api\.getSession" src/app/api/`
- Find database operations: `rg -n "db\." src/app/api/`
- Search for error handling: `rg -n "console\.error|NextResponse\.json.*error" src/app/api/`

## Common Gotchas
- Always validate sessions before processing requests
- Use proper HTTP status codes (400 for client errors, 500 for server errors)
- Sanitize and validate input data before database operations
- Use `headers()` from 'next/headers' for session validation
- Database field names use camelCase in code but snake_case in API responses
- PII fields (SSN, DOB) require extra validation and secure handling

## Pre-PR Checks
```bash
npm run typecheck && npm run lint
# Test API endpoints manually or with integration tests
```
