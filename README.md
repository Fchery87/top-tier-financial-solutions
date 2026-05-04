# Top Tier Financial Solutions

Top Tier Financial Solutions is a full-stack credit repair operations platform for managing the complete client journey from lead intake through onboarding, dispute execution, response review, progress reporting, and compliant billing readiness.

The application is designed for a credit repair business that needs more than a generic CRM. It tracks regulated workflow gates, protects client PII, keeps dispute strategy auditable, separates internal operations metrics from client outcome claims, and prevents billing from moving ahead of documented services rendered.

## What The Platform Does

The platform coordinates three connected experiences:

- Public website for prospects, educational content, contact forms, service information, FAQs, testimonials, newsletter capture, and scheduling.
- Admin dashboard for staff managing leads, clients, documents, agreements, disputes, billing readiness, analytics, tasks, and content.
- Client portal for secure collaboration, onboarding documents, agreement review, progress visibility, messages, audit reports, notification preferences, and required confirmations.

The core product is the credit repair operating workflow. The system models client service relationships, compliance gates, dispute cycles, credit report pulls, response reviews, service-rendered events, and audit-friendly payment readiness.

## Primary Users

- Business owner: configures services, monitors operations, reviews analytics, manages staff access, and confirms that compliance gates are enforced.
- Manager: oversees the client pipeline, work queues, response aging, billing readiness, and service quality.
- Dispute specialist: reviews reports, builds evidence-backed dispute strategy, generates letters from approved policy inputs, records submissions, and reviews responses.
- Onboarding specialist: ensures agreements, disclosures, identity documents, proof of address, and credit report access requirements are complete before service work begins.
- Billing staff: tracks invoices, payment status, services rendered, and audit trail details without charging before required billing locks are satisfied.
- Client: signs agreements, uploads documents, reviews progress, messages the team, and confirms high-risk factual claims when required.

## Workflow Model

The canonical lifecycle starts with a lead and moves through consultation, qualification, agreement, cancellation window, onboarding, active dispute work, response review, next-cycle decisions, maintenance, and closure.

Important workflow concepts:

- Service Engagement: the service relationship between the business and a client. Credit Audit and Credit Restoration are modeled separately.
- Compliance Gate: the required checks before a client reaches Ready for First Work.
- Cancellation Window: the period where internal preparation may happen, but external execution, services-rendered marking, payable invoices, and charging are blocked.
- Dispute Cycle: one coordinated round of dispute work from item selection through submission, response tracking, response review, and next decision.
- Evidence Packet: the documents and client confirmations attached to a specific dispute claim.
- Credit Report Pull: a report import at a point in time, used for comparison, progress tracking, and outcome analysis.
- Response Review: the structured review of bureau, furnisher, collector, creditor, or regulator responses before closing, updating, escalating, or continuing an item.
- Services Rendered: a concrete completed service event that can support compliant invoicing.

## Major Capabilities

### Admin Operations

- Client and lead management across the credit repair lifecycle.
- Staff work queues for onboarding blockers, dispute work, response deadlines, messages, and billing readiness.
- Role and permission checks for sensitive admin actions.
- Content management for public pages, services, blog posts, FAQs, testimonials, disclaimers, and agreements.
- Operational analytics separated from client-facing outcome analytics.

### Compliance And Billing

- Service Engagement records for distinct service scopes.
- Compliance Gate checks before work can begin.
- CROA-oriented agreement and cancellation-window handling.
- Services Rendered records for billing support.
- Payable invoice checks that require qualifying services-rendered events.
- Credit Audit billing separated from Credit Restoration billing.
- Payment audit logs that explain why an invoice became payable.
- Live charging intentionally deferred until required billing locks are enforced.

### Credit Report And Dispute Workflow

- Deterministic parsing for supported credit report formats.
- Credit Report Pull history and comparison across bureaus.
- Detection of deleted, updated, unchanged, and newly added negative items.
- Bureau-level score and item progress tracking where report data supports it.
- Deterministic dispute policy decisions before letter generation.
- AI-assisted letter rendering limited to approved policy inputs.
- Submission Tracking for manual mail details, recipients, dates, tracking numbers, proof documents, delivery status, and response deadlines.
- Response Review with structured outcomes and next-cycle recommendations.

### Client Collaboration Workspace

- Mobile-responsive portal experience.
- Agreement review and signing.
- Required onboarding document checklist.
- Secure document upload flow.
- Client-visible progress snapshot derived from operational records.
- Secure portal messaging and notification preferences.
- Explicit client confirmation for high-risk factual claims.
- Audit and progress report visibility after staff release approval.

### Security And Privacy

- Better Auth authentication with admin role handling.
- Explicit admin permissions for sensitive workflow areas.
- PII encryption boundaries for client data.
- PII minimization in list responses and client-facing views.
- Sanitized rendered HTML before display.
- CSP hardening for rendered pages.
- Cloudflare R2-compatible object storage for controlled file handling.
- Rate limiting support through Upstash packages.
- Sentry integration for production monitoring.

## AI Boundary

AI is used as a letter renderer, not as a policy decision-maker.

