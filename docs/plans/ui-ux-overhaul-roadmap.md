# UI/UX Overhaul Implementation Roadmap

## Purpose

This roadmap addresses the findings from the comprehensive UI/UX audit conducted May 2026. It covers all phases from critical fixes through polish, ordered by severity and dependency.

The reader is an implementation agent or engineer. After reading this document, they should be able to execute phases in order without re-litigating design decisions.

## Audit Summary

The audit identified 20+ issues across 6 categories: CRM structural failure, design system cracks, engineering debt, mobile/responsive gaps, portal issues, and public site performance. The admin dashboard does not function as a CRM — it's a flat collection of disconnected data views with no relational intelligence between clients, disputes, billing, and tasks.

## Guiding Principles

- **CRM-first restructuring** — every admin page should orbit the client record
- **Fix foundations before polish** — theme-breaking bugs and mobile gaps block everything else
- **Decompose monoliths incrementally** — extract components without rewriting entire pages
- **One pattern, one place** — shared utilities, shared components, consistent theming
- **Ship each phase fully** — no half-completed phases; each phase leaves the app in a working state

---

## Phase 1: Critical Fixes and Foundations

**Duration estimate**: 2-3 sessions
**Blocks**: All subsequent phases

### 1.1 Fix Theme-Breaking Components

**Problem**: `Input.tsx`, `Textarea.tsx`, and `Accordion.tsx` hardcode `slate-*` colors instead of CSS variables, breaking dark mode and theme switching.

**Deliverables**:
- Replace all `slate-*` references in `Input.tsx` with semantic tokens (`border-border`, `bg-background`, `text-muted-foreground`, `ring-ring`)
- Replace all `slate-*` references in `Textarea.tsx` with semantic tokens
- Replace all `slate-*` references in `Accordion.tsx` with semantic tokens (`border-border`, `bg-background`, `text-muted-foreground`)
- Verify all three components render correctly in both light and dark themes

**Acceptance criteria**:
1. `Input`, `Textarea`, and `Accordion` render identically to current in light mode
2. All three components respond correctly to dark/light theme toggle
3. No hardcoded `slate-*` color values remain in these files
4. `npm run typecheck` and `npm run lint` pass

### 1.2 Add Toast/Notification System

**Problem**: No feedback mechanism for user actions. Pages use `alert()` and `confirm()` for critical operations.

**Deliverables**:
- Add `sonner` (or build a custom toast) to the project
- Create a `Toaster` component integrated into the root layout
- Create a shared `useToast` hook or import from sonner
- Replace all `alert()` calls across admin pages with toast notifications
- Replace all `confirm()` calls with a custom confirmation dialog component

**Acceptance criteria**:
1. Toast notifications appear for success/error states on all CRUD operations
2. A reusable `ConfirmDialog` component exists and replaces browser `confirm()`
3. No `alert()` or `confirm()` calls remain in any page or component
4. Toasts auto-dismiss and are accessible (announce to screen readers)

### 1.3 Add Mobile-Responsive Admin Layout

**Problem**: Admin sidebar is fixed 280px with no mobile breakpoint. Admin layout uses `ml-[280px]` with no responsive override. The admin is completely unusable on mobile.

**Deliverables**:
- Convert `AdminSidebar` to a drawer pattern on screens < 768px (hidden by default, open via hamburger button)
- Add a top bar for mobile with hamburger toggle + page title
- Update `AdminLayout` to remove left margin on mobile
- Add overlay backdrop when sidebar is open on mobile
- Ensure touch targets are minimum 44px on mobile

**Acceptance criteria**:
1. Admin sidebar is hidden by default on screens < 768px
2. Hamburger button in a mobile top bar opens sidebar as overlay
3. Overlay backdrop closes sidebar on tap
4. Main content takes full width on mobile
5. All interactive elements have minimum 44px touch targets
6. Current desktop behavior (fixed sidebar) is unchanged at >= 768px

### 1.4 Remove Banned Design Patterns

**Problem**: Side-stripe borders and gradient text patterns are used throughout, creating recognizable AI design tells.

