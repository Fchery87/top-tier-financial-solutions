import { pgTable, pgEnum, serial, text, timestamp, boolean, integer, index } from 'drizzle-orm/pg-core';
import { relations } from "drizzle-orm";

// Enums
export const consultationStatusEnum = pgEnum('consultationstatus', ['new', 'contacted', 'qualified', 'archived']);

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
  status: consultationStatusEnum('status').default('new'), // 'new' | 'contacted' | 'qualified' | 'archived'
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

// ============================================
// CLIENT PORTAL TABLES
// ============================================

// Client cases for credit repair tracking
export const clientCases = pgTable('client_cases', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  caseNumber: text('case_number').notNull().unique(),
  status: text('status').default('active'), // 'pending' | 'active' | 'in_review' | 'completed' | 'closed'
  currentPhase: text('current_phase').default('initial_review'), // 'initial_review' | 'dispute_preparation' | 'disputes_sent' | 'awaiting_response' | 'follow_up' | 'completed'
  creditScoreStart: integer('credit_score_start'),
  creditScoreCurrent: integer('credit_score_current'),
  negativeItemsStart: integer('negative_items_start'),
  negativeItemsRemoved: integer('negative_items_removed').default(0),
  notes: text('notes'),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [index("client_cases_userId_idx").on(table.userId)]);

