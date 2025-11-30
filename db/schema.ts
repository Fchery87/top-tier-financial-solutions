import { pgTable, serial, text, timestamp, unique, boolean, integer } from 'drizzle-orm/pg-core';

// Users synced from Neon Auth
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    name: text('name'),
    email: text('email').notNull(),
    role: text('role').default('user'), // 'user' | 'admin' | 'super_admin'
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => ({
    emailUnique: unique().on(t.email),
  })
);

// Contact form submissions
export const contactForms = pgTable('contact_forms', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  subject: text('subject'),
  message: text('message').notNull(),
  status: text('status').default('new'), // 'new' | 'read' | 'responded' | 'archived'
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Testimonials
export const testimonials = pgTable('testimonials', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role'),
  company: text('company'),
  content: text('content').notNull(),
  rating: integer('rating').default(5),
  imageUrl: text('image_url'),
  isApproved: boolean('is_approved').default(false),
  isFeatured: boolean('is_featured').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// FAQs
export const faqs = pgTable('faqs', {
  id: serial('id').primaryKey(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  category: text('category'),
  sortOrder: integer('sort_order').default(0),
  isPublished: boolean('is_published').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Site pages/content
export const pages = pgTable('pages', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  content: text('content'),
  metaDescription: text('meta_description'),
  isPublished: boolean('is_published').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Legal disclaimers
export const disclaimers = pgTable('disclaimers', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  type: text('type'), // 'general' | 'services' | 'results' | 'affiliate'
  isActive: boolean('is_active').default(true),
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