**Deliverables**:
- Replace `border-l-4 border-l-orange-500` on "Today's Work" card in `admin/page.tsx` with a full-width top border or background tint
- Replace `border-l-4 border-l-red-500` on overdue calendar events in `CalendarWidget.tsx` with a top border, background tint, or leading icon indicator
- Replace `.text-gradient-gold` usage with solid gold color (`text-secondary` or a dedicated gold token)
- Replace `.text-shimmer` with a solid color or weight-based emphasis
- Replace `.hero-text-gradient` with solid color
- Audit all pages for any additional `border-left:` or `border-right:` with width > 1px
- Remove `background-clip: text` combined with gradient backgrounds

**Acceptance criteria**:
1. No `border-left` or `border-right` with width > 1px exists on any card, list item, callout, or alert
2. No `background-clip: text` combined with gradients exists for text elements
3. Visual emphasis is achieved through alternative patterns (background tints, leading icons, top borders, weight variations)
4. All changes are verified in both light and dark modes

---

## Phase 2: CRM Restructuring

**Duration estimate**: 4-6 sessions
**Blocks**: Phase 5 (design refinement)
**Depends on**: Phase 1

This is the core rework to transform the admin from flat data views into a real CRM.

### 2.1 Restructure Admin Dashboard into Tabbed Sections

**Problem**: The dashboard crams 17 widgets into a single vertical scroll with no information hierarchy. Every card has identical visual weight.

**Deliverables**:
- Create a dashboard tab system with 4 tabs: Overview, Pipeline, Analytics, Operations
- **Overview tab**: 4 KPI metrics + Today's Work + Calendar + Recent Activity (at-a-glance view)
- **Pipeline tab**: Client Pipeline Kanban + Dispute Pipeline + Bureau Success Rates
- **Analytics tab**: Score Trend Chart + Dispute Insights + Analytics Panel + Goal Tracker
- **Operations tab**: Work Queue + Team Activity + Automation Status + Onboarding Progress
- Remove the "Quick Actions" grid (redundant with sidebar)
- Persist selected tab in localStorage
- Add a density toggle that works across all tabs

**Acceptance criteria**:
1. Dashboard loads on the Overview tab by default
2. Each tab shows 3-5 widgets maximum — no scrolling more than 1.5 viewports
3. Tab selection persists across page navigations
4. Density toggle (comfortable/compact) applies to all tabs
5. All existing dashboard data and functionality is preserved
6. Page load time does not increase (lazy-load tab content)

### 2.2 Build Client 360 View

**Problem**: Client detail page is 1,645 lines with all 6 tabs inlined. No timeline, no cross-linking, no at-a-glance summary.

**Deliverables**:
- Create a client header bar component showing: name, status, key metrics (credit score, open disputes, days active), quick action buttons (new dispute, send message, upload report)
- Extract each tab into its own component file: `ClientOverviewTab.tsx`, `ClientProgressTab.tsx`, `ClientReportsTab.tsx`, `ClientDisputesTab.tsx`, `ClientTasksTab.tsx`, `ClientNotesTab.tsx`
- Build an Activity Timeline as the default "Overview" tab content showing chronological events: disputes sent, reports uploaded, score changes, tasks completed, notes added, agreements signed
- Add cross-links: disputes link to dispute detail, tasks link to client tasks, reports link to report viewer
- Add a sidebar or panel showing related records: open disputes count, pending tasks, billing status, agreement status

**Acceptance criteria**:
1. Client detail page renders with a persistent header bar and tabbed content
2. Each tab is a separate component under 300 lines
3. The Overview tab shows an activity timeline by default
4. Related records (disputes, tasks, billing) are navigable from the client view
5. No data or functionality is lost from the current implementation
6. Tab switching does not re-fetch data that's already loaded

### 2.3 Create Shared Data Context for Admin

**Problem**: Every page fetches data independently with raw `fetch()` in `useEffect`. No caching, no cross-page state, no request deduplication.

