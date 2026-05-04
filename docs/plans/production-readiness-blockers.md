# Production Readiness Blockers

Generated during S38 End-To-End Production Readiness Pass.

## Verification Passed

- `npm run validate` completed successfully: lint, typecheck, full Vitest suite, and production build passed.
- Final full test suite result: 51 test files passed, 1 skipped; 658 tests passed, 27 skipped.
- Production build completed and generated 121 static pages.
- `git diff --check` completed with no whitespace errors.

## Release Blockers

No high or critical dependency advisories remain after the dependency security pass.

## Security Remediation Applied

- Ran `npm audit fix` without `--force`, reducing the audit report from 25 advisories to 8 and clearing all critical advisories.
- Upgraded `drizzle-orm` to `0.45.2`, resolving the SQL identifier escaping advisory.
- Upgraded `eslint` and `eslint-config-next` within the current major lines.
- Added package-manager overrides for vulnerable transitive `brace-expansion` and the old `@esbuild-kit/core-utils` nested `esbuild` dependency.
- Verified `npm audit --audit-level=high` reports only the remaining moderate Next/PostCSS advisory.

## Remaining Moderate Advisory

`npm audit` still reports 2 moderate findings for `next@16.2.4` because Next pins a nested `postcss@8.4.31` below the advisory floor. Npm's suggested forced fix would install `next@9.3.3`, which is not a valid remediation path for this Next.js 16 application.

An attempted nested `postcss` override made `npm ls` report an invalid install tree, so it was not kept. This should be revisited when Next publishes a version that updates its internal PostCSS dependency or npm's advisory metadata recognizes a supported Next.js remediation path.

## Non-Blocking Warnings

- Full test output still includes React `act(...)` warnings in `WorkQueue` tests.
- Full test output still includes mocked `framer-motion` DOM prop warnings in `DisputeWizardProgressBar` tests.
- Build output warns that Next.js inferred `/home/nochaserz/package-lock.json` as workspace root because multiple lockfiles exist.
