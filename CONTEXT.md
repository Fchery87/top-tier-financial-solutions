# Top Tier Financial Solutions Context

## Glossary

### Client Lifecycle

The canonical lifecycle for a credit repair client from first contact through closure.

Stages:

1. Lead
2. Consultation Scheduled
3. Qualified
4. Agreement Sent
5. Agreement Signed
6. Cancellation Window
7. Onboarding Documents Required
8. Ready for First Work
9. Active Dispute Cycle
10. Awaiting Bureau/Furnisher Response
11. Results Review
12. Next Round or Completed
13. Maintenance/Monitoring
14. Closed

Use this lifecycle as the backbone for onboarding, compliance gates, portal progress, staff work queues, and operational analytics.

### Ready for First Work

The first lifecycle stage where credit repair service work may begin.

A client reaches Ready for First Work only after all required service-start conditions are satisfied:

1. Service agreement signed
2. Required CROA disclosures acknowledged
3. Cancellation window completed, unless an explicitly approved lawful exception applies
4. Required identity and proof-of-address documents uploaded
5. Credit report access consent captured
6. First-work checklist completed

Before this stage, the system must not allow dispute preparation, bureau/furnisher/collector contact, or billable service work.

### Services Rendered

A completed, concrete credit repair service event that can support compliant invoicing.

Examples include credit report imported and reviewed, first dispute package prepared, dispute package mailed, bureau/furnisher/collector response reviewed, or progress report prepared.

Billing must be tied to Services Rendered rather than signup, elapsed time, or unsupported promises. The system should only allow an invoice to become payable after at least one qualifying Services Rendered event has been recorded.

Internal dispute strategy preparation and draft letter generation during the Cancellation Window do not count as Services Rendered. They become billable only when tied to allowed post-window external execution or another qualifying service event.

### First Dispute Package Submitted

The first qualifying billable credit repair service event.

First Dispute Package Submitted means an approved dispute package was mailed or submitted to at least one bureau, furnisher, collector, creditor, or regulator after the Cancellation Window rules allow external execution, and Submission Tracking was recorded.

### Credit Audit Engagement

A separate Service Engagement for paid credit audit or credit analysis work.

Credit report import and review are not billable as part of the Credit Restoration engagement before First Dispute Package Submitted. They may be billable only when sold as a separate Credit Audit Engagement with its own agreement, fee terms, and service scope.

In v1, paid Credit Audit Engagements use the same conservative agreement, disclosure, and Cancellation Window pattern as Credit Restoration engagements.

A Credit Audit Engagement may lead to a Credit Restoration offer. If the Client proceeds, create a new Credit Restoration Service Engagement with its own agreement, Cancellation Window, Compliance Gate, and billing rules. Do not mutate the completed audit engagement into credit restoration.

Credit Audit Engagement reports require Report Release Approval before they are made visible to the Client.

### Results-Verified Billing Lock

An additional billing restriction for result-based or telemarketing-related credit repair billing.

When this lock applies, the system must prevent result-based fees until the promised result has been verified by the required supporting credit report timing and documentation. This lock is stricter than Services Rendered and should override ordinary invoice readiness.

### Dispute Cycle

One coordinated round of dispute work for a client.

A Dispute Cycle includes item selection, policy approval, evidence attachment, letter generation, client approval, mailing or submission, response deadline tracking, bureau/furnisher/collector response capture, outcome recording, and the next-cycle decision.

Use Dispute Cycle as the canonical term. A round is only the cycle number within a client's dispute history.

### Standing Dispute Authorization

Permission granted in the service agreement for specialists to proceed with ordinary credit restoration dispute work without requiring per-letter client approval.

Standing Dispute Authorization covers ordinary factual, Metro 2, and verification-based disputes.

It does not cover high-risk factual claims that require explicit client confirmation, such as not-mine claims, identity theft, fraud, never-late claims, unauthorized inquiries, sworn statements, or any claim requiring a police report, FTC report, or similarly specific evidence.

High-risk factual claims must be confirmed by the client before they are used in a dispute letter or submission.

### Lead

A pre-client sales opportunity.

A Lead represents someone who has shown interest, submitted a form, scheduled a consultation, or otherwise entered the sales pipeline before becoming a service client.

Free consultations and free lead-magnet credit audits remain in the Lead or consultation flow. They do not require a full Service Engagement unless the person buys a paid Credit Audit Engagement or Credit Restoration Engagement, or the result must be delivered through the Client Collaboration Workspace.

### User

An authenticated login identity.

A User controls access to the application and portal. A User is not automatically a Client.