**Deliverables**:
- Add `@tanstack/react-query` to the project
- Create a `QueryProvider` wrapper in the app layout
- Create query hooks for core admin data: `useClients()`, `useDisputes()`, `useTasks()`, `useStats()`, `useClientById(id)`
- Replace raw `fetch()` calls in admin pages with query hooks (start with dashboard and client pages)
- Configure stale time, cache time, and refetch policies appropriate for each data type
- Add optimistic updates for mutations (complete task, update status, send dispute)

**Acceptance criteria**:
1. React Query is configured and available in all admin pages
2. Dashboard stats are cached and don't re-fetch on every visit
3. Client list is cached and shared between dashboard widget and clients page
4. Mutations (complete task, update status) show optimistic UI updates
5. Failed mutations roll back gracefully with error toasts
6. All existing fetch behavior is preserved (same API endpoints, same data)

### 2.4 Decompose Dispute Wizard

**Problem**: The dispute wizard is 3,692 lines in a single file — the largest component in the codebase.

**Deliverables**:
- Extract each wizard step into its own component: `StepClientSelect.tsx`, `StepBureauSelect.tsx`, `StepItemSelect.tsx`, `StepReasonCode.tsx`, `StepLetterEdit.tsx`, `StepReview.tsx`, `StepSubmit.tsx`
- Create a `useDisputeWizard` hook managing shared wizard state (current step, selected items, letter content)
- Create a `DisputeWizardProvider` context to share state between steps
- Keep the main `page.tsx` as an orchestrator that renders the current step component
- Extract the progress bar into the existing `DisputeWizardProgressBar.tsx` (already separated)

**Acceptance criteria**:
1. Each wizard step is in its own file under 400 lines
2. The main wizard page.tsx is under 200 lines (orchestrator only)
3. All wizard functionality is preserved (step navigation, validation, submission)
4. State is shared correctly between steps via context
5. `npm run typecheck` and `npm run lint` pass

---

## Phase 3: Design System Unification

**Duration estimate**: 2-3 sessions
**Depends on**: Phase 1

### 3.1 Build Missing Design System Components

**Problem**: Raw `<select>` elements are used throughout. No proper dialog, dropdown, or command palette components exist.

**Deliverables**:
- Create a `Select` component using CSS variables (matching Button/Card pattern)
- Create a `Dialog` component (modal) to replace inline overlay patterns
- Create a `DropdownMenu` component for action menus
- Create a `Badge` component to replace ad-hoc status pills
- Create a `Tabs` component to standardize tab patterns across admin

**Acceptance criteria**:
1. All new components use CSS variable colors, not hardcoded values
2. All new components support dark/light themes
3. All new components use `React.forwardRef` with `displayName`
4. At least 3 existing pages are updated to use the new components
5. Keyboard navigation works (Tab, Enter, Escape for dialog)

### 3.2 Reduce Glassmorphism and Vary Visual Treatment

**Problem**: Every card uses `bg-card/80 backdrop-blur-sm border-border/50`. This uniform glass treatment creates no visual hierarchy and is an AI design tell.

**Deliverables**:
- Establish 3 card elevation levels in the design system:
  - **Flat** (`bg-card border-border`): default cards, list items
  - **Elevated** (`bg-card shadow-sm border-border`): primary content areas, detail panels
  - **Prominent** (`bg-card shadow-md border-secondary/20`): call-to-action, alerts, highlighted items
- Reserve `backdrop-blur` for overlays, modals, and the fixed header only
- Apply different treatments to different card types across admin:
  - Metric cards: flat with colored left accent icon
  - Widget cards: elevated with shadow
  - Kanban cards: flat with hover elevation
  - Alert/attention cards: prominent with colored border top
- Update `globals.css` to define these card style utilities

**Acceptance criteria**:
1. No more than 3 card styles exist, each with a clear purpose
2. `backdrop-blur` is used only on overlays and the fixed header
3. Visual hierarchy is clear: users can distinguish metric cards from content cards from alerts
4. Dark mode renders correctly with all card styles