// Case updates/timeline
export const caseUpdates = pgTable('case_updates', {
  id: text('id').primaryKey(),
  caseId: text('case_id').notNull().references(() => clientCases.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  updateType: text('update_type').default('general'), // 'general' | 'milestone' | 'dispute_sent' | 'dispute_resolved' | 'score_update' | 'document_added'
  isVisibleToClient: boolean('is_visible_to_client').default(true),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [index("case_updates_caseId_idx").on(table.caseId)]);

// Client documents
export const clientDocuments = pgTable('client_documents', {
  id: text('id').primaryKey(),
  caseId: text('case_id').notNull().references(() => clientCases.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  fileType: text('file_type'), // 'credit_report' | 'id_document' | 'dispute_letter' | 'correspondence' | 'other'
  fileUrl: text('file_url').notNull(),
  fileSize: integer('file_size'),
  uploadedBy: text('uploaded_by').default('client'), // 'client' | 'admin'
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("client_documents_caseId_idx").on(table.caseId),
  index("client_documents_userId_idx").on(table.userId)
]);

// Client portal relations
export const clientCasesRelations = relations(clientCases, ({ one, many }) => ({
  user: one(user, {
    fields: [clientCases.userId],
    references: [user.id],
  }),
  updates: many(caseUpdates),
  documents: many(clientDocuments),
}));

export const caseUpdatesRelations = relations(caseUpdates, ({ one }) => ({
  case: one(clientCases, {
    fields: [caseUpdates.caseId],
    references: [clientCases.id],
  }),
}));

export const clientDocumentsRelations = relations(clientDocuments, ({ one }) => ({
  case: one(clientCases, {
    fields: [clientDocuments.caseId],
    references: [clientCases.id],
  }),
  user: one(user, {
    fields: [clientDocuments.userId],
    references: [user.id],
  }),
}));

// ============================================
// BLOG / EDUCATION HUB TABLES
// ============================================

// Blog categories
export const blogCategories = pgTable('blog_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  orderIndex: integer('order_index').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Blog posts
export const blogPosts = pgTable('blog_posts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  excerpt: text('excerpt'),
  content: text('content').notNull(),
  featuredImage: text('featured_image'),
  categoryId: text('category_id').references(() => blogCategories.id, { onDelete: 'set null' }),
  authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
  metaTitle: text('meta_title'),
  metaDescription: text('meta_description'),
  isPublished: boolean('is_published').default(false),
  isFeatured: boolean('is_featured').default(false),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index("blog_posts_slug_idx").on(table.slug),
  index("blog_posts_categoryId_idx").on(table.categoryId),
]);

// Blog relations
export const blogCategoriesRelations = relations(blogCategories, ({ many }) => ({
  posts: many(blogPosts),
}));

export const blogPostsRelations = relations(blogPosts, ({ one }) => ({
  category: one(blogCategories, {
    fields: [blogPosts.categoryId],
    references: [blogCategories.id],
  }),
  author: one(user, {
    fields: [blogPosts.authorId],
    references: [user.id],
  }),
}));

// ============================================
// EMAIL MARKETING / NEWSLETTER TABLES
// ============================================

// Email subscribers
export const emailSubscribers = pgTable('email_subscribers', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  source: text('source').default('website'), // 'website' | 'contact_form' | 'blog' | 'manual'
  status: text('status').default('active'), // 'active' | 'unsubscribed' | 'bounced'
  subscribedAt: timestamp('subscribed_at').defaultNow(),
  unsubscribedAt: timestamp('unsubscribed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [index("email_subscribers_email_idx").on(table.email)]);

// Email campaigns/sequences
export const emailCampaigns = pgTable('email_campaigns', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  subject: text('subject').notNull(),
  content: text('content').notNull(),
  campaignType: text('campaign_type').default('newsletter'), // 'newsletter' | 'welcome' | 'nurture' | 'promotional'
  status: text('status').default('draft'), // 'draft' | 'scheduled' | 'sent' | 'cancelled'
  scheduledAt: timestamp('scheduled_at'),
  sentAt: timestamp('sent_at'),
  recipientCount: integer('recipient_count').default(0),
  openCount: integer('open_count').default(0),
  clickCount: integer('click_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// CREDIT ANALYSIS SYSTEM TABLES
// ============================================

// Client stage enum for pipeline tracking
export const clientStageEnum = pgEnum('client_stage', [
  'lead',
  'consultation', 
  'agreement',
  'onboarding',
  'active',
  'completed'
]);

// Clients table (central client management - converted from leads)
export const clients = pgTable('clients', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
  leadId: text('lead_id').references(() => consultationRequests.id, { onDelete: 'set null' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  status: text('status').default('active'), // 'pending' | 'active' | 'paused' | 'completed' | 'cancelled'
  stage: clientStageEnum('stage').default('lead'), // Pipeline stage for CRM tracking
  assignedTo: text('assigned_to').references(() => user.id, { onDelete: 'set null' }), // Staff assignment
  notes: text('notes'),
  convertedAt: timestamp('converted_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index("clients_userId_idx").on(table.userId),
  index("clients_email_idx").on(table.email),
  index("clients_stage_idx").on(table.stage),
  index("clients_assignedTo_idx").on(table.assignedTo),
]);

// Credit reports (uploaded files)
export const creditReports = pgTable('credit_reports', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(), // 'pdf' | 'html' | 'txt'
  fileUrl: text('file_url').notNull(),
  fileSize: integer('file_size'),
  bureau: text('bureau'), // 'transunion' | 'experian' | 'equifax' | 'combined'
  reportDate: timestamp('report_date'),
  parsedAt: timestamp('parsed_at'),
  parseStatus: text('parse_status').default('pending'), // 'pending' | 'processing' | 'completed' | 'failed'
  parseError: text('parse_error'),
  rawData: text('raw_data'), // JSON string of parsed raw data
  uploadedAt: timestamp('uploaded_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("credit_reports_clientId_idx").on(table.clientId),
]);

// Credit accounts/tradelines (parsed from reports)
export const creditAccounts = pgTable('credit_accounts', {
  id: text('id').primaryKey(),
  creditReportId: text('credit_report_id').notNull().references(() => creditReports.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  creditorName: text('creditor_name').notNull(),
  accountNumber: text('account_number'), // masked
  accountType: text('account_type'), // 'credit_card' | 'auto_loan' | 'mortgage' | 'personal_loan' | 'student_loan' | 'collection' | 'other'
  accountStatus: text('account_status'), // 'open' | 'closed' | 'collection' | 'charge_off' | 'paid'
  balance: integer('balance'),
  creditLimit: integer('credit_limit'),
  highCredit: integer('high_credit'),
  monthlyPayment: integer('monthly_payment'),
  pastDueAmount: integer('past_due_amount'),
  paymentStatus: text('payment_status'), // 'current' | '30_days_late' | '60_days_late' | '90_days_late' | '120_days_late' | 'collection'
  dateOpened: timestamp('date_opened'),
  dateReported: timestamp('date_reported'),
  bureau: text('bureau'), // Legacy field for backward compatibility
  // Per-bureau presence fields - accurate tracking of which bureaus report this account
  onTransunion: boolean('on_transunion').default(false),
  onExperian: boolean('on_experian').default(false),
  onEquifax: boolean('on_equifax').default(false),
  transunionDate: timestamp('transunion_date'), // Date reported on TransUnion
  experianDate: timestamp('experian_date'), // Date reported on Experian
  equifaxDate: timestamp('equifax_date'), // Date reported on Equifax
  transunionBalance: integer('transunion_balance'), // Balance per bureau (may differ)
  experianBalance: integer('experian_balance'),
  equifaxBalance: integer('equifax_balance'),
  isNegative: boolean('is_negative').default(false),
  riskLevel: text('risk_level'), // 'low' | 'medium' | 'high' | 'severe'
  remarks: text('remarks'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("credit_accounts_creditReportId_idx").on(table.creditReportId),
  index("credit_accounts_clientId_idx").on(table.clientId),
]);

// Negative items (collections, charge-offs, derogatory marks)
export const negativeItems = pgTable('negative_items', {
  id: text('id').primaryKey(),
  creditReportId: text('credit_report_id').notNull().references(() => creditReports.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  creditAccountId: text('credit_account_id').references(() => creditAccounts.id, { onDelete: 'set null' }),
  itemType: text('item_type').notNull(), // 'late_payment' | 'collection' | 'charge_off' | 'repossession' | 'foreclosure' | 'bankruptcy' | 'judgment' | 'tax_lien' | 'inquiry'
  creditorName: text('creditor_name').notNull(),
  originalCreditor: text('original_creditor'),
  amount: integer('amount'),
  dateReported: timestamp('date_reported'),
  dateOfLastActivity: timestamp('date_of_last_activity'),
  bureau: text('bureau'), // Legacy field for backward compatibility
  // Per-bureau presence fields - accurate tracking of which bureaus report this item
  onTransunion: boolean('on_transunion').default(false),
  onExperian: boolean('on_experian').default(false),
  onEquifax: boolean('on_equifax').default(false),
  transunionDate: timestamp('transunion_date'), // Date reported on TransUnion
  experianDate: timestamp('experian_date'), // Date reported on Experian
  equifaxDate: timestamp('equifax_date'), // Date reported on Equifax
  transunionStatus: text('transunion_status'), // Status per bureau (may differ)
  experianStatus: text('experian_status'),
  equifaxStatus: text('equifax_status'),
  riskSeverity: text('risk_severity').default('medium'), // 'low' | 'medium' | 'high' | 'severe'
  scoreImpact: text('score_impact'), // estimated impact description
  recommendedAction: text('recommended_action'), // 'dispute' | 'pay_for_delete' | 'settle' | 'goodwill_letter' | 'wait' | 'none'
  disputeReason: text('dispute_reason'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("negative_items_creditReportId_idx").on(table.creditReportId),
  index("negative_items_clientId_idx").on(table.clientId),
]);

// Consumer profiles (PII data extracted from credit reports)
export const consumerProfiles = pgTable('consumer_profiles', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  creditReportId: text('credit_report_id').references(() => creditReports.id, { onDelete: 'set null' }),
  bureau: text('bureau'), // 'transunion' | 'experian' | 'equifax'
  firstName: text('first_name'),
  middleName: text('middle_name'),
  lastName: text('last_name'),
  suffix: text('suffix'),
  ssnLast4: text('ssn_last_4'),
  dateOfBirth: timestamp('date_of_birth'),
  addressStreet: text('address_street'),
  addressCity: text('address_city'),
  addressState: text('address_state'),
  addressZip: text('address_zip'),
  addressType: text('address_type'), // 'current' | 'previous'
  employer: text('employer'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("consumer_profiles_clientId_idx").on(table.clientId),
  index("consumer_profiles_creditReportId_idx").on(table.creditReportId),
]);

// Personal information disputes (names, addresses, DOB, employers)
export const personalInfoDisputes = pgTable('personal_info_disputes', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  creditReportId: text('credit_report_id').references(() => creditReports.id, { onDelete: 'cascade' }),
  bureau: text('bureau').notNull(),
  type: text('type').notNull(), // name | aka | dob | address | employer
  value: text('value').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('personal_info_disputes_clientId_idx').on(table.clientId),
  index('personal_info_disputes_creditReportId_idx').on(table.creditReportId),
  index('personal_info_disputes_bureau_idx').on(table.bureau),
]);

// Inquiry disputes (hard inquiries with FCRA timing flags)
export const inquiryDisputes = pgTable('inquiry_disputes', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  creditReportId: text('credit_report_id').references(() => creditReports.id, { onDelete: 'cascade' }),
  creditorName: text('creditor_name').notNull(),
  bureau: text('bureau'),
  inquiryDate: timestamp('inquiry_date'),
  inquiryType: text('inquiry_type'),
  isPastFcraLimit: boolean('is_past_fcra_limit').default(false),
  daysSinceInquiry: integer('days_since_inquiry'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('inquiry_disputes_clientId_idx').on(table.clientId),
  index('inquiry_disputes_creditReportId_idx').on(table.creditReportId),
  index('inquiry_disputes_bureau_idx').on(table.bureau),
]);

// Bureau discrepancies (cross-bureau comparison findings)
export const bureauDiscrepancies = pgTable('bureau_discrepancies', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  discrepancyType: text('discrepancy_type').notNull(), // 'pii_name' | 'pii_address' | 'account_status' | 'account_balance' | 'account_missing' | 'payment_history' | 'date_mismatch'
  field: text('field'), // The specific field with discrepancy
  creditorName: text('creditor_name'), // For account-related discrepancies
  accountNumber: text('account_number'), // Masked account number
  valueTransunion: text('value_transunion'),
  valueExperian: text('value_experian'),
  valueEquifax: text('value_equifax'),
  severity: text('severity').default('medium'), // 'low' | 'medium' | 'high'
  isDisputable: boolean('is_disputable').default(true),
  disputeRecommendation: text('dispute_recommendation'),
  notes: text('notes'),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("bureau_discrepancies_clientId_idx").on(table.clientId),
  index("bureau_discrepancies_type_idx").on(table.discrepancyType),
]);

// FCRA compliance tracking (items past reporting limits)
export const fcraComplianceItems = pgTable('fcra_compliance_items', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  negativeItemId: text('negative_item_id').references(() => negativeItems.id, { onDelete: 'set null' }),
  creditAccountId: text('credit_account_id').references(() => creditAccounts.id, { onDelete: 'set null' }),
  itemType: text('item_type').notNull(), // 'collection' | 'charge_off' | 'bankruptcy' | 'late_payment' | etc.
  creditorName: text('creditor_name').notNull(),
  dateOfFirstDelinquency: timestamp('date_of_first_delinquency'),
  fcraExpirationDate: timestamp('fcra_expiration_date'), // When item should fall off
  reportingLimitYears: integer('reporting_limit_years'), // 7 or 10 years
  daysUntilExpiration: integer('days_until_expiration'), // Calculated field
  isPastLimit: boolean('is_past_limit').default(false), // True if past FCRA limit
  bureau: text('bureau'), // 'transunion' | 'experian' | 'equifax'
  disputeStatus: text('dispute_status'), // 'pending' | 'disputed' | 'removed' | 'verified'
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index("fcra_compliance_items_clientId_idx").on(table.clientId),
  index("fcra_compliance_items_expiration_idx").on(table.fcraExpirationDate),
]);

// Credit analysis summaries
export const creditAnalyses = pgTable('credit_analyses', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  scoreTransunion: integer('score_transunion'),
  scoreExperian: integer('score_experian'),
  scoreEquifax: integer('score_equifax'),
  totalAccounts: integer('total_accounts').default(0),
  openAccounts: integer('open_accounts').default(0),
  closedAccounts: integer('closed_accounts').default(0),
  totalDebt: integer('total_debt').default(0),
  totalCreditLimit: integer('total_credit_limit').default(0),
  utilizationPercent: integer('utilization_percent'),
  derogatoryCount: integer('derogatory_count').default(0),
  collectionsCount: integer('collections_count').default(0),
  latePaymentCount: integer('late_payment_count').default(0),
  inquiryCount: integer('inquiry_count').default(0),
  oldestAccountAge: integer('oldest_account_age'), // in months
  averageAccountAge: integer('average_account_age'), // in months
  analysisSummary: text('analysis_summary'), // JSON with detailed breakdown
  recommendations: text('recommendations'), // JSON with action items
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index("credit_analyses_clientId_idx").on(table.clientId),
]);

// Credit score history (for tracking progress over time)
export const creditScoreHistory = pgTable('credit_score_history', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  creditReportId: text('credit_report_id').references(() => creditReports.id, { onDelete: 'set null' }),
  scoreTransunion: integer('score_transunion'),
  scoreExperian: integer('score_experian'),
  scoreEquifax: integer('score_equifax'),
  averageScore: integer('average_score'), // Calculated average of available scores
  source: text('source').default('credit_report'), // 'credit_report' | 'manual_entry' | 'client_update'
  notes: text('notes'),
  recordedAt: timestamp('recorded_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("credit_score_history_clientId_idx").on(table.clientId),
  index("credit_score_history_recordedAt_idx").on(table.recordedAt),
]);

// Credit score history relations
export const creditScoreHistoryRelations = relations(creditScoreHistory, ({ one }) => ({
  client: one(clients, {
    fields: [creditScoreHistory.clientId],
    references: [clients.id],
  }),
  creditReport: one(creditReports, {
    fields: [creditScoreHistory.creditReportId],
    references: [creditReports.id],
  }),
}));

// Dispute batches (for grouping multiple disputes)
export const disputeBatches = pgTable('dispute_batches', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  round: integer('round').default(1),
  targetRecipient: text('target_recipient').default('bureau'), // 'bureau' | 'creditor' | 'furnisher' | 'collector'
  itemsCount: integer('items_count').default(0),
  lettersGenerated: integer('letters_generated').default(0),
  status: text('status').default('draft'), // 'draft' | 'ready' | 'sent' | 'completed'
  generationMethod: text('generation_method').default('ai'), // 'ai' | 'template'
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index("dispute_batches_clientId_idx").on(table.clientId),
  index("dispute_batches_status_idx").on(table.status),
]);

// Disputes (action plan / tracking)
export const disputes = pgTable('disputes', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  batchId: text('batch_id').references(() => disputeBatches.id, { onDelete: 'set null' }),
  negativeItemId: text('negative_item_id').references(() => negativeItems.id, { onDelete: 'set null' }),
  bureau: text('bureau').notNull(), // 'transunion' | 'experian' | 'equifax'
  disputeReason: text('dispute_reason').notNull(),
  disputeType: text('dispute_type').default('standard'), // 'standard' | 'method_of_verification' | 'direct_creditor' | 'goodwill'
  status: text('status').default('draft'), // 'draft' | 'ready' | 'sent' | 'in_progress' | 'responded' | 'resolved' | 'escalated'
  round: integer('round').default(1),
  reasonCodes: text('reason_codes'), // JSON array of reason codes
  escalationPath: text('escalation_path'), // 'bureau' | 'creditor' | 'furnisher' | 'collector' | 'cfpb'
  letterContent: text('letter_content'),
  letterTemplateId: text('letter_template_id'),
  generatedByAi: boolean('generated_by_ai').default(false),
  trackingNumber: text('tracking_number'),
  sentAt: timestamp('sent_at'),
  responseDeadline: timestamp('response_deadline'),
  responseReceivedAt: timestamp('response_received_at'),
  outcome: text('outcome'), // 'deleted' | 'verified' | 'updated' | 'pending' | 'no_response'
  responseNotes: text('response_notes'),
  // Enhanced tracking fields
  responseDocumentUrl: text('response_document_url'), // URL to uploaded bureau response document
  verificationMethod: text('verification_method'), // 'automated' | 'manual' | 'phone' | 'mail' | 'online'
  escalationReason: text('escalation_reason'), // Reason for escalation to next round
  creditorName: text('creditor_name'), // Denormalized for quick access
  accountNumber: text('account_number'), // Masked account number
  // NEW: Methodology tracking for enhanced dispute strategies
  methodology: text('methodology'), // 'factual' | 'metro2_compliance' | 'consumer_law' | 'method_of_verification' | 'debt_validation' | 'goodwill'
  disputedFields: text('disputed_fields'), // JSON array of specific Metro 2 fields disputed
  fcraSections: text('fcra_sections'), // JSON array of FCRA sections cited in letter
  escalationHistory: text('escalation_history'), // JSON array of round progression history
  priorDisputeId: text('prior_dispute_id'), // Reference to previous dispute in escalation chain
  // NEW: Response clock & evidence tracking
  escalationReadyAt: timestamp('escalation_ready_at'), // When escalation becomes available (30/45 days after sent)
  evidenceDocumentIds: text('evidence_document_ids'), // JSON array of clientDocuments IDs attached as evidence
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index("disputes_clientId_idx").on(table.clientId),
  index("disputes_batchId_idx").on(table.batchId),
  index("disputes_negativeItemId_idx").on(table.negativeItemId),
  index("disputes_status_idx").on(table.status),
  index("disputes_responseDeadline_idx").on(table.responseDeadline),
  index("disputes_methodology_idx").on(table.methodology),
  index("disputes_escalationReadyAt_idx").on(table.escalationReadyAt),
]);

// Dispute letter templates
export const disputeLetterTemplates = pgTable('dispute_letter_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  disputeType: text('dispute_type').notNull(), // 'standard' | 'method_of_verification' | 'direct_creditor' | 'goodwill' | 'debt_validation' | 'cease_desist'
  targetRecipient: text('target_recipient').default('bureau'), // 'bureau' | 'creditor' | 'collector'
  content: text('content').notNull(), // Template with placeholders like {{client_name}}, {{account_number}}, etc.
  variables: text('variables'), // JSON array of available variables
  evidenceRequirements: text('evidence_requirements'), // JSON: { required: boolean, documentTypes: string[], prompt: string }
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Dispute letter library (methodology-specific templates with effectiveness tracking)
export const disputeLetterLibrary = pgTable('dispute_letter_library', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  methodology: text('methodology').notNull(), // 'factual' | 'metro2_compliance' | 'consumer_law' | 'method_of_verification' | 'debt_validation' | 'goodwill'
  targetRecipient: text('target_recipient').notNull(), // 'bureau' | 'creditor' | 'collector' | 'furnisher'
  round: integer('round').default(1), // Which round this template is best for
  itemTypes: text('item_types'), // JSON array of item types this template fits (e.g., ['collection', 'charge_off'])
  bureau: text('bureau'), // NULL for universal, or specific bureau name
  reasonCodes: text('reason_codes'), // JSON array of reason codes this template addresses
  content: text('content').notNull(), // Full letter template with placeholders
  promptContext: text('prompt_context'), // Additional context to add to AI prompt when using this template
  variables: text('variables'), // JSON array of required variables
  legalCitations: text('legal_citations'), // JSON array of FCRA/FDCPA sections cited
  // Effectiveness tracking
  timesUsed: integer('times_used').default(0),
  successCount: integer('success_count').default(0), // Times resulted in deletion
  effectivenessRating: integer('effectiveness_rating'), // Calculated success percentage (0-100)
  lastUsedAt: timestamp('last_used_at'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index("dispute_letter_library_methodology_idx").on(table.methodology),
  index("dispute_letter_library_targetRecipient_idx").on(table.targetRecipient),
  index("dispute_letter_library_round_idx").on(table.round),
]);

// ============================================
// CRM SYSTEM TABLES - Tasks & Notes
// ============================================

// Task status and priority enums
export const taskStatusEnum = pgEnum('task_status', ['todo', 'in_progress', 'review', 'done']);
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'urgent']);

// Tasks for CRM workflow management
export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  clientId: text('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  assigneeId: text('assignee_id').references(() => user.id, { onDelete: 'set null' }),
  createdById: text('created_by_id').references(() => user.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  status: taskStatusEnum('status').default('todo'),
  priority: taskPriorityEnum('priority').default('medium'),
  dueDate: timestamp('due_date'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index("tasks_clientId_idx").on(table.clientId),
  index("tasks_assigneeId_idx").on(table.assigneeId),
  index("tasks_status_idx").on(table.status),
  index("tasks_dueDate_idx").on(table.dueDate),
]);

// Client notes for tracking interactions and history
export const clientNotes = pgTable('client_notes', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index("client_notes_clientId_idx").on(table.clientId),
  index("client_notes_authorId_idx").on(table.authorId),
]);

// Credit Audit Reports (generated diagnostic reports for sales)
export const auditReports = pgTable('audit_reports', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  generatedById: text('generated_by_id').references(() => user.id, { onDelete: 'set null' }),
  reportHtml: text('report_html').notNull(),
  scoreTransunion: integer('score_transunion'),
  scoreExperian: integer('score_experian'),
  scoreEquifax: integer('score_equifax'),
  negativeItemsCount: integer('negative_items_count').default(0),
  totalDebt: integer('total_debt'),
  projectedScoreIncrease: integer('projected_score_increase'),
  sentViaEmail: boolean('sent_via_email').default(false),
  emailSentAt: timestamp('email_sent_at'),
  generatedAt: timestamp('generated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("audit_reports_clientId_idx").on(table.clientId),
]);

// Audit reports relations
export const auditReportsRelations = relations(auditReports, ({ one }) => ({
  client: one(clients, {
    fields: [auditReports.clientId],
    references: [clients.id],
  }),
  generatedBy: one(user, {
    fields: [auditReports.generatedById],
    references: [user.id],
  }),
}));

// Tasks relations
export const tasksRelations = relations(tasks, ({ one }) => ({
  client: one(clients, {
    fields: [tasks.clientId],
    references: [clients.id],
  }),
  assignee: one(user, {
    fields: [tasks.assigneeId],
    references: [user.id],
    relationName: 'taskAssignee',
  }),
  createdBy: one(user, {
    fields: [tasks.createdById],
    references: [user.id],
    relationName: 'taskCreator',
  }),
}));

// Client notes relations
export const clientNotesRelations = relations(clientNotes, ({ one }) => ({
  client: one(clients, {
    fields: [clientNotes.clientId],
    references: [clients.id],
  }),
  author: one(user, {
    fields: [clientNotes.authorId],
    references: [user.id],
  }),
}));

// Credit Analysis System Relations
export const clientsRelations = relations(clients, ({ one, many }) => ({
  user: one(user, {
    fields: [clients.userId],
    references: [user.id],
  }),
  lead: one(consultationRequests, {
    fields: [clients.leadId],
    references: [consultationRequests.id],
  }),
  creditReports: many(creditReports),
  creditAccounts: many(creditAccounts),
  negativeItems: many(negativeItems),
  analyses: many(creditAnalyses),
  disputes: many(disputes),
  disputeBatches: many(disputeBatches),
  tasks: many(tasks),
  notes: many(clientNotes),
  auditReports: many(auditReports),
  consumerProfiles: many(consumerProfiles),
  bureauDiscrepancies: many(bureauDiscrepancies),
  fcraComplianceItems: many(fcraComplianceItems),
  personalInfoDisputes: many(personalInfoDisputes),
  inquiryDisputes: many(inquiryDisputes),
  scoreHistory: many(creditScoreHistory),
}));

// Consumer profiles relations
export const consumerProfilesRelations = relations(consumerProfiles, ({ one }) => ({
  client: one(clients, {
    fields: [consumerProfiles.clientId],
    references: [clients.id],
  }),
  creditReport: one(creditReports, {
    fields: [consumerProfiles.creditReportId],
    references: [creditReports.id],
  }),
}));

export const personalInfoDisputesRelations = relations(personalInfoDisputes, ({ one }) => ({
  client: one(clients, {
    fields: [personalInfoDisputes.clientId],
    references: [clients.id],
  }),
  creditReport: one(creditReports, {
    fields: [personalInfoDisputes.creditReportId],
    references: [creditReports.id],
  }),
}));

export const inquiryDisputesRelations = relations(inquiryDisputes, ({ one }) => ({
  client: one(clients, {
    fields: [inquiryDisputes.clientId],
    references: [clients.id],
  }),
  creditReport: one(creditReports, {
    fields: [inquiryDisputes.creditReportId],
    references: [creditReports.id],
  }),
}));

// Bureau discrepancies relations
export const bureauDiscrepanciesRelations = relations(bureauDiscrepancies, ({ one }) => ({
  client: one(clients, {
    fields: [bureauDiscrepancies.clientId],
    references: [clients.id],
  }),
}));

// FCRA compliance items relations
export const fcraComplianceItemsRelations = relations(fcraComplianceItems, ({ one }) => ({
  client: one(clients, {
    fields: [fcraComplianceItems.clientId],
    references: [clients.id],
  }),
  negativeItem: one(negativeItems, {
    fields: [fcraComplianceItems.negativeItemId],
    references: [negativeItems.id],
  }),
  creditAccount: one(creditAccounts, {
    fields: [fcraComplianceItems.creditAccountId],
    references: [creditAccounts.id],
  }),
}));

export const creditReportsRelations = relations(creditReports, ({ one, many }) => ({
  client: one(clients, {
    fields: [creditReports.clientId],
    references: [clients.id],
  }),
  accounts: many(creditAccounts),
  negativeItems: many(negativeItems),
  personalInfoDisputes: many(personalInfoDisputes),
  inquiryDisputes: many(inquiryDisputes),
}));

export const creditAccountsRelations = relations(creditAccounts, ({ one, many }) => ({
  creditReport: one(creditReports, {
    fields: [creditAccounts.creditReportId],
    references: [creditReports.id],
  }),
  client: one(clients, {
    fields: [creditAccounts.clientId],
    references: [clients.id],
  }),
  negativeItems: many(negativeItems),
}));

export const negativeItemsRelations = relations(negativeItems, ({ one }) => ({
  creditReport: one(creditReports, {
    fields: [negativeItems.creditReportId],
    references: [creditReports.id],
  }),
  client: one(clients, {
    fields: [negativeItems.clientId],
    references: [clients.id],
  }),
  creditAccount: one(creditAccounts, {
    fields: [negativeItems.creditAccountId],
    references: [creditAccounts.id],
  }),
}));

export const creditAnalysesRelations = relations(creditAnalyses, ({ one }) => ({
  client: one(clients, {
    fields: [creditAnalyses.clientId],
    references: [clients.id],
  }),
}));

export const disputeBatchesRelations = relations(disputeBatches, ({ one, many }) => ({
  client: one(clients, {
    fields: [disputeBatches.clientId],
    references: [clients.id],
  }),
  disputes: many(disputes),
}));

export const disputesRelations = relations(disputes, ({ one }) => ({
  client: one(clients, {
    fields: [disputes.clientId],
    references: [clients.id],
  }),
  batch: one(disputeBatches, {
    fields: [disputes.batchId],
    references: [disputeBatches.id],
  }),
  negativeItem: one(negativeItems, {
    fields: [disputes.negativeItemId],
    references: [negativeItems.id],
  }),
}));

// ============================================
// CROA/TSR COMPLIANCE TABLES
// ============================================

// Enums for compliance
export const agreementStatusEnum = pgEnum('agreement_status', ['draft', 'pending', 'signed', 'cancelled', 'expired']);
export const disclosureTypeEnum = pgEnum('disclosure_type', ['right_to_cancel', 'no_guarantee', 'credit_bureau_rights', 'written_contract', 'fee_disclosure']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'pending', 'paid', 'void', 'refunded']);
export const feeModelEnum = pgEnum('fee_model', ['subscription', 'pay_per_delete', 'milestone', 'flat_fee']);
export const messageThreadStatusEnum = pgEnum('message_thread_status', ['open', 'closed', 'archived']);
export const senderTypeEnum = pgEnum('sender_type', ['admin', 'client']);

// ============================================
// CLIENT AGREEMENTS MODULE (CROA Compliance)
// ============================================

// Agreement templates (reusable contract templates)
export const agreementTemplates = pgTable('agreement_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  version: text('version').notNull().default('1.0'),
  content: text('content').notNull(), // HTML content with placeholders
  requiredDisclosures: text('required_disclosures'), // JSON array of disclosure types required
  cancellationPeriodDays: integer('cancellation_period_days').default(3), // CROA requires 3 business days
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Client agreements (signed contracts)
export const clientAgreements = pgTable('client_agreements', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  templateId: text('template_id').references(() => agreementTemplates.id, { onDelete: 'set null' }),
  templateVersion: text('template_version'), // Snapshot of version at signing
  status: agreementStatusEnum('status').default('draft'),
  content: text('content').notNull(), // Rendered HTML with client info filled in
  signedAt: timestamp('signed_at'),
  signatureData: text('signature_data'), // Base64 signature image or typed name
  signatureType: text('signature_type'), // 'drawn' | 'typed'
  signerIpAddress: text('signer_ip_address'),
  signerUserAgent: text('signer_user_agent'),
  cancellationDeadline: timestamp('cancellation_deadline'), // 3 business days after signing per CROA
  cancelledAt: timestamp('cancelled_at'),
  cancellationReason: text('cancellation_reason'),
  sentAt: timestamp('sent_at'), // When agreement was sent to client
  sentById: text('sent_by_id').references(() => user.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at'), // When unsigned agreement expires
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index("client_agreements_clientId_idx").on(table.clientId),
  index("client_agreements_status_idx").on(table.status),
]);

// Disclosure acknowledgments (tracking CROA required disclosures)
export const disclosureAcknowledgments = pgTable('disclosure_acknowledgments', {
  id: text('id').primaryKey(),
  agreementId: text('agreement_id').notNull().references(() => clientAgreements.id, { onDelete: 'cascade' }),
  disclosureType: disclosureTypeEnum('disclosure_type').notNull(),
  disclosureText: text('disclosure_text').notNull(), // The actual text shown to client
  acknowledged: boolean('acknowledged').default(false),
  acknowledgedAt: timestamp('acknowledged_at'),
  acknowledgerIpAddress: text('acknowledger_ip_address'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("disclosure_acknowledgments_agreementId_idx").on(table.agreementId),
]);

// ============================================
// BILLING & INVOICING MODULE (No Advance Fees)
// ============================================

// Fee configurations (pricing plans)
export const feeConfigurations = pgTable('fee_configurations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  feeModel: feeModelEnum('fee_model').notNull(),
  amount: integer('amount').notNull(), // Amount in cents
  frequency: text('frequency'), // 'monthly' | 'per_item' | 'one_time' | null
  setupFee: integer('setup_fee').default(0), // Initial fee in cents (charged after first service)
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Client billing profiles
export const clientBillingProfiles = pgTable('client_billing_profiles', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  feeConfigId: text('fee_config_id').references(() => feeConfigurations.id, { onDelete: 'set null' }),
  // Payment processor fields (generic - not Stripe specific)
  externalCustomerId: text('external_customer_id'), // ID from payment processor
  paymentProcessor: text('payment_processor'), // 'nmi' | 'authorize_net' | 'other'
  paymentMethodLast4: text('payment_method_last4'),
  paymentMethodType: text('payment_method_type'), // 'card' | 'ach'
  billingStatus: text('billing_status').default('active'), // 'active' | 'paused' | 'cancelled'
  nextBillingDate: timestamp('next_billing_date'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index("client_billing_profiles_clientId_idx").on(table.clientId),
]);

// Invoices
export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  billingProfileId: text('billing_profile_id').references(() => clientBillingProfiles.id, { onDelete: 'set null' }),
  invoiceNumber: text('invoice_number').notNull().unique(),
  amount: integer('amount').notNull(), // Amount in cents
  status: invoiceStatusEnum('status').default('draft'),
  // CROA Compliance: Services must be rendered BEFORE charging
  servicesRendered: text('services_rendered'), // JSON describing what services were completed
  servicesRenderedAt: timestamp('services_rendered_at'), // When services were marked complete
  description: text('description'),
  dueDate: timestamp('due_date'),
  paidAt: timestamp('paid_at'),
  // Payment processor reference
  externalPaymentId: text('external_payment_id'), // Transaction ID from processor
  paymentProcessor: text('payment_processor'),
  paymentMethod: text('payment_method'), // 'card' | 'ach' | 'check' | 'cash'
  // Refund tracking
  refundedAt: timestamp('refunded_at'),
  refundAmount: integer('refund_amount'),
  refundReason: text('refund_reason'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index("invoices_clientId_idx").on(table.clientId),
  index("invoices_status_idx").on(table.status),
  index("invoices_invoiceNumber_idx").on(table.invoiceNumber),
]);

// Payment audit log (compliance trail)
export const paymentAuditLog = pgTable('payment_audit_log', {
  id: text('id').primaryKey(),
  clientId: text('client_id').references(() => clients.id, { onDelete: 'set null' }),
  invoiceId: text('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  action: text('action').notNull(), // 'invoice_created' | 'payment_attempted' | 'payment_success' | 'payment_failed' | 'refund_issued' | 'services_verified'
  details: text('details'), // JSON with action-specific details
  performedById: text('performed_by_id').references(() => user.id, { onDelete: 'set null' }),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("payment_audit_log_clientId_idx").on(table.clientId),
  index("payment_audit_log_invoiceId_idx").on(table.invoiceId),
  index("payment_audit_log_createdAt_idx").on(table.createdAt),
]);

// ============================================
// SECURE CLIENT MESSAGING MODULE
// ============================================

// Message threads
export const messageThreads = pgTable('message_threads', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  subject: text('subject').notNull(),
  status: messageThreadStatusEnum('status').default('open'),
  lastMessageAt: timestamp('last_message_at'),
  unreadByAdmin: integer('unread_by_admin').default(0),
  unreadByClient: integer('unread_by_client').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index("message_threads_clientId_idx").on(table.clientId),
  index("message_threads_status_idx").on(table.status),
  index("message_threads_lastMessageAt_idx").on(table.lastMessageAt),
]);

// Messages
export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  threadId: text('thread_id').notNull().references(() => messageThreads.id, { onDelete: 'cascade' }),
  senderId: text('sender_id').references(() => user.id, { onDelete: 'set null' }),
  senderType: senderTypeEnum('sender_type').notNull(),
  content: text('content').notNull(),
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at'),
  // Audit fields
  senderIpAddress: text('sender_ip_address'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("messages_threadId_idx").on(table.threadId),
  index("messages_senderId_idx").on(table.senderId),
  index("messages_createdAt_idx").on(table.createdAt),
]);

// Message attachments
export const messageAttachments = pgTable('message_attachments', {
  id: text('id').primaryKey(),
  messageId: text('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(),
  fileSize: integer('file_size'),
  fileType: text('file_type'), // MIME type
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("message_attachments_messageId_idx").on(table.messageId),
]);

// ============================================
// CROA/TSR COMPLIANCE RELATIONS
// ============================================

// Agreement relations
export const agreementTemplatesRelations = relations(agreementTemplates, ({ many }) => ({
  agreements: many(clientAgreements),
}));

export const clientAgreementsRelations = relations(clientAgreements, ({ one, many }) => ({
  client: one(clients, {
    fields: [clientAgreements.clientId],
    references: [clients.id],
  }),
  template: one(agreementTemplates, {
    fields: [clientAgreements.templateId],
    references: [agreementTemplates.id],
  }),
  sentBy: one(user, {
    fields: [clientAgreements.sentById],
    references: [user.id],
  }),
  disclosures: many(disclosureAcknowledgments),
}));

export const disclosureAcknowledgmentsRelations = relations(disclosureAcknowledgments, ({ one }) => ({
  agreement: one(clientAgreements, {
    fields: [disclosureAcknowledgments.agreementId],
    references: [clientAgreements.id],
  }),
}));

// Billing relations
export const feeConfigurationsRelations = relations(feeConfigurations, ({ many }) => ({
  billingProfiles: many(clientBillingProfiles),
}));

export const clientBillingProfilesRelations = relations(clientBillingProfiles, ({ one, many }) => ({
  client: one(clients, {
    fields: [clientBillingProfiles.clientId],
    references: [clients.id],
  }),
  feeConfig: one(feeConfigurations, {
    fields: [clientBillingProfiles.feeConfigId],
    references: [feeConfigurations.id],
  }),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
  billingProfile: one(clientBillingProfiles, {
    fields: [invoices.billingProfileId],
    references: [clientBillingProfiles.id],
  }),
  auditLogs: many(paymentAuditLog),
}));

export const paymentAuditLogRelations = relations(paymentAuditLog, ({ one }) => ({
  client: one(clients, {
    fields: [paymentAuditLog.clientId],
    references: [clients.id],
  }),
  invoice: one(invoices, {
    fields: [paymentAuditLog.invoiceId],
    references: [invoices.id],
  }),
  performedBy: one(user, {
    fields: [paymentAuditLog.performedById],
    references: [user.id],
  }),
}));

// Messaging relations
export const messageThreadsRelations = relations(messageThreads, ({ one, many }) => ({
  client: one(clients, {
    fields: [messageThreads.clientId],
    references: [clients.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  thread: one(messageThreads, {
    fields: [messages.threadId],
    references: [messageThreads.id],
  }),
  sender: one(user, {
    fields: [messages.senderId],
    references: [user.id],
  }),
  attachments: many(messageAttachments),
}));

export const messageAttachmentsRelations = relations(messageAttachments, ({ one }) => ({
  message: one(messages, {
    fields: [messageAttachments.messageId],
    references: [messages.id],
  }),
}));

// ============================================
// EMAIL AUTOMATION TABLES
// ============================================

// Email trigger types enum
export const emailTriggerTypeEnum = pgEnum('email_trigger_type', [
  'welcome',
  'dispute_created',
  'dispute_sent',
  'response_received',
  'item_deleted',
  'progress_report',
  'agreement_sent',
  'agreement_signed',
  'payment_received',
  'custom'
]);

// Email templates for automated communications
export const emailTemplates = pgTable('email_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  triggerType: emailTriggerTypeEnum('trigger_type').notNull(),
  subject: text('subject').notNull(),
  htmlContent: text('html_content').notNull(),
  textContent: text('text_content'), // Plain text fallback
  variables: text('variables'), // JSON array of available variables
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Email automation rules (when to send)
export const emailAutomationRules = pgTable('email_automation_rules', {
  id: text('id').primaryKey(),
  templateId: text('template_id').notNull().references(() => emailTemplates.id, { onDelete: 'cascade' }),
  triggerType: emailTriggerTypeEnum('trigger_type').notNull(),
  delayMinutes: integer('delay_minutes').default(0), // Delay before sending (0 = immediate)
  conditions: text('conditions'), // JSON object with trigger conditions
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index("email_automation_rules_templateId_idx").on(table.templateId),
  index("email_automation_rules_triggerType_idx").on(table.triggerType),
]);

// Email send log (audit trail)
export const emailSendLog = pgTable('email_send_log', {
  id: text('id').primaryKey(),
  clientId: text('client_id').references(() => clients.id, { onDelete: 'set null' }),
  templateId: text('template_id').references(() => emailTemplates.id, { onDelete: 'set null' }),
  toEmail: text('to_email').notNull(),
  subject: text('subject').notNull(),
  triggerType: emailTriggerTypeEnum('trigger_type'),
  status: text('status').default('pending'), // 'pending' | 'sent' | 'failed' | 'bounced'
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at'),
  openedAt: timestamp('opened_at'),
  clickedAt: timestamp('clicked_at'),
  metadata: text('metadata'), // JSON with additional context (dispute_id, etc.)
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index("email_send_log_clientId_idx").on(table.clientId),
  index("email_send_log_status_idx").on(table.status),
  index("email_send_log_triggerType_idx").on(table.triggerType),
]);

// Client notification preferences
export const clientNotificationPreferences = pgTable('client_notification_preferences', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  emailEnabled: boolean('email_enabled').default(true),
  disputeUpdates: boolean('dispute_updates').default(true),
  progressReports: boolean('progress_reports').default(true),
  marketingEmails: boolean('marketing_emails').default(false),
  preferredFrequency: text('preferred_frequency').default('immediate'), // 'immediate' | 'daily' | 'weekly'
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index("client_notification_preferences_clientId_idx").on(table.clientId),
]);

// ============================================
// CRM GOALS & TRACKING
// ============================================

// Goal type enum
export const goalTypeEnum = pgEnum('goal_type', [
  'deletions',
  'new_clients',
  'disputes_sent',
  'revenue'
]);

// Goals table for tracking monthly targets
export const goals = pgTable('goals', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  month: text('month').notNull(), // Format: '2024-12'
  goalType: goalTypeEnum('goal_type').notNull(),
  target: integer('target').notNull(),
  current: integer('current').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index("goals_userId_idx").on(table.userId),
  index("goals_month_idx").on(table.month),
]);

// Goals relations
export const goalsRelations = relations(goals, ({ one }) => ({
  user: one(user, {
    fields: [goals.userId],
    references: [user.id],
  }),
}));

// Email automation relations
export const emailTemplatesRelations = relations(emailTemplates, ({ many }) => ({
  automationRules: many(emailAutomationRules),
  sendLogs: many(emailSendLog),
}));

export const emailAutomationRulesRelations = relations(emailAutomationRules, ({ one }) => ({
  template: one(emailTemplates, {
    fields: [emailAutomationRules.templateId],
    references: [emailTemplates.id],
  }),
}));

export const emailSendLogRelations = relations(emailSendLog, ({ one }) => ({
  client: one(clients, {
    fields: [emailSendLog.clientId],
    references: [clients.id],
  }),
  template: one(emailTemplates, {
    fields: [emailSendLog.templateId],
    references: [emailTemplates.id],
  }),
}));

export const clientNotificationPreferencesRelations = relations(clientNotificationPreferences, ({ one }) => ({
  client: one(clients, {
    fields: [clientNotificationPreferences.clientId],
    references: [clients.id],
  }),
}));

// ============================================
// SYSTEM SETTINGS (Super Admin Only)
// ============================================

// LLM provider enum
export const llmProviderEnum = pgEnum('llm_provider', ['google', 'openai', 'anthropic', 'custom']);

// System settings for application-wide configuration
export const systemSettings = pgTable('system_settings', {
  id: text('id').primaryKey(),
  settingKey: text('setting_key').notNull().unique(),
  settingValue: text('setting_value'),
  settingType: text('setting_type').notNull(), // 'string' | 'number' | 'boolean' | 'json'
  category: text('category').default('general'), // 'general' | 'llm' | 'email' | 'billing' | 'compliance'
  description: text('description'),
  isSecret: boolean('is_secret').default(false), // Whether value should be hidden in UI
  lastModifiedBy: text('last_modified_by').references(() => user.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index("system_settings_key_idx").on(table.settingKey),
  index("system_settings_category_idx").on(table.category),
]);

// System settings relations
export const systemSettingsRelations = relations(systemSettings, ({ one }) => ({
  lastModifiedBy: one(user, {
    fields: [systemSettings.lastModifiedBy],
    references: [user.id],
  }),
}));
