# Design System — "Midnight & Brass"

> Updated: 2026-06-12
> Brand summary: [`brand-spec.md`](../brand-spec.md)

The Top Tier interface runs on one design language across the public marketing site, the admin SaaS console, and the client portal. It pairs a **warm paper canvas** with **dark ink "bookends"** and a **single brass accent**, built for a regulated financial product: editorial where it persuades, dense where it operates, restrained everywhere.

This document is the engineering reference. For the high-level brand story, see `brand-spec.md`.

---

## Principles

1. **Spend color deliberately.** Brass is the only decorative accent. Green and red are reserved for data signals (deltas, score bands) and destructive/risk states — never for decoration.
2. **Ink bookends, paper body.** Marketing header + footer are always dark ink; the body is warm paper. Heroes and closing CTAs are ink panels. The admin shell is an ink "desk": the sidebar sits directly on it and the workspace is a raised paper sheet (rounded, hairline-bordered) with its own scroll region.
3. **Editorial voice, product precision.** Serif (`Instrument Serif`) headlines for marketing; tight sans (`Satoshi`) for product UI; mono (`Geist Mono`) for numbers, labels, and eyebrows.
4. **Motion serves comprehension.** Custom ease-out, under ~300ms, interruptible. No infinite-loop decoration. Keyboard-driven repeats are never animated. Modal enter/exit and one-shot reveals are fine.
5. **One pattern, one place.** Shared components (`AdminPageHeader`, `StatGrid`, `MetricTile`, `ScoreBadge`, `StatusBadge`) drive consistency. Don't re-roll bespoke headers or stat cards per page.

---

## Tokens

All tokens live in `src/app/globals.css` — `:root` (light) and `.dark` (dark) — and are exposed to Tailwind v4 through the `@theme inline` block. Values are stored as raw HSL channels and consumed as `hsl(var(--token))`, so use the Tailwind color utilities (`bg-secondary`, `text-muted-foreground`, `border-border`, etc.) rather than hardcoded hex.

### Core palette (light → dark)

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--background` | `#FBFAF8` warm paper | `#151311` warm ink | App canvas |
| `--foreground` | `#1D1A17` warm ink | warm paper | Primary text |
| `--card` | white | raised ink panel | Surfaces, tables, cards |
| `--primary` | ink `#1D1A17` | paper | Solid CTAs, emphasis |
| `--secondary` | deep brass `#95661F` | bright brass `#ECC056` | The single accent |
| `--muted` / `--muted-foreground` | warm stone | warm stone | Quiet fills + secondary text |
| `--border` / `--input` | warm hairline `#E4E1DC` | dark hairline | Hairlines, inputs |
| `--ring` | brass | brass | Focus rings |

### Ink surface tokens (header, footer, hero, dark panels)

| Token | Role |
| --- | --- |
| `--ink` | base ink surface |
| `--ink-raised` | raised panel on ink |
| `--ink-border` | hairline on ink |
| `--ink-foreground` | text on ink |
| `--ink-muted` | muted text on ink |
| `--brass` | bright brass for ink surfaces |

Tailwind utilities: `surface-ink`, `surface-ink-raised`, `bg-ink`, `text-ink-foreground`, `text-ink-muted`, `border-ink-border`, `text-brass`.

### Sidebar tokens (admin chrome)

`--sidebar`, `--sidebar-foreground`, `--sidebar-border`, `--sidebar-muted`, `--sidebar-active` (brass), `--sidebar-active-foreground`. The admin sidebar is ink in both themes; the active item uses a brass `inset` accent bar.

### Data-signal tokens (the only place green/red are allowed on data)

- `--up` (forest) / `--down` (brick red) — directional deltas.
- Credit-score band scale: `--score-poor`, `--score-fair`, `--score-good`, `--score-verygood`, `--score-excellent` (red → forest).

### Radius & motion

