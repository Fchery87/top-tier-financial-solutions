# Top Tier Financial Solutions — "Quiet Wealth" Design System
> Direction: Quiet Wealth (Kenya Hara / Apple restraint, editorial). Evolved from existing graphite + champagne + wealth-green DNA.
> Date: 2026-05-26 · Status: DEMO / proposal for review

## Philosophy

Quiet luxury for a compliance-first financial product. Restraint signals trust. One accent
(champagne), used sparingly, against a warm ivory canvas and graphite ink. Editorial serif
display type gives gravity; numbers are calm and tabular, never neon. The current UI's biggest
liability is the rainbow of colored icon chips (blue/purple/orange/cyan/green) — premium products
do not look like a sticker sheet. We consolidate to a disciplined monochrome + single accent.

**Rules of the system**
- One accent: champagne. If everything is gold, nothing is — use it for ≤10% of any view.
- Color carries meaning, never decoration. Green = restoration/success. Amber = caution. Brick = risk. Otherwise graphite.
- Whitespace is the layout tool. Hairline rules (1px, low-opacity) over heavy borders/shadows.
- Serif display for headlines + hero numbers; sans for body/UI; mono for eyebrows, labels, dense data.

## 🎨 Palette (evolved)

### Light (canvas) — HSL for globals.css
| Token | HEX | HSL | Use |
|---|---|---|---|
| background | #F4F1EC | 40 30% 94% | warm ivory canvas |
| card | #FBFAF7 | 45 33% 98% | document surface |
| foreground | #14110F | 30 14% 7% | graphite ink |
| muted-foreground | #6B645C | 30 8% 39% | secondary text |
| border | #E4DED4 | 40 23% 86% | hairline rules |
| secondary (ACCENT) | #8F7440 | 39 38% 41% | champagne — the one accent |
| secondary-soft | #ECE3D2 | 39 43% 87% | champagne wash |
| success | #2F6B4F | 152 39% 30% | deep restoration green (not neon mint) |
| success-soft | #E2EBE4 | 134 18% 90% | green wash |
| warning | #B5832B | 38 62% 44% | muted ochre (on-brand w/ champagne) |
| destructive | #A23A33 | 4 51% 42% | muted brick red (not #EF4444) |

### Dark (sidebar + dark mode)
| Token | HEX | Use |
|---|---|---|
| background | #0F0D0B | graphite black |
| surface | #1B1714 | raised panel |
| foreground | #EDE8DF | warm off-white |
| muted-foreground | #9A9085 | secondary on dark |
| secondary (accent) | #C6A96C | champagne, brighter on dark |
| border | rgba(255,255,255,0.08) | hairlines |

## ✍️ Type
- **Display / serif:** Fraunces (opsz, soft, editorial). Headlines, hero metric numbers. Weight 300–500.
- **Body / UI:** Geist (existing). Inter as web fallback.
- **Mono:** Geist Mono. Eyebrows (small-caps letterspaced), data labels, tabular numerics.
- Scale: editorial — large, light serif headlines (clamp 2rem–3.25rem), generous line-height on body (1.65).

## 🖼️ Logo
- New mark required (3 concepts proposed in `logo-concepts.html`).
- Must work on ivory and graphite, mono champagne + graphite, no gradients required to read.
- Lockup: icon + letterspaced wordmark "TOP TIER" / "FINANCIAL SOLUTIONS" subline.

## 🚫 Anti-slop (kill list for this redesign)
- Multi-color icon chips → monochrome graphite icons; champagne only for the single key action.
- Heavy drop shadows / glassmorphism everywhere → hairline borders + one soft elevation for true modals.
- Neon mint/purple → deep forest green + champagne.
- Decorative gradients on every panel → flat warm surfaces; gradient reserved for logo + one hero wash.

## Signature details (do 120%)
- Champagne hairline that underlines the active nav item and section eyebrows.
- Hero metric numbers set in light Fraunces with tabular alignment — the "quiet luxury" tell.
- Calm status dots (6px) instead of loud badges where possible.
