# CRM and SaaS Review: Top Tier Financial Solutions

Date: 2026-10-08. Baseline: `main` at `be03635`, plus the uncommitted working tree.

How this was produced. Four read-only code explorers each traced one slice: the CRM core, the dispute and letter pipeline, billing, and platform and security. Two web researchers covered competitors and payments plus compliance. Every High finding marked **(verified)** was re-checked by hand against the source. Competitor feature cells come from vendor pages and review sites, so treat them as approximate. Legal points are product requirements, not legal advice. Have counsel confirm them before launch.

## 1. Verdict

The domain core is strong. The operating system around it is not finished.

The FCRA and dispute logic is deeper than most commercial competitors. It includes nine report parsers, Metro 2 inconsistency detection, deterministic reason codes, evidence packets, letter lint, and a CFPB eligibility gate. About 994 unit tests pass.

The problems sit in the joins between modules. Several gates were built to refuse, but the code that would let them pass was never written. Some screens call endpoints with a request shape the server rejects. Encrypted PII leaks into documents as ciphertext. The result is a system that is safe because it cannot complete its core flows.

| Area | State | Biggest problem |
|---|---|---|
| Lead to client | Partial | No convert button, no pipeline writes, no source tracking |
| Onboarding and compliance gate | Broken | Nothing writes `compliance_gate_checks` **(verified)** |
| Agreements and e-sign | Defective | Fee terms never filled in, and names stored as ciphertext in signed contracts **(verified)** |
| Credit report import | Good, manual only | No monitoring-provider API, upload only |
| Dispute wizard and letters | Broken in UI | Server requires `policyDecision`, and no screen sends it **(verified)** |
| Mailing | Missing | `.txt` export only, no PDF, no print-and-mail |
| Response and escalation | Partial | Cron is never scheduled and is POST-only |
| Billing and payments | Ledger only | No processor, no profile billing tab, collection always refuses |
| Client portal | Partial | APIs for messages, onboarding and progress exist, but no portal UI uses them |
| Security and platform | Mixed | Agreement-sign IDOR **(verified)**, admin plugin bypass, partial PII encryption, no MFA, no CI |
| SaaS readiness | Single business | No tenant key on any of the 66 tables |

## 2. Market baseline

### What the field charges and ships

| Product | Price (per month) | Notable |
|---|---|---|
| Credit Repair Cloud | $179 to $599 (3 to 24 users) | Market leader. One-click import (IdentityIQ, SmartCredit, MyScoreIQ, MyFreeScoreNow), dispute wizard, mailing, Authorize.net and NMI billing, affiliate portal, Zapier, QuickBooks |
| DisputeFox | $129 to $499 | Built-in billing, mobile-first portal, affiliate portal, Metro 2 letters, print and mail |
| Client Dispute Manager | $49 to $329 | AI dispute engine, Metro 2 letters, Zapier |
| DisputeBee | $49 / $129 | Unlimited clients on the business tier, e-contract, API |
| Credit Money Machine | $129.97 to $179.97 | AI letters, affiliate commissions, invoicing |
| DisputeSuite | $300 to $800 | Unlimited clients, affiliate self-service portal |
| Consumer AI (Dovly, SmartDispute.ai, Dispute AI) | $0 to $49 | DIY, AI letters, bundled monitoring |

Sources include creditrepaircloud.com, disputefox.com/features, clientdisputemanagersoftware.com/pricing, creditmoneymachine.com/pricing, disputesuite.com/how-to-buy-pricing, and dovly.com/pricing. Review aggregators (SoftwareSuggest, SaaSworthy, Capterra) filled the gaps.

### Table stakes in 2026

1. One-click import from at least two monitoring services.
2. A dispute wizard with rounds and 30/45-day tracking.
3. AI-assisted letters plus a template library.
4. Bureau, furnisher and collector letters, including debt validation.
5. Print and certified mail, or an integration with proof of delivery.
6. A client portal with messaging, a document checklist and progress tracking, plus a mobile-friendly or native app.
7. E-signed CROA agreements with the separate disclosure and a cancellation form.
8. Integrated billing through a high-risk gateway (Authorize.net or NMI), recurring billing, and charging from the client record.
9. Team roles.
10. Affiliate or referral partner portal.
11. Email and SMS automation.
12. Zapier and QuickBooks.

### Where this product already leads

- Deterministic policy with AI used only to render language (ADR 0001).
- Evidence packets and portal confirmation for high-risk claims.
- Services-rendered billing gates (ADR 0002).
- Parser review gate.
- Obsolescence clocks.
- Creditor-strategy analytics.
- CFPB packet routing.

