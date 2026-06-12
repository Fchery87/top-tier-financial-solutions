# Credit Repair Platform Implementation Roadmap

## Purpose

This roadmap turns the domain model in `CONTEXT.md` into an implementation sequence for the Top Tier Financial Solutions platform.

The reader is an internal engineer or implementation agent. After reading this document, they should be able to implement the milestones in order without re-litigating the core domain decisions.

## Guiding Principles

Build compliance gates before payment automation.

Use deterministic application code for policy decisions. AI may render approved language, but it must not decide dispute eligibility, reason codes, evidence requirements, claim risk, target recipients, or escalation paths.

Evolve the existing schema incrementally. The current schema already contains useful foundations for clients, agreements, disclosures, invoices, tasks, disputes, credit reports, and portal records.

Treat the portal as a Client Collaboration Workspace, not a client-editable operations console.

Separate internal Operator Analytics from client-facing Client Outcome Analytics.

Keep near-term scope web/email-first. Defer SMS, native mobile, full white-label SaaS, and affiliate/referral tracking until the core operating workflow is reliable.

## Milestone 1: Service Engagement And Compliance Gate Foundation

Goal: make Service Engagements and Compliance Gate checks the backbone of the workflow.

Implement a minimal Service Engagement model. A Client may have multiple Service Engagements, but only one active engagement per service type. The first supported service types are Credit Audit and Credit Restoration.

Move service lifecycle progress toward the Service Engagement. Existing client status fields may remain temporarily for compatibility, but they should no longer be treated as the source of truth for service workflow progress.

Implement the Compliance Gate required before Ready for First Work.

The gate must check that client identity exists, the service agreement is signed, the CROA disclosure is separately acknowledged, notice of cancellation is delivered, the cancellation deadline is calculated, required identity and proof-of-address documents are uploaded, credit report access or import consent is captured, fee terms are disclosed, no upfront payment has been collected, and staff onboarding review is complete.

During the Cancellation Window, specialists may perform administrative onboarding, prepare internal dispute strategy, and draft dispute letters. They must not contact bureaus, furnishers, collectors, or creditors; submit or mail disputes; mark Services Rendered; create payable invoices; or charge the Client.

Acceptance criteria:

1. A Credit Audit Engagement and Credit Restoration Engagement can be represented separately.
2. A client cannot reach Ready for First Work until all Compliance Gate checks pass.
3. The admin dashboard clearly shows unresolved compliance blockers.
4. The Client Collaboration Workspace clearly shows the client’s missing onboarding actions.
5. Cancellation Window rules block external execution, billing, and charging while allowing internal preparation.

## Milestone 2: Secure Documents And Evidence Packets

Goal: replace loose document handling with controlled uploads and claim-linked Evidence Packets.

Implement a secure document upload pipeline for both staff and clients. Clients must not be able to register arbitrary file URLs as documents. Uploads should go through controlled storage, ownership checks, file type validation, file size validation, and a stable storage-key convention.

Add a document checklist for required onboarding evidence, including identity document and proof of address.

Introduce Evidence Packets as the set of documents and client confirmations attached to a dispute claim. Ordinary verification disputes may use default identity and proof-of-address documents. High-risk factual claims require claim-specific evidence before the system allows letter generation or submission.

Acceptance criteria:

1. Portal document upload cannot persist arbitrary external URLs.
2. Required onboarding documents are visible as checklist items.
3. Evidence can be attached to a specific dispute claim or Dispute Cycle.
4. High-risk claims are blocked unless the Evidence Packet satisfies the policy requirement.
5. Staff can distinguish loose client documents from evidence used for a specific claim.

## Milestone 3: Deterministic Dispute Policy And Letter Rendering

Goal: make dispute policy auditable and keep AI limited to rendering.

Implement a deterministic dispute policy engine. It should decide reason codes, claim eligibility, required evidence, claim risk, target recipient, and escalation path before any letter is drafted.

Refactor dispute routes so request handlers call the policy engine before letter generation. Remove free-text heuristics that allow policy decisions to drift across routes.

Narrow AI to the Letter Renderer role. The renderer receives approved inputs and drafts polished language. It must not invent facts, add unapproved reason codes, or upgrade a claim to a higher-risk category.

