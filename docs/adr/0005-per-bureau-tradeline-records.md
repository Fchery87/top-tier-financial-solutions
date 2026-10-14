# ADR 0005: Per-Bureau Tradeline Records

## Status

Accepted

## Context

Each bureau can report different values for the same account: the DOFD, status, payment history, past-due amount, dates, limits, original creditor, removal date and dispute remark. A difference between them is an Objective Finding. Before this decision, `credit_accounts` and `negative_items` held one value per field plus a few per-bureau columns (presence, date, balance, status). The save step also discarded every bureau's DOFD and removal date except the first one parsed, so cross-bureau checks had nothing to compare.

## Decision

Each bureau's view of a tradeline is stored as its own record, one row per account per bureau, holding everything that bureau reported. The existing per-bureau columns are moved into these records and removed in the same change. Stored report files from active Service Engagements are re-parsed to backfill the records, without changing existing negative items or parser review approvals.

## Considered Options

- Add three columns per field (one per bureau) to the existing tables. Rejected because it means about 30 new columns on each table, and each new field to compare would add three more.
- Compare during analysis and store only the mismatch. Rejected because letters need the actual values, and comparing across the Item Timeline needs the values from earlier pulls.
