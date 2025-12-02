# Setup Guide

This guide covers the complete setup for the Top Tier Financial Solutions platform.

## Prerequisites

- Node.js 18+ 
- Python 3.12+ (for FastAPI backend)
- PostgreSQL database (Neon recommended)
- Cloudflare R2 account (for file storage)
- Google AI API key (for Gemini)
- Cal.com account (optional, for scheduling)

## Installation

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd top-tier-financial-solutions

# Install Node.js dependencies
npm install

# Set up Python virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Environment Configuration

Copy the example environment file and configure:

```bash
cp env.example .env
```

Edit `.env` with your credentials:

```env
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"

# Authentication (Better Auth)
BETTER_AUTH_SECRET="your-secret-key-min-32-chars"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# FastAPI Backend
API_URL="http://127.0.0.1:8000/api/v1"
SECRET_KEY="your-secret-key-for-jwt-min-32-chars"

# Cloudflare R2 Storage
R2_ACCOUNT_ID="your-cloudflare-account-id"
R2_ACCESS_KEY_ID="your-r2-access-key-id"
R2_SECRET_ACCESS_KEY="your-r2-secret-access-key"
R2_BUCKET_NAME="credit-reports"

# Google AI (Gemini) for dispute letters
GOOGLE_AI_API_KEY="your-google-ai-api-key"

# Cal.com Integration (Optional)
NEXT_PUBLIC_CAL_USERNAME="your-cal-username"
NEXT_PUBLIC_CAL_EVENT_TYPE="consultation"

# Analytics (Optional)
NEXT_PUBLIC_GA_MEASUREMENT_ID="G-XXXXXXXXXX"
NEXT_PUBLIC_PLAUSIBLE_DOMAIN="yourdomain.com"

# Email (Optional)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@example.com"
SMTP_PASSWORD="your-email-app-password"
CONTACT_EMAIL="contact@toptierfinancial.com"
```

### 3. Database Setup

```bash
# Generate migrations from schema
npm run db:generate

# Apply migrations to database
npm run db:migrate

# (Optional) Open Drizzle Studio to view/edit data
npm run db:studio
```

### 4. Seed Initial Data (Optional)

```bash
# Seed dispute letter templates
npx tsx scripts/seed-dispute-templates.ts

# Seed agreement template
npx tsx scripts/seed-agreement-template.ts
```

### 5. Start Development Servers

```bash
# Terminal 1: Next.js frontend
npm run dev

# Terminal 2: FastAPI backend (optional)
npm run fastapi-dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Next.js 16 App                    │
├─────────────────────────────────────────────────────┤
│ Better Auth Provider                                │
│ ├─ Email/Password Authentication                   │
│ ├─ Admin Role Management                           │
│ └─ Session Management (Cookies)                    │
├─────────────────────────────────────────────────────┤
│ API Routes                                          │
│ ├─ /api/auth/* - Authentication endpoints          │
│ ├─ /api/admin/* - Admin dashboard APIs             │
│ └─ /api/portal/* - Client portal APIs              │
├─────────────────────────────────────────────────────┤
│ Drizzle ORM + Neon PostgreSQL                      │
│ └─ 35+ tables for comprehensive CRM                │
├─────────────────────────────────────────────────────┤
│ External Services                                   │
│ ├─ Cloudflare R2 (File Storage)                    │
│ ├─ Google Gemini (AI Letter Generation)            │
│ └─ Cal.com (Appointment Scheduling)                │
└─────────────────────────────────────────────────────┘
```

## Authentication

### Better Auth Setup

Authentication is handled by [Better Auth](https://better-auth.com) with the following features:

- Email/password registration and login
- Role-based access control (`user`, `admin`, `super_admin`)
- Session management with secure cookies
- Admin plugin for user management

### Auth Routes

- `/sign-in` - User login
- `/sign-up` - User registration
- `/profile` - User profile management (authenticated)

### Making a User Admin

Use the admin API endpoint:

```bash
curl -X POST http://localhost:3000/api/admin/set-role \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-id", "role": "admin"}'
```

Or directly in the database:

```sql
UPDATE "user" SET role = 'admin' WHERE email = 'admin@example.com';
```

## Key Features Setup

### Credit Report Parsing

The platform supports parsing credit reports from multiple sources:

- TransUnion, Experian, Equifax (direct)
- IdentityIQ, MyScoreIQ, SmartCredit
- PrivacyGuard, AnnualCreditReport.com

Upload credit reports via the Admin Dashboard → Clients → [Client] → Upload Report.

### AI Dispute Letter Generation

Requires `GOOGLE_AI_API_KEY` for Google Gemini. The AI generates personalized dispute letters based on:

- Negative item details
- FCRA/FDCPA compliance requirements
- Client information

### Cloudflare R2 Storage

Set up an R2 bucket for credit report storage:

1. Create a bucket in Cloudflare dashboard
2. Generate API tokens with read/write access
3. Configure CORS if needed for direct uploads

### Cal.com Integration

1. Create a Cal.com account
2. Set up an event type for consultations
3. Add your username and event type to `.env`

## Database Schema Overview

The schema (`db/schema.ts`) includes:

**Authentication:**
- `user`, `session`, `account`, `verification`

**CRM:**
- `clients`, `consultationRequests`, `tasks`, `clientNotes`

**Credit Analysis:**
- `creditReports`, `creditAccounts`, `negativeItems`
- `creditAnalyses`, `consumerProfiles`, `bureauDiscrepancies`
- `fcraComplianceItems`, `creditScoreHistory`

**Disputes:**
- `disputes`, `disputeBatches`, `disputeLetterTemplates`

**Compliance (CROA/TSR):**
- `agreementTemplates`, `clientAgreements`, `disclosureAcknowledgments`
- `invoices`, `feeConfigurations`, `paymentAuditLog`

**Content:**
- `blogPosts`, `blogCategories`, `faqItems`, `testimonials`
- `services`, `pages`, `disclaimers`

**Communication:**
- `messageThreads`, `messages`, `messageAttachments`
- `emailSubscribers`, `emailCampaigns`

## Troubleshooting

### Database Connection Issues

```bash
# Test connection
npm run db:studio
```

Verify `DATABASE_URL` format: `postgresql://user:password@host:port/database?sslmode=require`

### Authentication Not Working

1. Check `BETTER_AUTH_SECRET` is at least 32 characters
2. Verify `NEXT_PUBLIC_APP_URL` matches your dev URL
3. Clear browser cookies and try again

### File Uploads Failing

1. Verify R2 credentials in `.env`
2. Check bucket CORS configuration
3. Ensure bucket name matches `R2_BUCKET_NAME`

### AI Features Not Working

1. Verify `GOOGLE_AI_API_KEY` is valid
2. Check API quota in Google Cloud Console
3. Review error logs for rate limiting

## Production Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy

### Environment Variables for Production

Ensure all secrets are properly set:
- Use strong, unique values for `BETTER_AUTH_SECRET` and `SECRET_KEY`
- Set `NEXT_PUBLIC_APP_URL` to your production domain
- Configure R2 CORS for your production domain

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Better Auth Documentation](https://better-auth.com/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [Neon Documentation](https://neon.tech/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
