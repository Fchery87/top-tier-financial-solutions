# Top Tier Financial Solutions - Agent Development Guide

## Project Snapshot
Next.js 16 full-stack application with Python FastAPI backend for credit repair management. Features admin dashboard, client portal, and public website with AI-powered dispute generation and multi-bureau credit report analysis.

## Root Setup Commands
```bash
# Install all dependencies (Node.js + Python)
npm install
pip install -r requirements.txt

# Database setup
npm run db:migrate

# Start development servers
npm run dev                    # Next.js frontend
npm run fastapi-dev           # Python FastAPI backend (separate terminal)

# Full validation
npm run validate              # Lint + Typecheck + Test + Build
```

## Universal Conventions
- **TypeScript strict mode** - All files must pass `tsc --noEmit`
- **ESLint with Next.js config** - Run `npm run lint` before commits
- **Conventional Commits** - Use format: `feat:`, `fix:`, `chore:`, etc.
- **Absolute imports** - Use `@/` for src imports, `@/db` for database
- **Tailwind CSS** - All styling via utility classes, no CSS files except globals.css

## Security & Secrets
- Never commit API keys or database URLs
- Use `.env.local` for local development (copied from `env.example`)
- All secrets must have `NEXT_PUBLIC_` prefix for client-side access
- PII handling: All credit data stored in secure database, never in localStorage

## JIT Index - Directory Map

### Package Structure
- Admin Dashboard: `src/app/admin/` → [see src/app/admin/AGENTS.md](src/app/admin/AGENTS.md)
- Client Portal: `src/app/portal/` → [see src/app/portal/AGENTS.md](src/app/portal/AGENTS.md)
- API Routes: `src/app/api/` → [see src/app/api/AGENTS.md](src/app/api/AGENTS.md)
- React Components: `src/components/` → [see src/components/AGENTS.md](src/components/AGENTS.md)
- Core Logic: `src/lib/` → [see src/lib/AGENTS.md](src/lib/AGENTS.md)
- Database: `db/` → [see db/AGENTS.md](db/AGENTS.md)
- Python Backend: `api/` → [see api/AGENTS.md](api/AGENTS.md)

### Quick Find Commands
- Search for a function: `rg -n "functionName" src/`
- Find a React component: `rg -n "export.*Component" src/components`
- Find API routes: `rg -n "export (GET|POST|PUT|DELETE)" src/app/api`
- Find database schema: `rg -n "pgTable" db/`
- Find Python endpoints: `rg -n "@app\.(get|post|put|delete)" api/`
- Find test files: `find src -name "*.test.{ts,tsx}"`

### Domain-Specific Searches
- Credit dispute logic: `rg -n "dispute" src/lib/`
- AI letter generation: `rg -n "ai.*letter|generate.*letter" src/lib/`
- Credit report parsing: `rg -n "parse.*report|credit.*analysis" src/lib/parsers/`
- Authentication: `rg -n "auth|session" src/lib/auth.ts`

## Definition of Done
- All TypeScript checks pass (`npm run typecheck`)
- All linting passes (`npm run lint`)
- Tests pass (`npm run test`)
- Build succeeds (`npm run build`)
- Database migrations applied if schema changes
- No console errors in browser
- Responsive design verified on mobile/desktop
