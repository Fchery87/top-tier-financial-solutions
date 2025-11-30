import { pgTable, serial, text, timestamp, unique, boolean, integer, index } from 'drizzle-orm/pg-core';
import { relations } from "drizzle-orm";

// Better Auth - User table
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  role: text("role").default('user'), // 'user' | 'admin' | 'super_admin'
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
});

// Better Auth - Session table
export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

// Better Auth - Account table
export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

// Better Auth - Verification table
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// Better Auth Relations
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// Consultation requests (contact/lead form submissions)
export const consultationRequests = pgTable('consultation_requests', {
  id: text('id').primaryKey(), // UUID
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  phoneNumber: text('phone_number'),
  message: text('message'),
  sourcePageSlug: text('source_page_slug'),
  status: text('status').default('pending'), // 'pending' | 'contacted' | 'converted' | 'closed'
  requestedAt: timestamp('requested_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Testimonials
export const testimonials = pgTable('testimonials', {
  id: text('id').primaryKey(), // UUID
  authorName: text('author_name').notNull(),
  authorLocation: text('author_location'),
  quote: text('quote').notNull(),
  orderIndex: integer('order_index').default(0),
  isApproved: boolean('is_approved').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// FAQ Items
export const faqItems = pgTable('faq_items', {
  id: text('id').primaryKey(), // UUID
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  displayOrder: integer('display_order').default(0),
  isPublished: boolean('is_published').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Site pages/content
export const pages = pgTable('pages', {
  id: text('id').primaryKey(), // UUID
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  heroHeadline: text('hero_headline'),
  heroSubheadline: text('hero_subheadline'),
  mainContentJson: text('main_content_json'),
  ctaText: text('cta_text'),
  ctaLink: text('cta_link'),
  metaTitle: text('meta_title'),
  metaDescription: text('meta_description'),
  isPublished: boolean('is_published').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Legal disclaimers
export const disclaimers = pgTable('disclaimers', {
  id: text('id').primaryKey(), // UUID
  name: text('name').notNull(),
  content: text('content').notNull(),
  displayHint: text('display_hint'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Services
export const services = pgTable('services', {
  id: text('id').primaryKey(), // UUID
  name: text('name').notNull(),
  description: text('description'),
  orderIndex: integer('order_index').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Consultation bookings (for tracking Cal.com bookings)
export const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  calEventId: text('cal_event_id'),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  scheduledAt: timestamp('scheduled_at'),
  status: text('status').default('scheduled'), // 'scheduled' | 'completed' | 'cancelled' | 'no-show'
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