Acceptance criteria:

1. Ordinary factual, Metro 2, and verification disputes can be approved through deterministic policy.
2. Not-mine, identity-theft, fraud, never-late, unauthorized-inquiry, and sworn factual claims require explicit client confirmation and required evidence.
3. AI generation fails closed when policy approval is missing.
4. Tests prove the same inputs produce the same policy decision.
5. Generated letters can be traced back to approved policy inputs.

## Milestone 4: Dispute Cycle Execution And Submission Tracking

Goal: formalize each round of dispute work and track proof of submission.

Model a Dispute Cycle as one coordinated round of work. It includes item selection, policy approval, evidence attachment, letter generation, standing authorization or explicit confirmation, submission, response deadline tracking, response capture, outcome recording, and the next-cycle decision.

Implement Submission Tracking for each dispute package. Track submission method, date, recipient, certified or tracking number when available, expected response deadline, proof document, delivery status, and response status.

Keep mailing provider integration optional at this stage. The system should support manual mail tracking now and be ready for later integration with a print/mail provider.

Acceptance criteria:

1. Dispute Cycle is the canonical workflow unit and round is only its cycle number.
2. A dispute package cannot be marked submitted without Submission Tracking.
3. Response deadlines are calculated from the recorded submission event.
4. Staff can record manual certified mail details.
5. The system can later plug in a mail provider without changing the domain workflow.

## Milestone 5: Response Review And Next-Cycle Decisions

Goal: turn bureau, furnisher, collector, creditor, and regulator responses into structured outcomes.

Implement Response Review as the required transition after a response is received. Staff records the response, attaches the response document, classifies the outcome, and updates score or report changes when applicable.

Separate outcomes clearly. Deletion means the item no longer reports on a bureau. Update means the item remains but one or more fields changed. Verified means the respondent confirmed the disputed information. Improvement is a broader client-facing outcome that may include deletions, updates, score changes, reduced balances, resolved tasks, or other verified progress.

Compute next decisions from the reviewed response. Possible next decisions include closing the item, updating the item, escalating to the next Dispute Cycle, requesting method of verification, sending a furnisher dispute, or marking the item as not worth further action.

Acceptance criteria:

1. Every response must pass through Response Review before a next Dispute Cycle is created.
2. Outcome classifications are structured and not collapsed into one generic success flag.
3. Response documents are attached to the reviewed response.
4. Next-cycle recommendations are computed from structured response data.
5. Client-facing progress uses verified outcomes, not unreviewed responses.

## Milestone 6: Credit Report Pull History And Comparison

Goal: make repeated report imports useful for progress tracking and next actions.

Treat each import as a Credit Report Pull. A client can have many pulls over time.

Implement pull comparison to detect deleted items, updated statuses, new negative items, score changes, new inquiries, bureau discrepancies, and progress report changes.

Use deterministic parsers as the source of truth for supported provider formats. AI may assist with unknown formats, dirty inputs, confidence scoring, and anomaly detection. Extracted facts must be reviewable and auditable before they drive dispute strategy, Evidence Packets, Client Outcome Analytics, or client-facing reports.

Acceptance criteria:

1. Multiple Credit Report Pulls can be stored and compared for a Client or Service Engagement.
2. The system identifies deleted, updated, unchanged, and newly added negative items.
3. The system identifies score movement by bureau when available.
4. Parser confidence and review status are visible before extracted facts drive disputes.
5. Comparison outputs can feed progress reports and Response Review.

## Milestone 7: Client Collaboration Workspace

Goal: make the portal useful enough to reduce support burden and improve client confidence.

Expand the portal into a Client Collaboration Workspace. Clients can view progress, upload required documents, message the team, manage notification preferences, review educational resources, see next actions, and submit explicit confirmations for high-risk factual claims.

Clients must not directly edit dispute strategy, change operational statuses, alter Dispute Cycle decisions, or override compliance gates.

Implement Client Progress Snapshot as the computed source of truth for portal progress. It should derive from lifecycle stage, open client-visible Work Items, document checklist completion, active Dispute Cycle status, latest score history, recent outcomes, and unresolved compliance gates.