### Client

The person receiving credit restoration services through a service relationship with the business.

A Client may exist without a linked User during staff-managed onboarding. Portal access requires linking the Client to exactly one User.

### Client Collaboration Workspace

The client portal experience for participating in the credit restoration process.

Clients can view progress, upload required documents, message the team, manage notification preferences, review educational resources, see next actions, and submit explicit confirmations for high-risk factual claims.

Clients should not directly edit dispute strategy, change operational statuses, alter dispute cycle decisions, or override compliance gates.

### Client Progress Snapshot

The computed source of truth for a client's current progress.

A Client Progress Snapshot is derived from lifecycle stage, open client-visible tasks, document checklist completion, active Dispute Cycle status, latest credit score history, recent dispute outcomes, and unresolved compliance gates.

Progress should be computed from operational records rather than manually maintained as freeform status text.

### Evidence Packet

The set of documents and client confirmations attached to a dispute claim.

Ordinary verification disputes may use default identity and proof-of-address documents. High-risk factual claims require claim-specific evidence before the system allows letter generation or submission.

Evidence should be organized around the claim or dispute it supports, not stored only as loose client documents.

### Letter Renderer

The AI-assisted drafting role for dispute letters.

A Letter Renderer turns approved dispute strategy inputs into polished letter language. It must not decide eligibility, choose reason codes, determine required evidence, classify claim risk, select target recipients, choose escalation paths, invent facts, or upgrade claims.

Deterministic application code must make policy decisions before any Letter Renderer is invoked.

### Response Review

The required review step after a bureau, furnisher, collector, or creditor response is received.

During Response Review, staff records the response, classifies the outcome, attaches the response document, updates score or report changes when applicable, and lets the system compute the next decision.

Possible next decisions include closing the item, updating the item, escalating to the next Dispute Cycle, requesting method of verification, sending a furnisher dispute, or marking the item as not worth further action.

Every response must go through Response Review before a next Dispute Cycle is created.

### Submission Tracking

The record of how a dispute letter or package was sent to a bureau, furnisher, collector, creditor, or regulator.

Submission Tracking includes submission method, mailing or submission date, certified/tracking number when available, recipient, expected response deadline, proof document, delivery status, and response status.

Submission Tracking is core to the workflow even before an external print/mail provider is integrated.

### Credit Report Pull

A credit report import for a client at a specific point in time.

A client can have many Credit Report Pulls over time. The system should compare pulls to detect deleted items, updated statuses, new negative items, score changes, new inquiries, bureau discrepancies, and progress report changes.

Credit Report Pull is the canonical term. Report comparison is required for the product, not an optional analytics layer.

### Work Item

A structured unit of staff work generated by the system or created manually.

A Work Item can be tied to lifecycle gates, missing documents, Dispute Cycles, Response Review, billing readiness, client messages, SLA breaches, or other operational events.

Generic tasks can still exist, but the core workflow should generate structured Work Items from system events.

### Service Engagement

A specific service relationship between the business and a Client.

A Client can have one or more Service Engagements. The initial Service Engagement is Credit Restoration. Future engagements may include credit coaching, business funding preparation, tradeline education, monitoring, or other services.

Dispute Cycles, billing, compliance gates, Work Items, and progress should attach to a Service Engagement rather than being overloaded onto the Client identity itself.

A Client may have multiple Service Engagements, but only one active engagement per service type. For example, a Client should not have two active Credit Restoration engagements unless one is closed or superseded.

### Operator Analytics

Internal analytics for business operations and staff workflow.

Operator Analytics includes throughput, SLA breaches, import success, response aging, staff workload, billing readiness, dispute cycle volume, and other operational health metrics.

### Client Outcome Analytics

Analytics describing client-visible outcomes and progress.

Client Outcome Analytics includes score movement, deletions, updates, verified outcomes, new negative items, progress by bureau, and client-visible milestones.

Keep Operator Analytics separate from Client Outcome Analytics so internal performance management does not get mixed with client-facing outcome claims.

### Score Projection

An estimate of possible score movement based on hypothetical or modeled changes.

Score Projections should not be shown to clients by default. Client-facing progress should prioritize verified historical changes and educational scenarios.

If Score Projections are used, they must be labeled as estimates, remain internal by default, include disclaimer text, and never be presented as guaranteed outcomes.

### Communication Channel Strategy

The product is web/email-first in the near term.

The client portal must be mobile-responsive and support notification preferences. SMS should be added later only after consent tracking, opt-out handling, message templates, and compliance logging are in place.

