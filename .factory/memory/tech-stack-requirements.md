# Tech Stack Integration Requirements

**ALWAYS enforce these integrations for all new features, changes, and implementations:**

## Core Stack

### Database: Neon (PostgreSQL)
- All data persistence must use Neon serverless PostgreSQL
- Connection via `@neondatabase/serverless`
- Import: `import { db } from '@/db/client'`

### ORM: Drizzle
- All database operations must use Drizzle ORM
- Schema defined in `db/schema.ts`
- Import schema: `import { tableName } from '@/db/schema'`
- Use Drizzle query builders (`eq`, `desc`, `sql`, etc.) from `drizzle-orm`
- Run migrations with `npm run db:generate` and `npm run db:push`

### File Storage: Cloudflare R2
- All file uploads (documents, attachments, reports) must use R2
- AWS S3-compatible API via `@aws-sdk/client-s3`
- Presigned URLs via `@aws-sdk/s3-request-presigner`
- Existing implementation in credit report uploads

### Authentication: Better-Auth
- All protected routes must validate session via Better-Auth
- Import: `import { auth } from '@/lib/auth'`
- Session check pattern:
```typescript
const session = await auth.api.getSession({ headers: await headers() });
if (!session || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

## Import Path Conventions
- `@/db/client` - Database connection
- `@/db/schema` - Drizzle schema definitions
- `@/lib/auth` - Better-Auth instance
- `@/lib/*` - Utility libraries

## Checklist for New Features
- [ ] Schema changes added to `db/schema.ts`
- [ ] Migration generated and applied
- [ ] API routes use `@/db/client` for database
- [ ] API routes validate auth via Better-Auth
- [ ] File uploads use Cloudflare R2
- [ ] Relations defined in schema if applicable
