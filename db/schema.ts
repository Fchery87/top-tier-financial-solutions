import { pgTable, pgEnum, serial, text, timestamp, unique, boolean, integer, index } from 'drizzle-orm/pg-core';
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
  notes: text('notes'),
  convertedAt: timestamp('converted_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index("clients_userId_idx").on(table.userId),
  index("clients_email_idx").on(table.email),
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
  bureau: text('bureau'), // 'transunion' | 'experian' | 'equifax'
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
  bureau: text('bureau'), // 'transunion' | 'experian' | 'equifax'
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

// Disputes (action plan / tracking)
export const disputes = pgTable('disputes', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  negativeItemId: text('negative_item_id').references(() => negativeItems.id, { onDelete: 'set null' }),
  bureau: text('bureau').notNull(), // 'transunion' | 'experian' | 'equifax'
  disputeReason: text('dispute_reason').notNull(),
  disputeType: text('dispute_type').default('standard'), // 'standard' | 'method_of_verification' | 'direct_creditor' | 'goodwill'
  status: text('status').default('draft'), // 'draft' | 'ready' | 'sent' | 'in_progress' | 'responded' | 'resolved' | 'escalated'
  round: integer('round').default(1),
  letterContent: text('letter_content'),
  letterTemplateId: text('letter_template_id'),
  trackingNumber: text('tracking_number'),
  sentAt: timestamp('sent_at'),
  responseDeadline: timestamp('response_deadline'),
  responseReceivedAt: timestamp('response_received_at'),
  outcome: text('outcome'), // 'deleted' | 'verified' | 'updated' | 'pending' | 'no_response'
  responseNotes: text('response_notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index("disputes_clientId_idx").on(table.clientId),
  index("disputes_negativeItemId_idx").on(table.negativeItemId),
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
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

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
}));

export const creditReportsRelations = relations(creditReports, ({ one, many }) => ({
  client: one(clients, {
    fields: [creditReports.clientId],
    references: [clients.id],
  }),
  accounts: many(creditAccounts),
  negativeItems: many(negativeItems),
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

export const disputesRelations = relations(disputes, ({ one }) => ({
  client: one(clients, {
    fields: [disputes.clientId],
    references: [clients.id],
  }),
  negativeItem: one(negativeItems, {
    fields: [disputes.negativeItemId],
    references: [negativeItems.id],
  }),
}));
