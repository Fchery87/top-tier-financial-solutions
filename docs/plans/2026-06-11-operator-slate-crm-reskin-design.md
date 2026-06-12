# Operator Slate + Signal Green — CRM Reskin Design

**Date:** 2026-06-11
**Status:** Approved, implementation starting
**Supersedes (visually):** the "Quiet Wealth" skin for app surfaces. Structure from `ui-ux-overhaul-roadmap.md` is already built; this is a reskin, not a restructure.

## Goal

Make Top Tier Financial Solutions look and feel like a competitor-grade credit-repair operations console (DisputeFox / Credit Repair Cloud class), with the **CRM/admin as the top priority**. The structural CRM work (tabbed dashboard, command palette, client-detail tabs, pipeline, work queue) already exists. The problem is the *skin*: warm ivory + champagne + editorial Fraunces serif reads "boutique wealth manager," not "dense operational credit tool." We reskin toward a cool, dense, data-forward, app-like aesthetic.

## Locked decisions

- **Direction:** Reskin toward competitors (keep codebase + structure; change the skin).
- **Priority:** CRM feels like a real credit CRM.
- **Palette:** Operator Slate + Signal Green — cool slate neutrals, near-black chrome, emerald accent (green = score rising).
- **Typography:** Crisp sans in-app (Geist Sans + mono numbers); refined serif retained on marketing only.

## 1. Design foundation

### Color system (`src/app/globals.css` rewrite)

- **Light app:** canvas `slate-50 #F8FAFC`; cards white `#FFFFFF`; ink `slate-900 #0F172A`; muted `slate-500 #64748B`; hairlines `slate-200 #E2E8F0`.
- **Dark app / chrome:** background `#0B0F14` (near-black); raised panels `#11161D`; borders `white/8`.
- **Brand / primary:** emerald `#10B981`. Primary actions + "score up." Kept to ≤1 strong instance per view so it stays a signal.
- **Credit-specific semantics:** `up`=emerald, `down`=red `#EF4444`, `warning`=amber `#F59E0B`.
- **Score-band scale** (the credit-tool tell): poor→excellent maps red→orange→amber→lime→emerald, used by `ScoreBadge`, gauges, and trend zones.

### Typography

- In-app (admin/portal): `Geist Sans` for all text; `Geist Mono` (or JetBrains Mono) for all numbers — scores, currency, dates — `tabular-nums`.
- Marketing: keep a refined serif display for brand warmth.
- Tighter type scale + denser line-heights in the CRM.

### Density

- CRM defaults to **compact** (existing density toggle stays): shorter hero, more rows/screen, 13–14px data text, 32–36px stat numbers.

### Motion (unchanged, Emil-style)

- `--ease-out` on enters, `scale(0.97)` on press, tabs instant, count-up on stat numbers, no animation on `⌘K`. Honor `prefers-reduced-motion`.

### Logo — "Ascendant v2"

- Keep ascending-bars concept (bars = rising score = top tier). Re-cut emerald→slate, sharper geometry, tighter optical spacing; apex dot emerald.
- Deliverables: square app-icon (`public/brand/` + `src/app/icon.tsx` favicon) and inline wordmark for the top bar + marketing nav.

## 2. CRM / admin specifics

- **App chrome — new `AdminTopBar`:** breadcrumb (left), global search that opens `⌘K` (center), New Dispute primary + notifications + theme toggle + avatar (right). Biggest "real CRM" lever.
- **Sidebar reskin:** slate/near-black, denser rows, emerald active state (replaces champagne), quiet slate section caps.
- **Dashboard:** compress the tall serif hero to a one-line header + inline attention stats. KPI cards become dense **metric tiles** = label + big tabular number + delta chip (`+37 ▲` emerald / `−4 ▼` red) + sparkline.
- **Credit-specific components:**
  - `ScoreBadge` — colors 300–850 across the band scale; used in rows, pipeline cards, detail headers.
  - `ScoreTrendChart` recolor — emerald line + band-tinted zones.
  - Dispute pipeline — dense kanban/table with bureau tags (TU/EXP/EQ), status pills, days-in-stage.
  - Client 360 header — name, `ScoreBadge`, open disputes, days active, next deadline, quick actions.
- **`DataTable` reskin:** sticky header, hairline rows, tabular-num right-aligned numbers, hover highlight, compact row height.
- **Reusable primitives:** `StatusBadge`, `Badge`, metric tile, `ScoreBadge`, delta chip — so pages inherit the look.

## 3. Rollout scope

Each step leaves the app working + type-checking. CRM first.

1. **Foundation** — rewrite `globals.css` tokens; wire Geist Sans/Mono in `layout.tsx`; scope serif to marketing. (Big visual flip via tokens.)
2. **App chrome** — `AdminTopBar`; reskin `AdminSidebar`.
3. **Shared primitives** — `ScoreBadge`, metric tile w/ delta+sparkline, reskinned `StatusBadge`/`Badge`/`DataTable`.
4. **Dashboard** — compress hero; reskin 4 tabs; recolor `ScoreTrendChart`.
5. **Client 360 + lists** — detail header + clients/disputes/tasks tables to operational density.
6. **Remaining admin pages** — billing, compliance, settings, etc. inherit primitives; spot-fix stragglers.
7. **Portal** — reskin to the cool system.
8. **Marketing** — cool-neutral system but keep serif display; new wordmark.

## Verification

Per step: `npm run typecheck`, `npm run lint`; screenshot key surfaces in **both** light and dark. Dark mode is first-class (operators live in it).

## Risk register

| Risk | Mitigation |
| --- | --- |
| Token flip breaks per-page hardcoded colors | Grep for hardcoded `champagne`/warm hex + `slate-*` left from before; convert to semantic tokens as encountered |
| Serif removal in-app breaks spacing | Test headings after font swap; adjust leading |
| Marketing reskin clashes with retained serif | Keep marketing pass light; verify serif display still reads warm on cool neutrals |
| Two-week-old Quiet Wealth memory drifts | Verify current code before assuming a page's state |