Acceptance criteria:

1. Clients see a mobile-friendly next-action dashboard.
2. Clients can send and receive secure messages.
3. Clients can manage notification preferences.
4. Clients can upload required documents through the secure upload pipeline.
5. Clients can provide explicit confirmation for high-risk factual claims.
6. Portal progress is computed from operational records rather than manually typed status copy.

## Milestone 8: Billing And Payment Readiness

Goal: make invoicing compliant before enabling live charging.

Implement structured Services Rendered events. For Credit Restoration, internal strategy preparation and draft letter generation during the Cancellation Window do not count as Services Rendered. The first billable credit repair service event is First Dispute Package Submitted.

For Credit Audit Engagements, credit report import and review may be billable only when sold as a separate engagement with its own agreement, fee terms, and service scope. In v1, paid Credit Audit Engagements use the same conservative agreement, disclosure, and Cancellation Window pattern as Credit Restoration.

Keep invoices, payment status, and payment audit logs in scope. Defer live payment processor charging until Compliance Gate and Results-Verified Billing Lock enforcement are implemented.

Acceptance criteria:

1. Payable invoices require a qualifying Services Rendered event.
2. Credit Restoration cannot become payable before First Dispute Package Submitted.
3. Credit Audit billing is tied to a separate Credit Audit Engagement.
4. Payment audit logs explain why an invoice became payable.
5. Live payment collection remains disabled until billing locks are enforced.

## Milestone 9: Operator And Client Outcome Analytics

Goal: provide trustworthy internal metrics and client-facing progress without mixing the two.

Implement Operator Analytics for internal business operations. Include throughput, SLA breaches, import success rate, response aging, staff workload, billing readiness, Dispute Cycle volume, and other operational health metrics.

Delivered June 2026: per-creditor strategy success analytics (`src/lib/creditor-strategy-insights.ts`, the creditor-strategies insights endpoint, and historical methodology recommendations in the triage response). See `docs/SECONDARY-BUREAUS-AND-CREDITOR-ANALYTICS.md`. Recommendations are advisory only and never override deterministic policy.

Implement Client Outcome Analytics for client-visible outcomes. Include score movement, deletions, updates, verified outcomes, new negative items, progress by bureau, and client-visible milestones.

Avoid numeric projected score increase claims by default. If Score Projections exist, keep them internal by default, label them as estimates, include disclaimers, and never present them as guaranteed outcomes.

Acceptance criteria:

1. Internal dashboards separate Operator Analytics from Client Outcome Analytics.
2. Dispute outcomes are grouped by bureau, item type, methodology, and cycle where possible.
3. Import success and parser failure rates are visible.
4. Staff can see response aging and overdue response work.
5. Client-facing metrics show verified outcomes, not operational guesses.

## Milestone 10: Security, Roles, And Production Hardening

Goal: harden the platform before production use at scale.

Replace super-admin-only assumptions with role and permission checks. Suggested permission groups include owner, manager, dispute specialist, onboarding specialist, billing, and support.

Complete the security remediation work already identified for the project. Prioritize role-management authorization, admin-access information disclosure, secret rotation, XSS sanitation for rendered HTML, rate limiting for sensitive and expensive routes, security logging, CSRF verification, CSP hardening, dependency hygiene, and audit-friendly logs.

Ensure PII encryption is consistently applied. PII access should go through service or repository boundaries that decrypt only where needed and never leak ciphertext into reports, letters, AI prompts, or portal views.

Acceptance criteria:

1. Staff roles map to explicit permissions.
2. Critical and high security remediation items are complete.
3. Sensitive routes are rate limited.
4. Rendered HTML is sanitized or otherwise safe by construction.
5. PII encryption/decryption is consistent across admin, portal, reporting, and letter generation flows.
6. Verification commands pass before production release.

## Deferred Scope

Native mobile apps are deferred until the responsive portal workflow is strong.

SMS is deferred until consent tracking, opt-out handling, templates, and compliance logging exist.

Full white-label SaaS is deferred. Basic business branding is in scope through company name, address, phone, email, logo, and portal accent colors.