### 3.3 Diversify Animation Patterns

**Problem**: Every section uses the same `motion.div` with `opacity: 0, y: 20 → 1, 0` stagger pattern. After seeing it once, it's invisible.

**Deliverables**:
- Create 3-4 distinct animation patterns for different contexts:
  - **Dashboard metrics**: count-up animation for numbers (already have `CountUp` in Motion.tsx — use it)
  - **Widget content**: subtle fade only (`opacity: 0 → 1`), no y-translate
  - **Cards entering viewport**: `SlideUp` from below (current pattern — use sparingly, only for first-view)
  - **Tab content**: instant render, no animation (tabs should feel instant)
- Disable stagger on inner content — only animate the container, not each child
- Add `prefers-reduced-motion` support (already in globals.css, verify Motion.tsx respects it)

**Acceptance criteria**:
1. Not every element on every page uses the same fade-up animation
2. Dashboard metrics animate their numbers, not just the card container
3. Tab content switches are instant with no entry animation
4. `prefers-reduced-motion: reduce` disables all animations
5. Page feel is snappy, not sluggish from excessive animation

---

## Phase 4: Component Decomposition and Shared Utilities

**Duration estimate**: 3-4 sessions
**Depends on**: Phase 2 (client 360 sets the pattern)

### 4.1 Extract Shared Utility Functions

**Problem**: `formatCurrency`, `formatDate`, `getSafeInitials`, `getSafeFullName`, `getPriorityColor` are duplicated across 5+ files.

**Deliverables**:
- Create `src/lib/format.ts` with all formatting utilities
- Create `src/lib/client-utils.ts` with client-specific helpers (name formatting, initials)
- Create `src/lib/dispute-utils.ts` with dispute-specific helpers (status colors, priority)
- Replace all inline duplicates with imports from these modules
- Add unit tests for all extracted utilities

**Acceptance criteria**:
1. No duplicate utility functions exist across page/component files
2. All utilities are in `src/lib/` with proper exports
3. Each utility module has corresponding test file
4. All existing behavior is preserved (same output for same inputs)

### 4.2 Decompose Portal Page

**Problem**: `portal/page.tsx` is 1,459 lines with 15+ state hooks managing cases, documents, disputes, scores, tasks, letters, feedback, and upload modals.

**Deliverables**:
- Extract into components: `PortalOverview.tsx`, `PortalCases.tsx`, `PortalDocuments.tsx`, `PortalDisputes.tsx`, `PortalScoreHistory.tsx`, `PortalTasks.tsx`
- Create a `usePortalData` hook that handles all data fetching (replaces 7 separate `useEffect` calls)
- Create `UploadModal.tsx` and `LetterPreviewModal.tsx` as standalone modal components
- Add portal navigation (sidebar or tab bar) connecting the 3 portal pages

**Acceptance criteria**:
1. Main portal page is under 200 lines (orchestrator)
2. Each portal section is its own component under 300 lines
3. Portal has persistent navigation between dashboard, audit report, and agreement pages
4. All portal functionality is preserved

### 4.3 Decompose Remaining Admin Monoliths

**Problem**: Multiple admin pages exceed 500 lines.

**Deliverables**:
- `admin/clients/page.tsx` (834 lines): Extract `ClientFilters.tsx`, `ClientCreateModal.tsx`, `ClientEditModal.tsx`
- `admin/disputes/page.tsx` (815 lines): Extract `DisputeFilters.tsx`, `DisputeDetailPanel.tsx`
- `admin/tasks/page.tsx` (794 lines): Extract `TaskFilters.tsx`, `TaskCreateModal.tsx`, `TaskEditModal.tsx`
- `admin/settings/page.tsx` (805 lines): Extract `LLMConfigSection.tsx`, `DashboardPrefsSection.tsx`, `SystemSettingsSection.tsx`
- `admin/billing/page.tsx` (597 lines): Extract `InvoiceList.tsx`, `PaymentList.tsx`, `InvoiceCreateModal.tsx`
- `admin/compliance/page.tsx` (472 lines): Extract `ComplianceAlerts.tsx`, `ComplianceStatsGrid.tsx`

