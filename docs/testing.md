# Testing

`npm run test:fast` is the local feedback lane. It runs the full non-serial Vitest corpus in two deterministic shards with the repository's normal four-worker policy. It prints each shard before it runs and exits at the first failure; it does not retry failed tests.

`npm run test` remains the required pre-merge and release gate. It runs the same two non-serial shards, then these serial suites:

- `src/__tests__/api/admin/dispute-submission-tracking.test.ts` — the existing test command runs this route-level test separately. It dynamically imports the full dispute route and declares a 30-second timeout for each case. Remove the exception after it has demonstrated reliable execution in the normal four-worker shards.
- `src/components/workspace/__tests__/AdminAnalyticsPanel.test.tsx` — the existing test command runs this jsdom component test separately. It uses sequential, global `fetch` stubbing for two dashboard endpoints. Remove the exception after it has demonstrated reliable execution in the normal four-worker shards.

Do not add exclusions merely to make the fast lane green. Every exception must name one file, state its current constraint, and define a condition for removing it.
