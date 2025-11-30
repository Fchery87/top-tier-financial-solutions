---
title: "Project Dependencies"
owner: "devops"
version: "1"
date: "2025-11-29"
status: "approved"
architecture: "web_application"
preset: "web_nextjs_drizzle"
---

# Project Dependencies

## Overview

| Attribute | Value |
|-----------|-------|
| **Architecture** | Web Application |
| **Preset** | Next.js + Drizzle (Recommended) |
| **Total Packages** | 12 |
| **Production** | 12 |
| **Development** | 0 |
| **Status** | ✅ Approved |

## Stack Configuration

| Component | Technology |
|-----------|------------|
| **Frontend** | Next.js 14 App Router + Tailwind CSS |
| **Backend** | Next.js API Routes + Server Actions |
| **Database** | PostgreSQL + Drizzle ORM + Neon |
| **Deployment** | Vercel / Railway |

## Production Dependencies

| Package | Version | Category | Size |
|---------|---------|----------|------|
| next | ^14.2.0 | core | ~150KB |
| react | ^18.3.0 | core | ~6KB |
| typescript | ^5.4.0 | core |
| tailwindcss | ^3.4.0 | ui | varies |
| drizzle-orm | ^0.30.0 | data | ~20KB |
| @neondatabase/serverless | ^0.9.0 | data | ~15KB |
| better-auth | ^1.0.0 | auth | ~25KB |
| @tanstack/react-query | ^5.32.0 | data | ~40KB |
| zod | ^3.23.0 | utils | ~12KB |
| react-hook-form | ^7.51.0 | ui | ~25KB |
| lucide-react | ^0.378.0 | ui | varies |
| date-fns | ^3.6.0 | utils | ~30KB |



## Key Highlights

- Type-safe database queries with Drizzle
- Serverless-ready with Neon PostgreSQL
- Modern form handling with react-hook-form + zod
- Optimistic updates with TanStack Query

## Installation

```bash
# Install all dependencies
pnpm install

# Or with npm
npm install

# Or with yarn
yarn install
```

## Approval Notes

Dependencies reviewed and approved for this project.

## Approved

- **Date**: 2025-11-29T06:25:38.659Z
- **Status**: ✅ Approved