**Acceptance criteria**:
1. No admin page exceeds 400 lines
2. Every extracted component is under 300 lines
3. All functionality is preserved
4. `npm run typecheck` and `npm run lint` pass

---

## Phase 5: Visual Refinement and Polish

**Duration estimate**: 2-3 sessions
**Depends on**: Phases 2, 3

### 5.1 Revisit Font Choices

**Problem**: Plus Jakarta Sans is in the overused "reflex fonts" list. Playfair Display, while appropriate for luxury, may not be distinctive enough for a financial services brand.

**Deliverables**:
- Research 3 font pairing alternatives that convey trust, authority, and precision:
  - **Option A**: A geometric sans-serif body + refined serif display
  - **Option B**: A humanist sans-serif body + editorial serif display
  - **Option C**: A neo-grotesque body + modern contrast serif display
- Present options with side-by-side comparison on a sample dashboard page
- Implement chosen pair with proper `next/font/google` configuration
- Update `globals.css` `--font-sans` and `--font-serif` variables
- Verify all pages render correctly with new fonts

**Acceptance criteria**:
1. Neither font is in the reflex_fonts_to_reject list
2. Font pairing conveys trust and authority appropriate for financial services
3. Body text is readable at 14-16px with proper line height
4. Display text creates clear hierarchy
5. Font loading performance is acceptable (swap display, proper subsets)

### 5.2 Add Empty States That Teach

**Problem**: Empty states across the app just say "No data" or "Nothing here." They should teach the interface.

**Deliverables**:
- Create a reusable `EmptyState` component with: illustration/icon area, title, description, and optional CTA button
- Replace all "no data" states across admin with contextual empty states:
  - No clients: "Add your first client to get started" + Add Client button
  - No disputes: "Create a dispute to challenge negative items" + New Dispute button
  - No tasks: "All clear! Create a task to track follow-ups" + New Task button
  - No reports: "Upload a credit report to begin analysis" + Upload button
  - No activity: "Activity will appear here as you work with clients"
- Style empty states to feel inviting, not error-like

**Acceptance criteria**:
1. Every empty state has a clear title, description, and (where appropriate) a CTA
2. Empty states guide the user toward their next action
3. Empty state component is reusable and accepts custom content

### 5.3 Reduce Animated Backgrounds on Public Pages

**Problem**: Homepage, about, and services pages compose 3-5 animated backgrounds per section (`GradientOrbs`, `AnimatedGrid`, `ParticleField`, `NoiseOverlay`, `AuroraBackground`). Performance-heavy on lower-end devices.

**Deliverables**:
- Limit each section to maximum 2 animated background effects
- Prioritize `NoiseOverlay` (lightweight SVG) and `GradientOrbs` (CSS-only)
- Remove `ParticleField` (heavy SVG/DOM) from sections that already have other effects
- Remove `AuroraBackground` from non-hero sections
- Test performance on simulated mid-tier mobile device

**Acceptance criteria**:
1. No section uses more than 2 animated background effects simultaneously
2. Homepage LCP does not increase
3. Visual quality is maintained (sections still feel premium)
4. `prefers-reduced-motion` disables all background animations

### 5.4 Build Admin Command Palette

**Problem**: CRM operators need quick navigation without reaching for the sidebar.

**Deliverables**:
- Create a `CommandPalette` component triggered by `Cmd+K` / `Ctrl+K`
- Index commands: navigate to pages, search clients by name, create new dispute, create new task, toggle theme
- Show recent actions and favorites
- Add keyboard shortcut hints in the sidebar tooltips

**Acceptance criteria**:
1. `Cmd+K` opens command palette on all admin pages
2. Typing a client name shows matching clients with direct navigation
3. All admin pages are indexed and navigable
4. Escape closes the palette
5. Palette is accessible (focus trap, screen reader announces)

---

## Phase Dependencies

