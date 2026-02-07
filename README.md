# Top Tier Financial Solutions

A comprehensive credit repair management platform built with Next.js 16, featuring client management, credit report analysis, automated dispute generation, and CROA/TSR compliance tracking.

## Tech Stack

- **Frontend:** Next.js 16 (React 19), TypeScript, Tailwind CSS v4, Framer Motion
- **Backend:** Next.js API Routes (primary) + optional legacy Python FastAPI service
- **Database:** Neon PostgreSQL with Drizzle ORM
- **Authentication:** Better Auth with email/password and admin roles
- **Storage:** Cloudflare R2 (S3-compatible)
- **AI:** Google Gemini for dispute letter generation
- **Scheduling:** Cal.com integration

## Features

### Admin Dashboard
- **Client Management** - Track clients through their credit repair journey
- **Credit Report Analysis** - Multi-bureau parsing (TransUnion, Experian, Equifax, IdentityIQ, MyScoreIQ, SmartCredit, etc.)
- **Dispute Management** - AI-powered dispute letter generation with batch processing
- **FCRA Compliance** - Track items past reporting limits
- **CRM** - Tasks, notes, and client communication
- **Billing** - Invoice management with CROA-compliant fee structures
- **Content Management** - Blog, FAQs, testimonials, services, and pages

### Client Portal
- View case status and progress
- Sign service agreements (CROA-compliant with 3-day cancellation)
- Access audit reports
- Secure document uploads
- Track credit score history

### Public Website
- Services information
- Blog/Education hub
- FAQ section
- Contact forms with Cal.com booking integration
- Newsletter signup

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp env.example .env
# Edit .env with your credentials

# Run database migrations
npm run db:migrate

# Start development server
npm run dev

# (Optional legacy) Start FastAPI backend
npm run fastapi-dev
```

## Environment Variables

See `env.example` for all required variables:

- `DATABASE_URL` - Neon PostgreSQL connection string
- `BETTER_AUTH_SECRET` - Auth secret (min 32 chars)
- `NEXT_PUBLIC_APP_URL` - Application URL
- `R2_*` - Cloudflare R2 credentials
- `GOOGLE_AI_API_KEY` - Gemini API for AI features
- `NEXT_PUBLIC_CAL_*` - Cal.com integration

## Scripts

```bash
npm run dev          # Start Next.js development server
npm run fastapi-dev  # Start legacy FastAPI backend
npm run build        # Production build
npm run lint         # Run ESLint
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Run migrations
npm run db:repair-migrations -- --through=0014_wealthy_kree  # Repair migration journal baseline
npm run db:push      # Push schema changes
npm run db:studio    # Open Drizzle Studio
```

## Project Structure

```
├── api/              # Legacy Python FastAPI backend (optional)
├── db/               # Database client and schema
├── drizzle/          # Database migrations
├── public/           # Static assets
├── scripts/          # Utility scripts (seeding, migrations)
├── src/
│   ├── app/          # Next.js App Router pages
│   │   ├── admin/    # Admin dashboard pages
│   │   ├── portal/   # Client portal pages
│   │   ├── api/      # API routes
│   │   └── ...       # Public pages
│   ├── components/   # React components
│   └── lib/          # Utilities, parsers, auth
└── specs/            # Project specifications
```

## Documentation

- [Setup Guide](./SETUP_GUIDE.md) - Detailed setup instructions
- [Credit Analysis Implementation](./docs/CREDIT-ANALYSIS-IMPLEMENTATION.md)
- [IdentityIQ Parser Guide](./docs/IDENTITYIQ_PARSER_GUIDE.md)

## License

Private - All rights reserved