Most competitors leave compliance to the operator. That stance is a real differentiator once the flows actually complete.

## 3. Findings by area

Severity: **H** blocks a core flow or creates legal or security exposure. **M** produces wrong behavior. **L** is cleanup.

### 3.1 Lead to client (CRM core)

- **H.** Leads (`consultation_requests`) have no convert action. The only path is to post `lead_id` to `POST /api/admin/clients`, which then sets the lead to `archived`, so a converted lead looks like a dead one in analytics.
- **H.** The new client gets no Service Engagement, even though engagements are the workflow backbone in CONTEXT.md.
- **M.** `clients.stage` and `clients.assignedTo` are never written. The pipeline shows every client as "lead" and unassigned.
- **M.** Three competing stage fields exist: `clients.status` (free text), `clients.stage` (6-value enum) and `service_engagements.lifecycleStage` (14 stages). Pick one per principle: the engagement lifecycle.
- **M.** No lead owner, follow-up date, UTM or referrer, or affiliate attribution. Source tracking is only `sourcePageSlug`.
- **M.** The `bookings` table is unused, and Cal.com has no webhook sync.
- **H (verified).** Client name and phone are encrypted at rest. Many routes read them raw, including pipeline, tasks, stats, messages, agreements and the nudge cron. As a result, staff screens, emails and contracts show ciphertext. Name search uses `ilike` over ciphertext, so only email search works.
- **Missing.** Kanban pipeline, bulk actions, CSV import, a unified activity timeline per client, staff-initiated document requests, and profile tabs for Agreements, Documents, Messages, Billing and Engagements.

### 3.2 Onboarding, agreements and the compliance gate

- **H (verified).** No production code inserts or updates `compliance_gate_checks`; only five read sites exist. Ready for First Work, services-rendered events, invoices and payment authorization therefore all return 409 permanently. The roadmap marks S01 through S05 as done, but the writer half was never built. Tests seed the rows directly, which hides this.
- **H (verified).** `{{service_package}}` in Exhibit A of the agreement is never substituted. Clients sign contracts that disclose no fee terms, which is a CROA §1679d written-contract requirement.
- **H (verified).** `POST /api/admin/agreements/sign` checks only that a session exists. Any logged-in user, including a self-registered portal user, can sign any agreement by ID. Nothing in the UI calls it. Delete it.
- **H.** Signature data, initials, user agent and `x-forwarded-for` are interpolated unescaped into agreement HTML. That is stored HTML injection.
- **H.** Signed agreements, disclosure acknowledgments and payment authorizations cascade-delete with the client. Admins can also delete a signed agreement or PATCH its status to `signed`. CROA and FTC record-keeping needs immutable, retained contracts.
- **M.** The cancellation deadline ignores holidays and the template's `cancellationPeriodDays`. The portal has no cancel button or cancellation form. `cancellation-window-policy.ts` is imported only by tests.
- **M.** Portal document upload inserts `caseId: ''` for clients with no `client_cases` row, which is every new client. The foreign key fails after the file is already in R2.
- **M.** A client portal account is an open self-signup. Linking it to a client means PUTting a raw `user_id`. There is no invite flow and no email verification.

### 3.3 Credit reports, disputes and letters

- **H (verified).** Both dispute-creation screens fail. `generate-letter` and `POST /disputes` return 400 unless the body carries `policyDecision.approved`. Neither the wizard payload builder nor `DisputesTab` sends it, and the e2e fixture mocks the endpoint, so tests stay green.
- **H.** The policy engine runs at the caller, not the server. No production code calls `evaluateDisputePolicy` to decide; the route only checks the caller-supplied decision for consistency. This contradicts ADR 0001. Fix: compute the decision on the server from database facts and drop it from the request.
- **H (verified).** `generateWithLLM` forces JSON output on Gemini, the default provider, and on OpenAI, while the letter prompts ask for plain text. Gemini letters are likely stored JSON-wrapped. OpenAI rejects JSON mode when the prompt has no "json", and the code falls back to the template while still tagging the draft `generatedByAi`.
- **H.** Letters are signed with ciphertext names. The address, DOB and SSN-last-4 fields are hard-coded to `undefined`. The "account number" is the last four characters of a database UUID.
- **H.** Marking a dispute sent ignores the cancellation window and the compliance gate. `POST /disputes` even accepts `status` and `sentAt` at creation.
- **H.** When a bureau gives a removal date, obsolescence takes it as the start date, so the item expires seven years after the removal date. The in-flight parser change (`account-fields.ts`) makes this path live.
- **M.** Four high-risk claim lists disagree with each other. Any attached document counts as evidence, so an ID copy satisfies an identity-theft claim.
- **M.** The policy engine always returns `targetRecipient: 'bureau'`. Furnisher and collector letters have no address book, and an unknown bureau falls back to the TransUnion address.
- **M.** `disputeType` is ignored in the prompt, so goodwill and validation letters get "factual dispute" framing. Round 3 or later always cites §623 direct-furnisher language. Note Reg V 1022.43(b)(1)(iii): furnishers need not investigate direct disputes prepared by a credit repair organization.
- **M.** Combined multi-item letters lose per-item tracking. Dispute cycles are not linked to disputes, because `disputes` has no `cycleId`.
- **M.** The response clock reads only `sentAt`, while the submission form saves `submissionDate` and drops it. The escalation cron is POST-only with no `vercel.json`, so Vercel Cron's GET returns 405. The old `scripts/response-clock.ts` conflicts with the cron.
- **Missing.** Print-to-PDF with enclosures (ID and proof of address), a print-and-mail API (Lob, LetterStream, Click2Mail, DocuPost), monitoring-provider import APIs, the §605B identity-theft block flow with FTC report handling, FDCPA validation-window tracking, and per-item outcome tracking.