The application must decide dispute eligibility, reason codes, claim risk, target recipients, required evidence, and escalation paths with deterministic code before calling an AI provider. AI-generated text must be traceable to approved policy inputs and must not invent facts, upgrade claims, or create unsupported guarantees.

## Tech Stack

- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS v4, Framer Motion.
- Backend: Next.js App Router and API routes as the primary application backend.
- Legacy service: optional Python FastAPI backend for older or auxiliary workflows.
- Database: Neon PostgreSQL with Drizzle ORM and Drizzle Kit migrations.
- Authentication: Better Auth.
- File storage: Cloudflare R2 using S3-compatible APIs.
- AI providers: Google Gemini and OpenAI SDK packages are available; deterministic policy remains the source of truth.
- Scheduling and booking: Cal.com integration for prospect scheduling.
- Observability: Sentry for Next.js.
- Testing: Vitest, Testing Library, Playwright tooling.

## Local Setup

Install dependencies:

```bash
npm install
```

Create environment configuration:

```bash
cp env.example .env
```

Edit the environment file with local credentials. At minimum, local development usually needs a database URL, Better Auth secret, app URL, storage credentials for document flows, and AI keys for generation features.

Run database migrations:

```bash
npm run db:migrate
```

Start the Next.js development server:

```bash
npm run dev
```

Start the optional legacy FastAPI service only when working on Python-backed flows:

```bash
npm run fastapi-dev
```

## Environment Variables

Use `env.example` as the source of truth for required variables.

Commonly used variables include:

- `DATABASE_URL`: Neon PostgreSQL connection string.
- `BETTER_AUTH_SECRET`: Better Auth secret with sufficient entropy.
- `NEXT_PUBLIC_APP_URL`: public app URL used by auth and links.
- `R2_*`: Cloudflare R2 credentials and bucket configuration.
- `GOOGLE_AI_API_KEY`: Gemini API key for AI-assisted generation.
- `OPENAI_API_KEY`: OpenAI API key where OpenAI-backed features are enabled.
- `NEXT_PUBLIC_CAL_*`: Cal.com scheduling integration settings.
- `SENTRY_*`: Sentry monitoring configuration where enabled.

Never commit secrets. Use local environment files for development and managed environment variables in deployment.

## Scripts

```bash
npm run dev            # Start the Next.js development server
npm run fastapi-dev    # Start the optional legacy FastAPI backend
npm run build          # Build the production Next.js app
npm run start          # Start the production server after build
npm run lint           # Run ESLint
npm run typecheck      # Run TypeScript without emitting files
npm run test           # Run the Vitest test suite
npm run test:e2e       # Run Playwright end-to-end tests
npm run validate       # Run lint, typecheck, tests, and build
npm run db:generate    # Generate Drizzle migrations from schema changes
npm run db:migrate     # Apply Drizzle migrations
npm run db:push        # Push schema changes directly
npm run db:studio      # Open Drizzle Studio
```

## Project Map

```text
api/              Optional legacy Python FastAPI backend
db/               Database schema and database client setup
drizzle/          Generated SQL migrations and migration metadata
public/           Static assets served by Next.js
scripts/          Utility scripts for migration and maintenance tasks
src/app/          Next.js routes, public pages, admin pages, portal pages, and API routes
src/components/   React components for admin, portal, public pages, and shared UI
src/hooks/        Client-side hooks used by workflow UI
src/lib/          Domain logic, parsers, auth helpers, security utilities, and service code
src/__tests__/    API, component, integration, parser, and library tests
docs/             Implementation notes, plans, parser guides, and production readiness notes
specs/            Project specifications and supporting product documents
```

## Development Rules Of Thumb

- Treat `CONTEXT.md` as the domain glossary for service lifecycle and compliance language.
- Keep policy decisions deterministic and testable.
- Keep AI behind approved policy inputs.
- Keep client portal behavior collaborative, not operationally editable.
- Keep Operator Analytics separate from Client Outcome Analytics.
- Keep billing tied to Services Rendered and compliance gates.
- Keep PII encrypted or minimized unless a workflow explicitly requires decrypted values.
- Prefer small schema changes and generated migrations over broad rewrites.
- Run focused tests for the touched area before broad validation.

## Verification

Before production release or major handoff, run:

```bash
npm run validate
```

For dependency security gates, run:

```bash
npm audit --audit-level=high
```

Current production-readiness notes are tracked in the production readiness blocker document linked below.

## Documentation Index

- [Setup Guide](./SETUP_GUIDE.md) - detailed local setup and environment guidance.
- [Domain Context](./CONTEXT.md) - canonical project glossary and workflow language.
- [Credit Repair Platform Roadmap](./docs/plans/credit-repair-platform-roadmap.md) - implementation sequence and acceptance criteria.
- [Production Readiness Blockers](./docs/plans/production-readiness-blockers.md) - current release blockers, warnings, and audit status.
- [Credit Analysis Implementation](./docs/CREDIT-ANALYSIS-IMPLEMENTATION.md) - credit report analysis implementation details.
- [IdentityIQ Parser Guide](./docs/IDENTITYIQ_PARSER_GUIDE.md) - parser-specific guidance for IdentityIQ reports.

## License

Private - All rights reserved.