Native mobile apps should be deferred until the portal workflow is strong.

### Affiliate and Referral Tracking

Affiliate and referral tracking is deferred from the core near-term product scope.

The core workflow priorities are compliance gates, secure documents, portal collaboration, deterministic dispute policy, Credit Report Pull comparison, and analytics. Affiliate and referral tracking should be reconsidered after the core operating workflow is reliable.

### Business Branding

Basic business branding is in near-term scope.

The system should support company name, address, phone, email, logo, and portal accent colors for letters, reports, and the client portal.

Full white-label SaaS features are deferred, including custom domains, multi-tenant branding, reseller accounts, and white-label administration controls.

### Payment Collection

Invoice tracking, Services Rendered records, payment status, and payment audit logs are in near-term scope.

Live payment processor charging is deferred until Compliance Gate and Results-Verified Billing Lock enforcement are implemented. Payment automation must not be able to charge clients before billing compliance conditions are satisfied.

### Credit Report Parsing

Credit report parsing is deterministic-first with AI assistance.

For supported provider formats, deterministic parsers are the source of truth. AI may assist with unknown formats, dirty inputs, confidence scoring, and anomaly detection.

Extracted facts must be reviewable and auditable before they drive dispute strategy, Evidence Packets, Client Outcome Analytics, or client-facing reports.

### Report Release Approval

Staff approval required before a generated report is made visible to a client.

Audit reports, progress reports, and credit analysis reports require Report Release Approval when they contain recommendations, outcomes, deleted-item claims, score movement, or other client-facing conclusions.

Internal draft reports may be generated automatically, but client-facing reports must be approved before release.

### Deletion

An outcome where a disputed item is no longer reporting on a bureau.

### Update

An outcome where a disputed item remains reporting but one or more fields changed.

### Verified

An outcome where a bureau, furnisher, collector, or creditor confirms the disputed information.

### Improvement

A broader client-facing outcome that may include Deletions, Updates, score increases, reduced balances, resolved tasks, or other verified progress.

Do not merge Deletion, Update, Verified, and Improvement into one generic success metric.

### Closed

A neutral lifecycle state meaning the Service Engagement is no longer active.

Closed does not imply successful completion. Closure reasons carry the meaning and may include completed, cancelled by client, nonresponsive, nonpayment, out of scope, referred out, duplicate, or administratively closed.

## Implementation Direction

### First Milestone

Build the Compliance Gate and Service Engagement foundation first.

This milestone should align lifecycle and Service Engagement concepts, enforce Ready for First Work, block billable service before allowed conditions, and make compliance blockers visible in the admin dashboard and Client Collaboration Workspace.

This foundation unlocks safe billing, portal progress, Dispute Cycles, Work Items, and analytics.

### Schema Evolution Approach

Adapt the current schema incrementally instead of redesigning it from scratch.

The existing schema already contains useful foundations for clients, agreements, disclosure acknowledgments, invoices, payment audit logs, tasks, disputes, credit reports, and portal records.

Add missing domain glue first, especially Service Engagements, Compliance Gate checks, and structured Services Rendered events. Migrate existing concepts toward the canonical model over time.

The first schema addition should include a minimal `service_engagements` table with client, service type, status, lifecycle stage, opened date, closed date, closure reason, and timestamps. Agreements, invoices, Dispute Cycles, Work Items, and progress snapshots should attach to Service Engagements over time.

Existing client status and stage fields may remain temporarily for compatibility. The Service Engagement lifecycle stage is the new source of truth for service workflow progress. Over time, client status should describe only the person or account relationship, not the service lifecycle.

## Compliance Gate

The Compliance Gate is the required set of checks before a Service Engagement can reach Ready for First Work.

Required checks:

1. Client identity exists and is linked to the correct Service Engagement.
2. Service agreement is signed.
3. CROA disclosure statement is separately acknowledged.
4. Notice of cancellation is delivered.
5. Cancellation deadline is calculated and not expired incorrectly.
6. Cancellation window is completed before external service execution, billing, or charging begins.
7. Required identity document is uploaded.
8. Required proof of address is uploaded.
9. Credit report access or import consent is captured.
10. Fee terms are disclosed.
11. No upfront payment has been collected.
12. Staff has marked onboarding review complete.

During the Cancellation Window, specialists may perform administrative onboarding, prepare internal dispute strategy, and draft dispute letters.

During the Cancellation Window, specialists must not contact bureaus, furnishers, collectors, or creditors; submit or mail disputes; mark Services Rendered; create payable invoices; or charge the Client.
