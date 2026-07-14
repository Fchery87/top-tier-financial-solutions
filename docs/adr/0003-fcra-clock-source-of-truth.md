# ADR 0003: FCRA Clock Source-of-Truth Hierarchy

## Status
Accepted

## Context

The credit analysis pipeline previously treated `dateReported` as a proxy for Date of First Delinquency. That pushed FCRA expiration dates years into the future on refreshed tradelines and also leaked the same bad assumption into LLM dispute payloads.

Different report sources expose different levels of evidence:
- Some sources print an explicit bureau removal date
- Some expose DOFD directly
- Some only expose last activity
- Some expose only report date

Those sources are not equally trustworthy.

## Decision

The system will use this hierarchy for FCRA obsolescence calculations:

1. `bureauStatedRemovalDate`
2. `dateOfFirstDelinquency`
3. `dateOfLastActivity`
4. `dateReported`

Implementation rules:
- Shared logic lives in `src/lib/fcra-clock.ts`
- `fcra_compliance_items.dofd_confidence` stores the source used for the clock
- When the best available source is `dateReported`, the item may still be estimated as expired, but the system must not label it as an `FCRA VIOLATION` automatically
- LLM payloads must never label `dateReported` as DOFD

## Consequences

Positive:
- Obsolescence findings are materially more accurate
- Bureau-printed removal dates override weaker inferred clocks
- Downstream systems can distinguish strong evidence from weak proxies

Trade-offs:
- More parser work is required to harvest stronger dates from report sources
- Some items remain low-confidence until better source data is available