### 3.4 Billing and payments

The details are in section 4. In short: no processor; billing is a ledger; the gate blocks every invoice; the only "collect" action always refuses; and the profile has no billing tab.

- **H.** The results-verified lock can be self-attested at invoice creation (`feeModel` and `resultVerified` come from the body). It is also inconsistent with the collection check.
- **H.** One services-rendered event can back unlimited invoices. The amount is not validated against the fee plan.
- **M.** The invoice to engagement link lives only inside audit-log JSON; there is no `serviceEngagementId` column.
- **M.** Bank-account fingerprints are unsalted SHA-256 hashes stored next to last-4, which makes them brute-forceable. Use HMAC with a server key.
- **M.** No mark-paid, void, refund, receipt or PDF route. Revenue statistics ignore refunds. Editing a fee plan creates a duplicate.
- **M.** The portal shows no invoices or balance.

### 3.5 Platform, security and SaaS

- **H.** better-auth's `admin()` plugin runs with defaults. Its `/api/auth/admin/*` endpoints (set-user-password, impersonate-user, remove-user, set-role) are open to the app's `admin` role, bypassing `capabilities.ts`, and `super_admin` is not in the plugin's `adminRoles`. Configure the plugin's roles or block the path.
- **H.** PII encryption is partial:
  - `dateOfBirth`, `consumer_profiles` (SSN last 4, DOB, address) and `credit_reports.raw_data` are stored in plaintext.
  - `creditorName` is declared as encrypted but is never encrypted on insert.
  - LLM API keys sit in plaintext in `system_settings`.
  - `safeDecryptValue` returns ciphertext silently on failure.

  GLBA Safeguards (16 CFR 314) requires encryption at rest and MFA for systems holding customer information.
- **H.** No MFA, no email verification, no password reset, and sign-up is open. `set-role` lets the first caller claim super_admin on a fresh deploy.
- **H.** No CI (no `.github/`). Validation depends on someone running it by hand.
- **M.** Five routes check `session.user.role` inline and exclude `staff`, even though staff hold those capabilities. No route validates input with a schema; zod lives only on an unmerged branch. Ten routes are rate-limited.
- **M.** The schema has 59 text pseudo-enums, 24 JSON-as-text columns and 186 timestamps without time zone; the timezone gap matters for FCRA day counts. There are no soft deletes. Migration snapshots are missing for 0013, 0015 to 0019, 0034 and 0035, and there is an orphan `0014_client_visible_tasks.sql`.
- **M.** The dead FastAPI `api/` folder with `requirements.txt` sits at the repo root with no `.vercelignore`. Vercel may deploy it as Python functions with a default JWT secret. Check the production Functions list, then delete the folder.
- **M.** About 14 feature branches with several hundred unmerged commits have been stranded since 2026-08-09. They include api-boundary-validation, encryption-key-rotation, letter-rendering and structured-logging. Some overlap findings here. Decide merge-or-close before starting new work.
- **SaaS.** No table carries an organization or tenant ID, settings are global, and the brand is hard-coded in 23 files. Selling this to other credit repair companies needs either a tenant key on every table and query, or a deployment-per-customer model. Decide this before adding more tables. It is the costliest change to retrofit.
- **Tests.** `tsc` is clean. 994 tests pass and 2 fail (`dispute-submission-tracking.test.ts`), because the uncommitted evidence-gate change was not reflected in that test's mocks.

## 4. Payments: what to use and what is legal

