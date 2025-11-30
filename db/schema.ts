import { pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    name: text('name'),
    email: text('email').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => ({
    emailUnique: unique().on(t.email),
  })
);
