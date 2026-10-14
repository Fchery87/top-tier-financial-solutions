# ADR 0004: No Default Direct Disputes to Furnishers

## Status

Accepted

## Context

The third Dispute Cycle used to send a Direct Dispute to the furnisher under FCRA § 623(a)(8). But 12 CFR § 1022.43(b)(2) and 15 U.S.C. § 1681s-2(a)(8)(G) let a furnisher ignore any direct dispute that a credit repair organization submitted, prepared, or supplied the form for. Every letter this business prepares falls under that exemption, so the third cycle carried no duty to investigate while the letter claimed it did.

## Decision

The Dispute Cycle never sends a Direct Dispute by default. When an item is still Verified after the method-of-verification cycle, the next step is a New-Evidence Bureau Dispute if the item has a New Fact, and a Regulator Complaint if it does not. A Bureau Dispute is the only dispute we prepare that triggers the furnisher's § 623(b) duty.

Staff may still send a Direct Dispute manually. It must not cite § 623(a)(8) or claim the furnisher has to investigate.

## Considered Options

- Keep the furnisher letter as a low-cost nudge. Rejected because it spends a cycle on a letter the furnisher may lawfully ignore.
- Have the client write and send their own direct dispute. Rejected because any drafting help from us brings back the exemption, and coaching the client on content risks CROA § 1679b(a)(1).

## Consequences

- Someone will propose "write to the creditor directly" again. This ADR is the answer unless the client writes the letter entirely on their own.
- A repeat bureau dispute needs a New Fact. That makes cross-bureau detection, single-tradeline detection and Item Timeline detection the main source of escalation material.
