# Stack Auth + Neon DB + Drizzle ORM Setup Guide

This project integrates Stack Auth (Neon Auth) with a Next.js app, Drizzle ORM, and Neon PostgreSQL database.

## What's Been Set Up

### 1. **Stack Auth (Authentication)**
- Stack Auth is integrated with Neon Auth, providing a managed authentication solution
- User data is automatically synced to your Neon PostgreSQL database in the `neon_auth.users_sync` table
- Authentication routes available at:
  - `/handler/sign-up` - Create new account
  - `/handler/sign-in` - Sign in to existing account
  - `/handler/account-settings` - Manage user profile

### 2. **Tailwind CSS & UI Styling**
- Tailwind CSS v4 is configured for styling Stack Auth components
- Custom color variables in CSS for light/dark mode support
- Stack Auth Radix UI components are properly styled through Tailwind

### 3. **Database Integration**
- **Drizzle ORM** configured with Neon PostgreSQL
- **Schema** in `db/schema.ts`:
  - `users` table with email uniqueness constraint
  - Fields: `id`, `name`, `email`, `created_at`
- **Database client** in `db/client.ts`
- **Sync function** in `db/sync.ts` to sync Neon Auth users to your custom tables

### 4. **API Endpoints**
- `POST /api/sync-users` - Manual endpoint to sync Neon Auth users to your database

### 5. **Pages**
- `/` - Home page
- `/profile` - User profile (requires authentication)
- `/handler/[...stack]` - Stack Auth routes

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Next.js App                       │
├─────────────────────────────────────────────────────┤
│ Stack Auth Provider                                 │
│ ├─ Authentication UI Components                    │
│ └─ Session Management (Cookies)                    │
├─────────────────────────────────────────────────────┤
│ Neon Auth Backend                                   │
│ └─ User sync → neon_auth.users_sync table          │
├─────────────────────────────────────────────────────┤
│ Your Drizzle ORM                                    │
│ └─ Custom users table                              │
├─────────────────────────────────────────────────────┤
│ Neon PostgreSQL Database                           │
└─────────────────────────────────────────────────────┘
```

## How It Works

1. **User Signs Up**
   - Navigate to `/handler/sign-up`
   - Stack Auth UI handles the sign-up form
   - Neon Auth creates user in `neon_auth.users_sync` table

2. **Sync Users to Custom Table**
   - Call `POST /api/sync-users` to copy users to your `users` table
   - Or use the `syncNeonAuthUsers()` function directly

3. **Access User Data**
   - Use `useUser()` hook in client components to get current user
   - Use `stackServerApp.getUser()` in server components

## Key Files

- `src/app/layout.tsx` - Root layout with Stack Auth provider
- `src/app/providers.tsx` - Tooltip and Stack Auth providers wrapper
- `src/app/globals.css` - Tailwind CSS with custom color variables
- `tailwind.config.mjs` - Tailwind configuration
- `db/schema.ts` - Drizzle ORM schema
- `db/client.ts` - Database client
- `db/sync.ts` - User sync function
- `src/app/api/sync-users/route.ts` - API endpoint for syncing users

## Environment Variables Required

Make sure these are in your `.env` file:

```
NEXT_PUBLIC_STACK_PROJECT_ID=<your-project-id>
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=<your-publishable-key>
STACK_SECRET_SERVER_KEY=<your-secret-key>
DATABASE_URL=<your-neon-connection-string>
```

## Next Steps

1. **Run Development Server**
   ```bash
   npm run dev
   ```

2. **Test Authentication**
   - Go to http://localhost:3000/handler/sign-up
   - Create a test user
   - Check your database: `SELECT * FROM neon_auth.users_sync`

3. **Sync Users**
   - Make a POST request to `/api/sync-users`
   - Check your `users` table: `SELECT * FROM users`

4. **Access User Data**
   - Go to http://localhost:3000/profile
   - See user information displayed

## Styling

The UI styling comes from Stack Auth's built-in components styled with Tailwind CSS. The color scheme uses CSS variables for easy customization:

- Update CSS variables in `src/app/globals.css` to change colors
- Supports light/dark mode via `prefers-color-scheme`

## Database Queries

View all authenticated users:
```sql
SELECT * FROM neon_auth.users_sync WHERE deleted_at IS NULL;
```

View synced users in your custom table:
```sql
SELECT * FROM users;
```

## Troubleshooting

**Sign-up page looks wrong**: Make sure Tailwind CSS is loading by checking the browser inspector. Verify `tailwind.config.mjs` includes the correct content paths.

**Users not appearing in database**: 
1. Check that Neon Auth is enabled in your Neon console
2. Verify DATABASE_URL is correct
3. Call `/api/sync-users` to manually sync

**"Tooltip must be used within TooltipProvider" error**: This is fixed by the `TooltipWrapper` component in `src/app/providers.tsx`.

## Resources

- [Stack Auth Docs](https://docs.stack-auth.com)
- [Neon Auth Docs](https://neon.com/docs/neon-auth/overview)
- [Drizzle ORM Docs](https://orm.drizzle.team)
- [Tailwind CSS Docs](https://tailwindcss.com)
