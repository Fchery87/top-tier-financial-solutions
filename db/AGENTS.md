# Database - Agent Development Guide

## Package Identity
Neon PostgreSQL database with Drizzle ORM. Includes Better Auth tables, client management, credit reports, disputes, and business logic tables. Uses HTTP connection for serverless deployment.

## Setup & Run
```bash
# From project root
npm run db:migrate           # Run all pending migrations
npm run db:generate          # Generate new migration from schema changes
npm run db:push             # Push schema changes directly (development only)
npm run db:studio           # Open Drizzle Studio for database inspection
```

## Patterns & Conventions

### Schema Organization
- Auth tables: `user`, `session`, `account`, `verification` (Better Auth)
- Business tables: `clients`, `creditReports`, `disputes`, etc.
- Enum definitions: Use `pgEnum` for type safety
- Relations: Use Drizzle relations for foreign key relationships

### Table Definition Pattern
```typescript
// ✅ DO: Copy from db/schema.ts
export const tableName = pgTable("table_name", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => new Date())
    .notNull(),
});

// Relations
export const tableNameRelations = relations(tableName, ({ one, many }) => ({
  relatedTable: one(relatedTable, {
    fields: [tableName.foreignKey],
    references: [relatedTable.id],
  }),
}));
```

### Database Client Usage
Always import from client, not direct:
```typescript
// ✅ DO: Import from client
import { db } from '@/db/client';
import * as schema from '@/db/schema';

// Usage in API routes
const users = await db.select().from(schema.user);
```

### Migration Workflow
1. Make schema changes in `db/schema.ts`
2. Generate migration: `npm run db:generate`
3. Review generated SQL in `drizzle/` directory
4. Apply migration: `npm run db:migrate`

### Query Patterns
Common Drizzle query patterns:
```typescript
// ✅ DO: Select with joins
const result = await db
  .select({
    id: clients.id,
    name: clients.firstName,
    email: clients.email,
    userName: user.name,
  })
  .from(clients)
  .leftJoin(user, eq(clients.userId, user.id))
  .where(eq(clients.status, 'active'));

// ✅ DO: Insert with validation
await db.insert(clients).values({
  id: randomUUID(),
  firstName: data.first_name,
  email: data.email,
  createdAt: new Date(),
});
```

## Touch Points / Key Files
- Database client: `db/client.ts`
- Schema definition: `db/schema.ts` (1700+ lines)
- Migrations: `drizzle/` directory
- Drizzle config: `drizzle.config.ts`

## JIT Index Hints
- Find all tables: `rg -n "pgTable\(" db/schema.ts`
- Find relations: `rg -n "Relations.*=.*relations" db/schema.ts`
- Find enums: `rg -n "pgEnum\(" db/schema.ts`
- Search for indexes: `rg -n "index\(" db/schema.ts`
- Find migration files: `ls -la drizzle/*.sql`
- Search for foreign keys: `rg -n "references\(" db/schema.ts`
- Find timestamp patterns: `rg -n "timestamp.*created_at|timestamp.*updated_at" db/schema.ts`

## Common Gotchas
- Never modify `drizzle/` SQL files directly - always regenerate
- Use `randomUUID()` for primary keys, not auto-increment
- Always include `createdAt` and `updatedAt` fields with proper defaults
- PII fields (SSN, DOB) require extra care - mark as sensitive in documentation
- Use Drizzle relations for complex queries, not manual joins when possible
- HTTP connection means connection pooling is handled by Neon
- Always use `@/db/client` import path, never direct Drizzle imports in application code

## Schema Domain Knowledge
- **Clients**: Core entity with PII fields (`firstName`, `lastName`, `email`, `phone`, `streetAddress`, `city`, `state`, `zipCode`, `dateOfBirth`, `ssnLast4`)
- **Credit Reports**: Multi-bureau reports with raw data and parsed analysis
- **Disputes**: Credit dispute management with templates, letters, and tracking
- **Users**: Better Auth integration with role-based access (`user`, `admin`, `super_admin`)

## Pre-PR Checks
```bash
npm run db:generate && npm run typecheck && npm run lint
# Review generated migrations before applying
```