Affiliate and referral tracking is deferred until the core operating workflow is reliable.

Live payment processor charging is deferred until billing compliance locks are enforced.

## Recommended Execution Order

Implement milestones in order. The dependencies are intentional.

Service Engagements and Compliance Gate rules come first because they define when work may begin and when billing may happen.

Secure documents and Evidence Packets come next because dispute policy depends on evidence.

Deterministic dispute policy comes before scaled letter generation because AI must render approved decisions only.

Dispute Cycle, Submission Tracking, and Response Review come before analytics because analytics must be based on structured workflow records.

Credit Report Pull comparison comes before stronger client progress reporting because progress claims need verified report changes.

Billing and live payments come after compliance and service-event tracking.

Security and role hardening should happen continuously, with critical findings treated as release blockers.

## Vertical Slices

- [ ] **S01: Service Engagement Basics** `risk:high` `depends:[]`
  > After this: staff can create or view a Credit Audit or Credit Restoration engagement for a client, and lifecycle progress lives on the engagement.
- [ ] **S02: Compliance Gate Status** `risk:high` `depends:[S01]`
  > After this: staff can see each Compliance Gate check as passing or failing for an engagement.
- [ ] **S03: Ready For First Work Blocking** `risk:high` `depends:[S02]`
  > After this: the system blocks Ready for First Work until required gate checks pass.
- [ ] **S04: Cancellation Window Execution Rules** `risk:high` `depends:[S03]`
  > After this: staff can draft strategy and letters during the window but cannot submit disputes, mark Services Rendered, invoice, or charge.
- [ ] **S05: Portal Onboarding Blockers** `risk:medium` `depends:[S02]`
  > After this: clients can see missing onboarding actions in the portal.
- [ ] **S06: Secure Portal Document Upload** `risk:high` `depends:[S01]`
  > After this: clients upload documents through controlled storage instead of submitting arbitrary file URLs.
- [ ] **S07: Document Checklist Completion** `risk:medium` `depends:[S06]`
  > After this: required identity and proof-of-address checklist items update from uploaded documents.
- [ ] **S08: Evidence Packet For A Claim** `risk:high` `depends:[S07]`
  > After this: staff can attach specific documents and confirmations to a dispute claim.
- [ ] **S09: High-Risk Claim Confirmation Gate** `risk:high` `depends:[S08]`
  > After this: not-mine, identity-theft, fraud, never-late, unauthorized-inquiry, and sworn factual claims are blocked without explicit client confirmation and evidence.
- [ ] **S10: Deterministic Policy Decision** `risk:high` `depends:[S09]`
  > After this: a dispute item can be evaluated into allowed reason codes, evidence requirements, claim risk, and target recipient without AI.
- [ ] **S11: Letter Renderer Boundary** `risk:high` `depends:[S10]`
  > After this: letter generation accepts only approved policy inputs and fails closed without them.
- [ ] **S12: Policy-Backed Dispute Creation** `risk:high` `depends:[S11]`
  > After this: creating a dispute persists deterministic policy decisions and generated letter content traceably.
- [ ] **S13: Dispute Cycle Record** `risk:medium` `depends:[S12]`
  > After this: staff can group approved disputes into a Dispute Cycle with a cycle number and status.
- [ ] **S14: Submission Tracking** `risk:high` `depends:[S13]`
  > After this: a dispute package cannot be marked submitted until submission method, recipient, date, and response deadline are recorded.
- [ ] **S15: Certified Mail Manual Tracking** `risk:medium` `depends:[S14]`
  > After this: staff can record certified or tracking numbers and proof documents for mailed disputes.
- [ ] **S16: Response Review Intake** `risk:high` `depends:[S14]`
  > After this: staff can attach a response document and classify a response before any next-cycle action.
- [ ] **S17: Outcome Vocabulary Enforcement** `risk:medium` `depends:[S16]`
  > After this: outcomes are stored as Deletion, Update, Verified, or other structured statuses without collapsing them into generic success.
- [ ] **S18: Next-Cycle Recommendation** `risk:high` `depends:[S17]`
  > After this: the system recommends close, update, escalate, method-of-verification, furnisher-dispute, or no-further-action after Response Review.
