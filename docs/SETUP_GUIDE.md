# Setup Guide

Quick start guide for Top Tier Financial Solutions credit repair platform.

## Prerequisites

- **Node.js 18+** 
- **Python 3.12+** (for FastAPI backend)
- **Neon PostgreSQL** (or any PostgreSQL database)
- **Cloudflare R2** (S3-compatible storage)
- **Google Gemini API** (AI dispute letter generation)

## Quick Start

### 1. Install Dependencies

```bash
npm install

# Optional: Python dependencies for FastAPI backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp env.example .env
```

**Required variables:**

```env
# Database
DATABASE_URL="postgresql://user:password@host/db?sslmode=require"

# Authentication
BETTER_AUTH_SECRET="min-32-character-secret-key-here"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Cloudflare R2
R2_ACCOUNT_ID="your-account-id"
R2_ACCESS_KEY_ID="your-access-key"
R2_SECRET_ACCESS_KEY="your-secret-key"
R2_BUCKET_NAME="credit-reports"

# Google AI
GOOGLE_AI_API_KEY="your-gemini-api-key"
```

### 3. Setup Database

```bash
npm run db:migrate     # Apply migrations
npm run db:studio      # View database (optional)
```

### 4. Start Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## First-Time Setup

### Create Admin User

After signing up, promote your account to admin:

```sql
UPDATE "user" SET role = 'admin' WHERE email = 'your@email.com';
```

Or use the API (first user becomes admin automatically):

```bash
curl -X POST http://localhost:3000/api/admin/set-role \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-id", "role": "admin"}'
```

### Seed Templates (Optional)

```bash
npx tsx scripts/seed-dispute-templates.ts
npx tsx scripts/seed-agreement-template.ts
npx tsx scripts/seed-email-templates.ts
```

## Architecture

```
Next.js 16 (React 19)
├── Better Auth (email/password + roles)
├── Drizzle ORM → Neon PostgreSQL
├── Cloudflare R2 (file storage)
├── Google Gemini (AI letters)
└── FastAPI (optional Python backend)
```

## Key Features

### Admin Dashboard
- **Clients** - Manage credit repair clients
- **Credit Analysis** - Upload and parse reports (TransUnion, Experian, Equifax, IdentityIQ, MyScoreIQ, etc.)
- **Dispute Wizard** - AI-powered letter generation
- **CRM** - Tasks, notes, messaging
- **Compliance** - CROA/FCRA tracking

### Client Portal
- View case status and progress
- Sign agreements (CROA-compliant)
- Upload documents
- Track credit scores

### Public Site
- Services, blog, FAQs
- Cal.com booking integration
- Newsletter signup

## Common Issues

**Database Connection Error:**
- Verify `DATABASE_URL` format
- Check SSL mode is enabled for Neon

**Auth Not Working:**
- `BETTER_AUTH_SECRET` must be 32+ characters
- Match `NEXT_PUBLIC_APP_URL` to your dev URL
- Clear browser cookies

**File Uploads Failing:**
- Verify all R2 credentials in `.env`
- Check bucket exists and has correct name
- Configure CORS in Cloudflare if needed

**AI Features Not Working:**
- Verify `GOOGLE_AI_API_KEY` is valid
- Check API quota in Google Cloud Console

## Database Schema

35+ tables organized by domain:
- **Auth:** `user`, `session`, `account`, `verification`
- **CRM:** `clients`, `tasks`, `clientNotes`, `consultationRequests`
- **Credit:** `creditReports`, `creditAccounts`, `negativeItems`, `creditScoreHistory`
- **Disputes:** `disputes`, `disputeLetterTemplates`, `disputeBatches`
- **Compliance:** `clientAgreements`, `invoices`, `feeConfigurations`
- **Content:** `blogPosts`, `services`, `pages`, `faqItems`, `testimonials`
- **Email:** `emailTemplates`, `automationRules`, `emailLogs`

## Project Structure

```
├── api/              # Python FastAPI backend
├── db/               # Drizzle schema and client
├── drizzle/          # Database migrations
├── public/           # Static assets
├── scripts/          # Seeding and utility scripts
├── src/
│   ├── app/          # Next.js App Router
│   │   ├── admin/    # Admin dashboard
│   │   ├── portal/   # Client portal
│   │   ├── api/      # API routes
│   │   └── ...       # Public pages
│   ├── components/   # React components
│   └── lib/          # Parsers, auth, utilities
└── docs/             # Technical documentation
```

## Production Deployment

**Vercel (Recommended):**
1. Push to GitHub
2. Import in Vercel dashboard
3. Add environment variables
4. Deploy

**Important for Production:**
- Use strong secrets (32+ characters)
- Set `NEXT_PUBLIC_APP_URL` to production domain
- Configure R2 CORS for production
- Enable SSL for database connection

## Documentation

- [Credit Analysis Implementation](./docs/CREDIT-ANALYSIS-IMPLEMENTATION.md)
- [IdentityIQ Parser Guide](./docs/IDENTITYIQ_PARSER_GUIDE.md)
- [Parser Enhancements](./docs/IDENTITYIQ-PARSER-ENHANCEMENTS.md)
- [Security Remediation](./docs/SECURITY-REMEDIATION-PLAN.md)
- [Metro2 Violation Fixes](./docs/METRO2-VIOLATION-FIX-SUMMARY.md)
- [Parser Original Creditor Fix](./docs/PARSER-FIX-ORIGINAL-CREDITOR.md)
- [Response Clock Script](./docs/response-clock.md)

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run lint         # ESLint
npm run db:generate  # Generate migrations
npm run db:migrate   # Apply migrations
npm run db:push      # Push schema changes
npm run db:studio    # Database viewer
npm run fastapi-dev  # Python backend (optional)
```

## Support Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Better Auth Docs](https://better-auth.com/docs)
- [Drizzle ORM Docs](https://orm.drizzle.team)
- [Neon Docs](https://neon.tech/docs)
