# Top Tier Financial Solutions Brand Spec
> Updated: 2026-06-12
> Design system: **"Midnight & Brass"** — private-banking editorial meets modern SaaS.
> Supersedes the earlier "Quiet Precision" (monochrome + indigo), "Operator Slate" (emerald), and "Quiet Wealth" (ivory/champagne) directions.
> Full engineering reference: [`docs/DESIGN-SYSTEM.md`](./docs/DESIGN-SYSTEM.md)

## Core Assets

### Logo — "Apex" mark
- Component: `src/components/brand/ApexMark.tsx` (also exported as `AscendantMark` for back-compat).
- Form: nested upward chevrons forming a peak (top tier / summit) on a warm-ink rounded tile.
- Colors: ink tile `#1D1A17`, paper outer chevron `#FAF8F4`, brass inner chevron `#ECC056`, hairline brass stroke.
- Favicon: `src/app/icon.tsx` mirrors the same mark.
- Usage: global header, footer, admin shell, client portal identity.
- Rule: render the SVG mark as-is. Do not stretch, blur, recolor outside the token set, or replace with a CSS approximation.

## Visual System

The system pairs a **warm paper canvas** with **ink "bookends"** (dark header + footer) and a **single brass accent**. Color is spent deliberately: brass for emphasis, green/red reserved strictly for data signals — never decoration.

### Palette
- **Canvas**: warm paper `#FBFAF8` (light) / warm ink `#151311` (dark).
- **Ink**: near-black warm ink `#1D1A17` — primary text and CTAs; also the surface for the header, footer, hero, and admin sidebar.
- **Brass accent**: deep brass `#95661F` on light (holds AA for text at this depth), bright brass `#ECC056` on dark/ink surfaces. This is the only decorative accent.
- **Stone neutrals**: warm greys for muted text, borders, and fills (no cool slate/zinc).
- **Data signals only**: forest green (`--up`) and brick red (`--down`) for directional deltas and the credit-score band scale (poor → excellent). Never used as decoration.
- **Destructive**: brick red, reserved for risk, overdue, error, and destructive states.

### Typography
- **Editorial display** (`.font-editorial`): `Instrument Serif`, italic-capable. Used for marketing headlines and a few signature product moments. The brass italic emphasis comes from `<em>`.
- **UI display + body** (`.font-display` / default sans): `Satoshi`, self-hosted. Tight tracking for product headings.
- **Mono / data / eyebrows** (`font-mono`): `Geist Mono`. Used for tabular numbers, labels, and the uppercase tracked eyebrows above titles.

### Motion
- Crisp, professional, interruptible. Custom ease-out (`--ease-out`) for entrances; UI animations stay under ~300ms.
- No infinite-loop decoration (no orbs, particles, pulsing glows, mouse-tracking tilt). Ambient backgrounds are static.
- Modal enter/exit and one-shot reveals are allowed; keyboard-driven repeats are not animated.

### Signature patterns
- **Ink bookends**: marketing header + footer are always dark ink; the page body is warm paper, so the frame reads as one continuous surface.
- **Editorial close**: ink panels (`surface-ink`) carry a `brass-glow` radial + `rule-grid-ink` hairline texture for heroes and closing CTAs.
- **Hairline grids**: stat tiles and pillar cards are joined by a single hairline (`gap-px` over a border background) rather than individual boxes.
- **Paper sheet on the ink desk**: the admin shell is a full-viewport ink surface (the sidebar sits directly on it) with the workspace as a raised, rounded paper sheet — the product mirror of the marketing ink bookends. Admin page titles use the editorial serif.

### Product Tone
- Premium financial operations; secure and compliance-aware.
- Editorial public site, dense admin console, guided client portal — one design language across all three.
- Modern, sharp, restrained. Beauty used as leverage, not noise.

### Implementation Notes
- Tokens live in `src/app/globals.css` (`:root` light, `.dark` dark) and are exposed to Tailwind v4 via `@theme inline`.
- Fonts are wired in `src/app/layout.tsx` (`--font-satoshi`, `--font-instrument-serif`, `--font-jetbrains-mono`).
- shadcn is initialized through `components.json`; conflicting shadcn files are renamed `shadcn-*` and wrapped by the project's existing uppercase import API.
- See [`docs/DESIGN-SYSTEM.md`](./docs/DESIGN-SYSTEM.md) for the full token table, shared components (`AdminPageHeader`, `StatGrid`, `MetricTile`, `ScoreBadge`, `StatusBadge`), and usage rules.