- [ ] **S19: Credit Report Pull History** `risk:medium` `depends:[S01]`
  > After this: multiple Credit Report Pulls can be stored for the same engagement and shown chronologically.
- [ ] **S20: Pull Comparison Engine** `risk:high` `depends:[S19]`
  > After this: the system detects deleted, updated, unchanged, and new negative items between two pulls.
- [ ] **S21: Parser Review State** `risk:medium` `depends:[S20]`
  > After this: extracted report facts show review and confidence state before they can drive disputes or reports.
- [ ] **S22: Progress Report Inputs** `risk:medium` `depends:[S20,S17]`
  > After this: report comparison and reviewed outcomes feed progress-report data.
- [ ] **S23: Portal Message Threads** `risk:medium` `depends:[S01]`
  > After this: clients and staff can exchange secure messages tied to the client or engagement.
- [ ] **S24: Notification Preferences** `risk:low` `depends:[S23]`
  > After this: clients can manage email notification preferences and messaging respects them.
- [ ] **S25: Client Progress Snapshot** `risk:medium` `depends:[S05,S13,S17,S22]`
  > After this: portal progress is computed from lifecycle, tasks, documents, dispute cycles, outcomes, and report history.
- [ ] **S26: High-Risk Confirmation In Portal** `risk:high` `depends:[S09,S23]`
  > After this: clients can explicitly confirm high-risk factual claims from the portal.
- [ ] **S27: Services Rendered Events** `risk:high` `depends:[S04,S14]`
  > After this: First Dispute Package Submitted can be recorded as a qualifying Services Rendered event.
- [ ] **S28: Payable Invoice Gate** `risk:high` `depends:[S27]`
  > After this: invoices cannot become payable unless a qualifying Services Rendered event exists.
- [ ] **S29: Credit Audit Engagement Billing** `risk:medium` `depends:[S01,S28]`
  > After this: paid Credit Audit engagements can invoice for audit work under their own agreement and service scope.
- [ ] **S30: Payment Audit Trail** `risk:medium` `depends:[S28]`
  > After this: every invoice-readiness or payment-status change records who, what, and why.
- [ ] **S31: Operator Analytics Summary** `risk:medium` `depends:[S14,S17,S20,S27]`
  > After this: staff can see import success, response aging, cycle throughput, billing readiness, and workload metrics.
- [ ] **S32: Client Outcome Analytics** `risk:medium` `depends:[S17,S20,S22]`
  > After this: staff can see deletions, updates, verified outcomes, score movement, new negatives, and bureau progress separately from operator metrics.
- [ ] **S33: Admin Analytics Panel** `risk:low` `depends:[S31,S32]`
  > After this: admin dashboard shows operational analytics and client outcome analytics in separate sections.
- [ ] **S34: Permission-Based Admin Access** `risk:high` `depends:[S01]`
  > After this: admin routes and UI use explicit permissions instead of super-admin-only checks.
- [ ] **S35: Security Remediation Criticals** `risk:high` `depends:[S34]`
  > After this: role-management bypass, admin access disclosure, secret rotation tasks, and sensitive route rate limits are resolved or documented as externally blocked.
- [ ] **S36: Safe Rendered HTML And CSP Hardening** `risk:high` `depends:[S35]`
  > After this: generated/report/agreement HTML rendering is sanitized or safe by construction, and CSP is tightened.
- [ ] **S37: PII Boundary Cleanup** `risk:high` `depends:[S34]`
  > After this: admin, portal, reporting, and letter generation use consistent encryption and decryption boundaries.
- [ ] **S38: End-To-End Production Readiness Pass** `risk:high` `depends:[S33,S36,S37]`
  > After this: a test client can move from lead/audit/restoration through gate, dispute cycle, submission, response review, report, invoice readiness, and analytics with verification passing.

## Definition Of Done For The Roadmap

The roadmap is complete when the platform can safely run a client from Lead through Credit Audit or Credit Restoration, enforce compliance gates, manage evidence-backed dispute cycles, track submissions and responses, produce approved reports, show client progress, invoice only after qualifying service events, and expose separate internal and client-facing analytics.
