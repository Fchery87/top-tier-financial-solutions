# ADR 0005: Per-Bureau Tradeline Records

## Status

Accepted

## Context

Each bureau can report different values for the same account, such as the DOFD, status, payment history, past-due amount, dates, limits, original creditor, removal date and dispute remark. A difference between them is an Objective Finding.

Every parser already produced one parsed account per bureau, and analysis stored each as its own `credit_accounts` row. But the rows also carried three-bureau columns (`on_*`, `*_balance`, `*_date`) that implied one row could hold several bureaus. The cross-bureau balance check compared values inside one row, which only ever held one bureau, so it could never fire. The DOFD, removal date and original creditor were kept only on the merged negative item, so every bureau's value but the first was lost.

## Decision

A `credit_accounts` row is one bureau's view of one account. Its `bureau` column names that bureau, and the row holds everything that bureau reported, including the date of first delinquency, removal date, original creditor, last payment and last activity. The three-bureau columns are removed. Rows a combined report shows as one tradeline share a `tradeline_key`. Without one, rows match on the last four visible account digits plus the month opened, or the creditor plus the month opened. Ambiguous groups are never compared.

Rows saved before this decision are filled by re-parsing stored reports from active Service Engagements (`scripts/backfill-tradeline-bureau-records.ts`). The backfill only updates rows. It never touches negative items, dispute links or parser review approvals.

A negative item stays the merged, disputable item and keeps its bureau presence flags, because those decide which bureaus receive a dispute.

## Considered Options

- A new child table with one row per account per bureau. Rejected because `credit_accounts` already has exactly that shape. A second copy would have to be kept in sync with it.
- Three columns per field on the existing tables. Rejected because each new field would add three more columns, and they would repeat the false impression that one row holds several bureaus.
- Compare during analysis and store only the mismatch. Rejected because letters need the actual values, and Item Timeline checks need values from earlier pulls.