**Processor.** Stripe, PayPal, Square and Braintree do not accept credit repair; Stripe's restricted-business list names "credit repair". Use a high-risk ISO that underwrites credit repair, such as PaymentCloud, Soar Payments, Durango Merchant Services, Easy Pay Direct or Host Merchant Services, on the **NMI** gateway. Authorize.net is the fallback.

NMI is broker-portable, so changing acquiring bank means no code change. It does cards plus ACH, its Customer Vault tokens keep card and bank numbers off our servers, and Collect.js hosted fields keep PCI scope at SAQ A. The schema already anticipates `nmi | authorize_net`.

**Demand drafts are off the table for phone sales.** 16 CFR 310.4(a)(9) bans remotely created payment orders for anything "offered or sold through telemarketing". 310.6(b)(5) and (6) remove the inbound-call exemptions for credit repair ("§ 310.4(a)(2)") and say they never apply to "the requirements of § 310.4(a)(9)". The operator confirmed some sales happen by phone. ACH debit is not covered by that ban.

**Timing rules that apply to every instrument:**

- **CROA §1679b(b).** No fee before the service is "fully performed".
- **TSR §310.4(a)(2).** For telemarketed credit repair, no fee until the promised period has passed and a consumer report issued more than six months after the results shows those results.

Telemarketed sales therefore cannot use monthly or first-work billing at all. They need the Results-Verified Billing Lock that CONTEXT.md already defines. Each engagement must record its sales channel so the system can pick the right lock.

The CFPB's 2023 Lexington Law / Progrexion judgment turned on TSR advance fees collected from telemarketed sales.

**State law.** Many states require registration and a surety bond for credit services organizations; California, Texas and others do. Verify each state you sell into with counsel. The research agent's state table was not reliable enough to repeat here.

## 5. What to fix, in order

Order rule: make the existing flows complete before adding surface. Delete before building.

**Phase 0. Stop the bleeding (days).**
1. Delete `api/admin/agreements/sign`. Escape every value interpolated into agreement HTML.
2. Configure or block better-auth admin plugin endpoints. Remove the `set-role` bootstrap race.
3. Add CI that runs typecheck, lint and test on every push.
4. Fix the 2 failing tests, then land or discard the uncommitted working tree.
5. Triage the 14 stranded branches: merge, rebase or close each.
6. Confirm the FastAPI folder is not deployed, then delete `api/` and `venv/`.

**Phase 1. Make the core loop complete (1 to 2 weeks).**
1. A compliance gate writer. Derive checks from records (agreement signed, disclosure acknowledged, cancellation deadline passed, documents uploaded, consent captured), plus a staff attestation UI for the manual checks.
2. Agreement fee terms rendered from the client's fee plan. Decrypt PII when rendering. Make agreements immutable: soft delete, a content hash, no status PATCH to `signed`.
3. Lead conversion that creates the client and the engagement in one transaction. Use one canonical lifecycle field.
4. Compute the dispute policy on the server. Fix the LLM output mode. Put the real name, address and account number in letters. Gate "mark sent" on the cancellation window.
5. Fix the obsolescence base date.
6. Cron routes accept GET and are scheduled in `vercel.json`. Retire `scripts/response-clock.ts`.

**Phase 2. Money (1 to 2 weeks, then processor onboarding).**
1. A Billing tab on the client profile. Manual payment recording (Zelle, check, cash, ACH by bank). Mark paid, void, refund and receipt. Portal invoice view. (Chosen bridge, now being built.)
2. A sales-channel field on each engagement that drives the Results-Verified lock for telemarketed sales.
3. Once the high-risk merchant account is approved: NMI Collect.js plus Customer Vault, then charge-from-profile with idempotency keys, signed webhooks, ACH return handling and dunning.

**Phase 3. Competitive parity (ongoing).**
1. PDF letter packets with enclosures, then a print-and-mail API (Lob, LetterStream or DocuPost) with tracking written back to submission tracking.
2. Monitoring-provider import (IdentityIQ, SmartCredit, MyScoreIQ) through partner APIs.
3. Portal messaging, onboarding checklist and progress UI over the existing APIs. A mobile-friendly PWA comes before any native app.
4. Affiliate or referral partners with attribution, and lead source and UTM capture.
5. SMS with consent and opt-out logging.
6. Zapier or webhooks, and QuickBooks export.
7. MFA (better-auth `twoFactor`), and full PII encryption coverage with key IDs.

**Phase 4. SaaS (only if reselling is a goal).** Add an `organization_id` tenant key to every table, scope queries by tenant, store settings and branding per tenant, and add plan billing. Decide this before Phase 3 adds more tables.
