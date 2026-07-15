status: success
summary: Added per-bureau tradeline evidence to shared parser types, taught the IdentityIQ parser to attach bureau-scoped evidence to emitted accounts, and refactored credit-account ingest to use parser evidence for combined/tri-merge reports instead of blindly marking accounts present on all bureaus. Added targeted tests for IdentityIQ bureau evidence emission and ingest fallback/usage behavior. Verified with targeted vitest, full typecheck, and eslint on touched files.

findings:
- changed-files:
  - src/lib/parsers/pdf-parser.ts
  - src/lib/parsers/identityiq-parser.ts
  - src/lib/credit-account-bureau-presence.ts
  - src/lib/credit-analysis.ts
  - src/lib/parsers/__tests__/identityiq-parser.test.ts
  - src/lib/__tests__/credit-analysis-account-presence.test.ts
- notable-changes:
  - Extended ParsedAccount with bureauEvidence and added ParsedAccountBureau / ParsedAccountBureauEvidence shared types.
  - IdentityIQ now emits bureauEvidence for each bureau-specific ParsedAccount using existing tri-merge table extraction, preserving parsed values like masked account number, type, status, balance, limit, and opened date.
  - Introduced src/lib/credit-account-bureau-presence.ts to centralize account presence resolution.
  - credit-analysis ingest now prefers parser-provided bureauEvidence for onTransunion/onExperian/onEquifax and bureau dates/balances; legacy fallback behavior remains when evidence is absent.
- verification:
  - npx vitest run src/lib/parsers/__tests__/identityiq-parser.test.ts src/lib/__tests__/credit-analysis-account-presence.test.ts -> passed (4 tests)
  - npm run typecheck -> passed
  - npx eslint src/lib/parsers/pdf-parser.ts src/lib/parsers/identityiq-parser.ts src/lib/credit-account-bureau-presence.ts src/lib/credit-analysis.ts src/lib/parsers/__tests__/identityiq-parser.test.ts src/lib/__tests__/credit-analysis-account-presence.test.ts -> passed (only Browserslist age warning)
  - git diff --cached --name-only -> no staged files
- remains-for-p1.1:
  - Propagate equivalent bureauEvidence emission to other tri-merge parsers/providers (SmartCredit/MyScoreIQ) once Phase 1.1 expands beyond IdentityIQ.
  - Consider whether negative-item ingest should also be migrated from derogatory-account heuristics toward account-level bureauEvidence where possible for consistency.
  - Add broader integration coverage around analyzeCreditReport DB inserts if a safe database-mocked seam is introduced.
- residual-risks:
  - IdentityIQ date parsing still relies on JS Date for MM/DD/YYYY and therefore reflects local-time offset in ISO assertions; current tests lock observed behavior but not timezone-normalized semantics.
  - Combined reports from providers that do not emit bureauEvidence still use legacy all-bureaus fallback until their parsers are upgraded.
- review-findings:
  - no blockers in implemented slice