- Radius: `--radius` `0.625rem` with `-sm`/`-md`/`-lg`/`-xl` steps.
- Easing: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` (entrances), `--ease-in-out` (on-screen movement), `--ease-drawer` (iOS-like drawers).

---

## Typography

Wired in `src/app/layout.tsx`:

| Family | Variable | Use | Helper class |
| --- | --- | --- | --- |
| `Instrument Serif` (italic-capable) | `--font-instrument-serif` | Marketing headlines, signature moments | `.font-editorial` |
| `Satoshi` (self-hosted) | `--font-satoshi` | Product UI headings + body | `.font-display`, default sans |
| `Geist Mono` | `--font-jetbrains-mono` | Numbers, labels, eyebrows | `font-mono` |

Conventions:
- **Editorial headline**: `font-editorial` with `<em>…</em>` for the brass italic phrase (e.g. "Bad credit isn't a verdict. It's a *case to be worked.*").
- **Eyebrow**: `font-mono text-[10px]/[11px] font-medium uppercase tracking-[0.28em] text-secondary` above a title.
- **Numbers**: always `font-mono tabular-nums` so figures align in tables and stat tiles.

---

## Shared components

### Marketing
- `PageHeader` (`src/components/PageHeader.tsx`) — editorial page header (eyebrow + serif title + description) for secondary marketing pages.
- `Header` / `Footer` — ink surfaces with the Apex mark, brass accents, and the editorial footer close.

### Admin (the SaaS console)
- **`AdminPageHeader`** (`src/components/admin/AdminPageHeader.tsx`) — the header on every admin page: mono `eyebrow`, **editorial serif title** (`.font-editorial`, the marketing display voice carried into the product), optional `description`, an `actions` slot, and a framing hairline underneath. Use this instead of hand-rolling `<h1>`s.
- **`StatGrid`** + `StatItem` (`src/components/admin/StatGrid.tsx`) — hairline-joined stat tiles (mono numbers, de-boxed icons). Each tile can `href`-link, `onClick`-toggle a filter (`active` prop draws a brass ring), or just display. Tones: `default | brass | up | down | warning`. Use `columns={2|3|4|5|6}`. This is the canonical stat-card pattern; the per-feature wrappers (`DisputeStatsCards`, `TaskStatsCards`, `BillingStatsCards`, `ComplianceStatsGrid`) all feed it.
- **`MetricTile`** (`src/components/ui/MetricTile.tsx`) — richer dashboard metric (label, big number, delta chip, sparkline).
- **`DataTable`** (`src/components/admin/DataTable.tsx`) — sortable table with mono uppercase headers, hairline rows, loading/empty states, pagination.
- **`StatusBadge`** (`src/components/admin/StatusBadge.tsx`) — squared chip with a colored band dot (`success | warning | danger | info | default`), matching `ScoreBadge`.
- **`ScoreBadge`** (`src/components/ui/ScoreBadge.tsx`) — credit-score chip colored by FICO band; `pill | plain | gauge` variants.
- **`DashboardTabs`** — underline tabs with a brass active marker.

### The admin shell ("paper sheet on the ink desk")

`src/app/admin/layout.tsx` locks the viewport (`h-dvh overflow-hidden`) on an ink canvas. The sidebar (`AdminSidebar`) is a **flat, single-level nav** directly on the ink — quiet mono section labels, no accordions, 32px rows, brass icons on the active row. The workspace is a rounded, hairline-bordered paper sheet containing the topbar (breadcrumbs, ⌘K search, actions) and an internal scroll region. Card titles across admin are compact (`text-sm font-semibold`, 16px icons); dashboard summary cards use mono uppercase labels instead.

### Conventions for new admin pages

```tsx
<div className="space-y-6">
  <AdminPageHeader
    eyebrow="Case Management"
    title="Clients"
    description="Manage clients, agreements, and credit analysis."
    actions={<Button>…</Button>}
  />
  <StatGrid items={stats} columns={4} />
  {/* filters */}
  <DataTable columns={columns} data={rows} loading={loading} />
</div>
```

- Eyebrows map to sidebar sections: `Case Management`, `Disputes`, `Operations`, `Content`, `System`.
- Avatars are bordered mono-initial tiles (`rounded-lg border border-border bg-muted font-mono`), **not** gradient circles.

---

## Surfaces & texture utilities

| Class | Purpose |
| --- | --- |
| `surface-ink` / `surface-ink-raised` | Dark ink panels (hero, footer, CTAs) |
| `brass-glow` | Single brass radial wash for ink heroes |
| `rule-grid` / `rule-grid-ink` | Hairline grid texture (light / on-ink) |
| `surface-panel` | Card surface with hairline border |
| `card-hover` | Subtle border/shadow shift on hover (no float) |
| `section-divider` / `decorative-line` | Brass-tinted hairline dividers |

---

## Motion rules

- Use `--ease-out` for entrances; keep UI animations under ~300ms.
- **Allowed**: button press `active:scale-[0.97]`, modal enter/exit, one-shot scroll reveals (`reveal-up`), the trust marquee, the hero score-arc draw.
- **Removed / banned**: infinite orbs, particle fields, aurora, pulsing glows, mouse-tracking tilt, per-element staggered mount jank on static sections, and animation on keyboard-repeatable actions.
- `AnimatedBackground.tsx` exports are intentionally **static** now (kept for API compatibility); `Motion.tsx`'s `TiltCard` is a plain wrapper.
- Respect `prefers-reduced-motion` (handled globally in `globals.css`).

---

## Do / Don't

**Do**
- Reach for `AdminPageHeader` + `StatGrid` on every admin page.
- Use semantic Tailwind tokens (`bg-secondary`, `text-muted-foreground`).
- Keep green/red for data and risk only.
- Use `font-editorial` + `<em>` for marketing headlines.

**Don't**
- Hardcode hex or `slate-*`/`zinc-*`/`indigo-*` colors.
- Add gradient avatar circles or boxed `rounded-xl bg-color/10` icon stat cards.
- Introduce infinite-loop decorative animation.
- Re-roll bespoke page headers or stat-card layouts.
