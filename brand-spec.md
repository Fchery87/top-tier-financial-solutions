# Top Tier Financial Solutions Brand Spec
> Updated: 2026-05-05
> Asset source: user-provided SVG at `top-tier-financial-solutions-variation-3-transparent-logo-only.svg`
> Asset completeness: partial, with logo provided and palette/type inferred from product direction

## Core Assets

### Logo
- Source file: `top-tier-financial-solutions-variation-3-transparent-logo-only.svg`
- Public app asset: `public/brand/top-tier-logo.svg`
- Usage: global header, footer, admin shell, favicon-adjacent marks, client portal identity
- Current production version: resketched as a clean vector shield monogram because the supplied SVG wrapped an embedded raster image and looked muddy at app navigation sizes.
- Rule: use as an image asset. Do not stretch, blur, or replace with a CSS approximation.

## Visual System

### Palette
- Background: graphite black and warm ivory
- Primary: financial graphite
- Accent: champagne metal, replacing the previous red/coral accent
- Support: private wealth green for trust, progress, and document confidence
- Destructive: red remains reserved only for risk, overdue, error, and destructive states

### Typography
- Display: `Bricolage Grotesque`
- Body: `Geist Sans`
- Mono/data: `Geist Mono`

### Product Tone
- Premium financial operations
- Secure and compliance-aware
- Modern, sharp, and less decorative
- Guided client journey, dense admin console, editorial public site

### Implementation Notes
- shadcn is initialized through `components.json` using the base-nova style.
- shadcn source files that conflicted with existing uppercase imports were renamed to `shadcn-*` files and wrapped by the project’s existing import API.