```
Phase 1 (Critical Fixes)
    │
    ├── Phase 2 (CRM Restructuring)
    │       │
    │       └── Phase 4 (Decomposition)
    │
    ├── Phase 3 (Design System)
    │       │
    │       └── Phase 5 (Polish)
    │
    └── Phase 4 depends on Phase 2 for patterns
```

Phases 2 and 3 can run in parallel after Phase 1 completes.
Phase 4 should follow Phase 2 (client 360 sets decomposition patterns).
Phase 5 should follow both Phase 3 and Phase 2.

## File Inventory: Pages and Components Touched

### Phase 1 Files
- `src/components/ui/Input.tsx`
- `src/components/ui/Textarea.tsx`
- `src/components/ui/Accordion.tsx`
- `src/app/globals.css`
- `src/app/admin/page.tsx`
- `src/app/layout.tsx`
- `src/app/admin/layout.tsx`
- `src/components/admin/AdminSidebar.tsx`
- `src/components/admin/CalendarWidget.tsx`
- New: `src/components/ui/Toaster.tsx`
- New: `src/components/ui/ConfirmDialog.tsx`
- New: `src/components/admin/AdminTopBar.tsx`

### Phase 2 Files
- `src/app/admin/page.tsx` (major restructure)
- `src/app/admin/clients/[id]/page.tsx` (major restructure)
- `src/app/admin/clients/page.tsx`
- `src/app/admin/disputes/wizard/page.tsx` (decompose)
- New: `src/components/admin/dashboard/` (tab components)
- New: `src/components/admin/client-detail/` (tab components)
- New: `src/components/admin/dispute-wizard/` (step components)
- New: `src/hooks/useAdminData.ts`
- New: `src/contexts/AdminQueryProvider.tsx`

### Phase 3 Files
- `src/app/globals.css`
- `src/components/ui/Motion.tsx`
- All admin pages (card class updates)
- New: `src/components/ui/Select.tsx`
- New: `src/components/ui/Dialog.tsx`
- New: `src/components/ui/DropdownMenu.tsx`
- New: `src/components/ui/Badge.tsx`
- New: `src/components/ui/Tabs.tsx`

### Phase 4 Files
- `src/app/portal/page.tsx` (decompose)
- `src/app/admin/clients/page.tsx`
- `src/app/admin/disputes/page.tsx`
- `src/app/admin/tasks/page.tsx`
- `src/app/admin/settings/page.tsx`
- `src/app/admin/billing/page.tsx`
- `src/app/admin/compliance/page.tsx`
- New: `src/lib/format.ts`
- New: `src/lib/client-utils.ts`
- New: `src/lib/dispute-utils.ts`
- New: Multiple extracted components

### Phase 5 Files
- `src/app/layout.tsx` (font config)
- `src/app/globals.css` (font variables)
- `src/app/page.tsx`
- `src/app/about/page.tsx`
- `src/app/services/page.tsx`
- All empty states across admin and portal
- New: `src/components/ui/EmptyState.tsx`
- New: `src/components/admin/CommandPalette.tsx`

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| React Query migration breaks existing data flow | Medium | High | Migrate page-by-page, keep fetch fallback behind feature flag |
| Font change breaks layout spacing | Low | Medium | Test all pages after font swap, adjust line-height/spacing as needed |
| Dashboard restructure confuses existing users | Medium | Medium | Default to Overview tab (closest to current layout), add tooltip for new users |
| Mobile sidebar drawer has z-index conflicts | Low | Low | Test with modals, toasts, and dropdowns open simultaneously |
| Decomposition introduces prop-drilling | Medium | Low | Use React Query hooks for data, context only for true shared state |

## Definition of Done (Per Phase)

Each phase is complete when:
- All acceptance criteria for every deliverable pass
- `npm run typecheck` passes with zero errors
- `npm run lint` passes with zero errors
- `npm run test` passes (existing tests + new tests for new code)
- `npm run build` succeeds
- All changes render correctly in both light and dark themes
- Mobile responsive behavior verified at 375px, 768px, and 1280px
- No console errors in browser during normal usage
