{
  "summary": [
    "HTML tri-merge parsing is routed through `parseHtmlCreditReport()`, which source-detects and dispatches to `parseIdentityIQReport`, `parseSmartCreditReport`, or `parseMyScoreIQReport` when confidence is not low. `src/lib/parsers/html-parser.ts:34`, `src/lib/parsers/html-parser.ts:55`, `src/lib/parsers/html-parser.ts:62`",
    "IdentityIQ is the only tri-merge parser in this slice that produces bureau-explicit tradelines and extended bureau metadata: it returns `ExtendedParsedCreditData`, extracts one `ParsedAccount` per bureau from a 4-column account table, builds `DerogatoryAccount` objects with per-bureau status/date/payment-history, and emits negative items tagged with a specific bureau. `src/lib/parsers/identityiq-parser.ts:214`, `src/lib/parsers/identityiq-parser.ts:223`, `src/lib/parsers/identityiq-parser.ts:652`, `src/lib/parsers/identityiq-parser.ts:762`, `src/lib/parsers/identityiq-parser.ts:797`, `src/lib/parsers/identityiq-parser.ts:1170`, `src/lib/parsers/identityiq-parser.ts:1217`",
    "SmartCredit and MyScoreIQ parse accounts and negatives without setting per-account or per-negative-item bureau fields in the returned objects, although they do infer bureau for some consumer-profile fields. As a result, ingestion later falls back to report-level or 'all bureaus' assumptions for those sources. `src/lib/parsers/smartcredit-parser.ts:140`, `src/lib/parsers/smartcredit-parser.ts:152`, `src/lib/parsers/smartcredit-parser.ts:237`, `src/lib/parsers/smartcredit-parser.ts:263`, `src/lib/parsers/smartcredit-parser.ts:363`, `src/lib/parsers/myscoreiq-parser.ts:170`, `src/lib/parsers/myscoreiq-parser.ts:181`, `src/lib/parsers/myscoreiq-parser.ts:279`, `src/lib/parsers/myscoreiq-parser.ts:378`, `src/lib/parsers/myscoreiq-parser.ts:474`",
    "Account ingestion in `analyzeCreditReport()` persists bureau-presence flags and per-bureau balances on `credit_accounts`, but it populates those values from one flat `ParsedAccount` at insert time. If the report bureau is specific, only that bureau is marked present; if `account.bureau` is present, only that bureau is used; otherwise all three bureau flags and all three bureau balances are set to the same account values. `src/lib/credit-analysis.ts:61`, `src/lib/credit-analysis.ts:126`, `src/lib/credit-analysis.ts:166`, `src/lib/credit-analysis.ts:173`, `src/lib/credit-analysis.ts:178`, `src/lib/credit-analysis.ts:190`, `src/lib/credit-analysis.ts:215`, `src/lib/credit-analysis.ts:221`, `db/schema.ts:500`, `db/schema.ts:518`, `db/schema.ts:524`",
    "Negative-item ingestion has a richer per-bureau path than account ingestion: when parsed data is extended and a `DerogatoryAccount` fuzzy-matches by creditor, the code derives bureau presence plus bureau-specific dates and statuses from `derogatoryMatch`; otherwise it falls back to report-level or all-bureaus assumptions. `src/lib/credit-analysis.ts:236`, `src/lib/credit-analysis.ts:276`, `src/lib/credit-analysis.ts:301`, `src/lib/credit-analysis.ts:319`, `src/lib/credit-analysis.ts:321`, `src/lib/credit-analysis.ts:327`, `src/lib/credit-analysis.ts:330`, `src/lib/credit-analysis.ts:339`, `src/lib/credit-analysis.ts:342`, `src/lib/credit-analysis.ts:362`, `db/schema.ts:539`, `db/schema.ts:554`, `db/schema.ts:560`",
    "Current discrepancy detection for accounts does not use the new per-bureau columns; it re-groups `credit_accounts` by normalized creditor name and then compares rows by the legacy single `bureau` column. It creates `account_balance`, `account_status`, and `payment_history` discrepancies, but no `account_missing` discrepancy is currently detected in this function even though the schema/API vocabulary includes it. `src/lib/credit-analysis.ts:712`, `src/lib/credit-analysis.ts:743`, `src/lib/credit-analysis.ts:745`, `src/lib/credit-analysis.ts:759`, `src/lib/credit-analysis.ts:782`, `src/lib/credit-analysis.ts:805`, `db/schema.ts:632`, `db/schema.ts:635`, `src/app/api/admin/disputes/discrepancies/route.ts:83`",
    "Triage bureau selection operates on `negative_items`, not `credit_accounts`: the admin triage API maps DB fields into `NegativeItemForTriage`, `getItemBureaus()` selects bureaus from `onTransunion/onExperian/onEquifax` with a legacy fallback when those flags are undefined, and triage priority/quick-actions detect discrepancies solely from per-bureau status differences. There is no account-balance-based triage signal here. `src/app/api/admin/disputes/triage/route.ts:41`, `src/app/api/admin/disputes/triage/route.ts:52`, `src/app/api/admin/disputes/triage/route.ts:64`, `src/lib/dispute-triage.ts:5`, `src/lib/dispute-triage.ts:172`, `src/lib/dispute-triage.ts:176`, `src/lib/dispute-triage.ts:192`, `src/lib/dispute-triage.ts:214`, `src/lib/dispute-triage.ts:223`, `src/lib/dispute-triage.ts:325`, `src/lib/dispute-triage.ts:331`"
  ],
  "findings": [
    {
      "severity": "info",
      "fact": "The HTML parser is the entry point for these tri-merge sources and routes by detected service to specialized parsers, including IdentityIQ, SmartCredit, and MyScoreIQ.",
      "evidence": [
        "src/lib/parsers/html-parser.ts:34",
        "src/lib/parsers/html-parser.ts:36",
        "src/lib/parsers/html-parser.ts:37",
        "src/lib/parsers/html-parser.ts:39",
        "src/lib/parsers/html-parser.ts:55",
        "src/lib/parsers/html-parser.ts:57",
        "src/lib/parsers/html-parser.ts:62",
        "src/lib/parsers/html-parser.ts:65"
      ]
    },
    {
      "severity": "info",
      "fact": "The shared parser contract already has storage shapes for account-level per-bureau balances (`credit_accounts.transunionBalance/experianBalance/equifaxBalance`) and item-level per-bureau status/presence (`negative_items.on*`, `transunionStatus/experianStatus/equifaxStatus`).",
      "evidence": [
        "db/schema.ts:500",
        "db/schema.ts:518",
        "db/schema.ts:524",
        "db/schema.ts:539",
        "db/schema.ts:554",
        "db/schema.ts:560"
      ]
    },
    {
      "severity": "info",
      "fact": "The parsed account type is flat: `ParsedAccount` has a single `balance`, a single `dateReported`, and an optional single `bureau`; there is no parser-level account shape for per-bureau balances or per-bureau presence flags.",
      "evidence": [
        "src/lib/parsers/pdf-parser.ts:52",
        "src/lib/parsers/pdf-parser.ts:57",
        "src/lib/parsers/pdf-parser.ts:62",
        "src/lib/parsers/pdf-parser.ts:65"
      ]
    },
    {
      "severity": "info",
      "fact": "IdentityIQ returns extended parsed data and captures tri-merge-specific derogatory detail through `derogatoryAccounts` and other bureau-level structures.",
      "evidence": [
        "src/lib/parsers/identityiq-parser.ts:214",
        "src/lib/parsers/identityiq-parser.ts:223",
        "src/lib/parsers/pdf-parser.ts:136",
        "src/lib/parsers/pdf-parser.ts:206"
      ]
    },
    {
      "severity": "info",
      "fact": "IdentityIQ account extraction reads a 4-column tradeline table into `accountData.transunion/experian/equifax`, then emits one `ParsedAccount` for each bureau that has data.",
      "evidence": [
        "src/lib/parsers/identityiq-parser.ts:652",
        "src/lib/parsers/identityiq-parser.ts:687",
        "src/lib/parsers/identityiq-parser.ts:710",
        "src/lib/parsers/identityiq-parser.ts:797",
        "src/lib/parsers/identityiq-parser.ts:800"
      ]
    },
    {
      "severity": "medium",
      "fact": "IdentityIQ suppresses duplicate tradeline extraction by creditor name alone via `processedCreditors`, so multiple same-creditor tradelines in a report can collapse before bureau/account-specific handling begins.",
      "evidence": [
        "src/lib/parsers/identityiq-parser.ts:658",
        "src/lib/parsers/identityiq-parser.ts:683",
        "src/lib/parsers/identityiq-parser.ts:684"
      ]
    },
    {
      "severity": "info",
      "fact": "IdentityIQ extracts per-bureau payment-history summaries and uses them when deciding whether an account is derogatory and when building per-bureau derogatory metadata.",
      "evidence": [
        "src/lib/parsers/identityiq-parser.ts:141",
        "src/lib/parsers/identityiq-parser.ts:756",
        "src/lib/parsers/identityiq-parser.ts:759",
        "src/lib/parsers/identityiq-parser.ts:762"
      ]
    },
    {
      "severity": "info",
      "fact": "IdentityIQ negative items are created per bureau from `derogatoryAccounts`, with dedup keyed by creditor+bureau+itemType, and additional account-derived negative items use `account.bureau` in their dedup key.",
      "evidence": [
        "src/lib/parsers/identityiq-parser.ts:1170",
        "src/lib/parsers/identityiq-parser.ts:1181",
        "src/lib/parsers/identityiq-parser.ts:1202",
        "src/lib/parsers/identityiq-parser.ts:1217",
        "src/lib/parsers/identityiq-parser.ts:1249",
        "src/lib/parsers/identityiq-parser.ts:1254",
        "src/lib/parsers/identityiq-parser.ts:1260"
      ]
    },
    {
      "severity": "info",
      "fact": "SmartCredit account parsing builds flat `ParsedAccount` objects without assigning `bureau`, even though bureau context helpers exist and are used for consumer-profile extraction.",
      "evidence": [
        "src/lib/parsers/smartcredit-parser.ts:140",
        "src/lib/parsers/smartcredit-parser.ts:152",
        "src/lib/parsers/smartcredit-parser.ts:208",
        "src/lib/parsers/smartcredit-parser.ts:237",
        "src/lib/parsers/smartcredit-parser.ts:363"
      ]
    },
    {
      "severity": "medium",
      "fact": "SmartCredit negative items are emitted without bureau tags or per-bureau values; they inherit only creditor/amount/date/risk at parse time.",
      "evidence": [
        "src/lib/parsers/smartcredit-parser.ts:257",
        "src/lib/parsers/smartcredit-parser.ts:263",
        "src/lib/parsers/smartcredit-parser.ts:286"
      ]
    },
    {
      "severity": "info",
      "fact": "MyScoreIQ follows the same flat-account pattern: account parsers create `ParsedAccount` values without setting `bureau`, while bureau context is used only in personal-info extraction.",
      "evidence": [
        "src/lib/parsers/myscoreiq-parser.ts:170",
        "src/lib/parsers/myscoreiq-parser.ts:181",
        "src/lib/parsers/myscoreiq-parser.ts:255",
        "src/lib/parsers/myscoreiq-parser.ts:279",
        "src/lib/parsers/myscoreiq-parser.ts:299",
        "src/lib/parsers/myscoreiq-parser.ts:324",
        "src/lib/parsers/myscoreiq-parser.ts:353",
        "src/lib/parsers/myscoreiq-parser.ts:474"
      ]
    },
    {
      "severity": "medium",
      "fact": "MyScoreIQ negative items are also emitted without bureau tags or per-bureau values; they carry item type, creditor, amount, date, removal date, and severity only.",
      "evidence": [
        "src/lib/parsers/myscoreiq-parser.ts:372",
        "src/lib/parsers/myscoreiq-parser.ts:378",
        "src/lib/parsers/myscoreiq-parser.ts:402"
      ]
    },
    {
      "severity": "info",
      "fact": "Account ingestion persists per-bureau flags and balances on every `credit_accounts` insert.",
      "evidence": [
        "src/lib/credit-analysis.ts:126",
        "src/lib/credit-analysis.ts:215",
        "src/lib/credit-analysis.ts:221"
      ]
    },
    {
      "severity": "high",
      "fact": "When a parsed account lacks a specific bureau, account ingestion marks all three account presence flags true and copies the same flat `account.balance` into all three bureau balance columns.",
      "evidence": [
        "src/lib/credit-analysis.ts:178",
        "src/lib/credit-analysis.ts:184",
        "src/lib/credit-analysis.ts:190",
        "src/lib/credit-analysis.ts:215",
        "src/lib/credit-analysis.ts:221"
      ]
    },
    {
      "severity": "medium",
      "fact": "The comment in account ingestion says combined-report account presence 'will be refined by derogatory match if available', but the account insertion path shown does not perform any derogatory-match refinement before insert; that richer match exists only in the negative-item path.",
      "evidence": [
        "src/lib/credit-analysis.ts:190",
        "src/lib/credit-analysis.ts:236",
        "src/lib/credit-analysis.ts:301",
        "src/lib/credit-analysis.ts:319"
      ]
    },
    {
      "severity": "info",
      "fact": "Negative-item ingestion does use `ExtendedParsedCreditData.derogatoryAccounts` to infer bureau-specific presence, dates, and statuses after fuzzy creditor-name matching.",
      "evidence": [
        "src/lib/credit-analysis.ts:236",
        "src/lib/credit-analysis.ts:301",
        "src/lib/credit-analysis.ts:319",
        "src/lib/credit-analysis.ts:321",
        "src/lib/credit-analysis.ts:327"
      ]
    },
    {
      "severity": "medium",
      "fact": "The derogatory-account match is creditor-name fuzzy matching only; it normalizes names and accepts exact, contains, or contained-by matches, with no account-number check.",
      "evidence": [
        "src/lib/credit-analysis.ts:40",
        "src/lib/credit-analysis.ts:44",
        "src/lib/credit-analysis.ts:46"
      ]
    },
    {
      "severity": "high",
      "fact": "If no `derogatoryMatch` is found for a negative item and the report is not bureau-specific, ingestion conservatively marks the item present on all three bureaus.",
      "evidence": [
        "src/lib/credit-analysis.ts:330",
        "src/lib/credit-analysis.ts:339",
        "src/lib/credit-analysis.ts:342"
      ]
    },
    {
      "severity": "info",
      "fact": "Cross-bureau discrepancy detection starts by deleting existing discrepancies for the client, grouping `credit_accounts` by normalized creditor name, and comparing only rows addressable through the legacy `acc.bureau` field.",
      "evidence": [
        "src/lib/credit-analysis.ts:712",
        "src/lib/credit-analysis.ts:725",
        "src/lib/credit-analysis.ts:730",
        "src/lib/credit-analysis.ts:743",
        "src/lib/credit-analysis.ts:745"
      ]
    },
    {
      "severity": "high",
      "fact": "The discrepancy detector does not read `onTransunion/onExperian/onEquifax` or `transunionBalance/experianBalance/equifaxBalance` from `credit_accounts`; it compares `balance`, `accountStatus`, and `paymentStatus` across separate account rows indexed by `bureau`.",
      "evidence": [
        "src/lib/credit-analysis.ts:743",
        "src/lib/credit-analysis.ts:745",
        "src/lib/credit-analysis.ts:753",
        "src/lib/credit-analysis.ts:776",
        "src/lib/credit-analysis.ts:799",
        "db/schema.ts:518",
        "db/schema.ts:524"
      ]
    },
    {
      "severity": "medium",
      "fact": "Although the schema and discrepancy API recognize `account_missing`, the implemented detector in `credit-analysis.ts` currently inserts only `account_balance`, `account_status`, `payment_history`, plus PII discrepancies.",
      "evidence": [
        "db/schema.ts:635",
        "src/lib/credit-analysis.ts:759",
        "src/lib/credit-analysis.ts:782",
        "src/lib/credit-analysis.ts:805",
        "src/lib/credit-analysis.ts:883",
        "src/lib/credit-analysis.ts:929",
        "src/app/api/admin/disputes/discrepancies/route.ts:101"
      ]
    },
    {
      "severity": "info",
      "fact": "The triage API sources its bureau selection inputs from `negative_items` DB rows and passes per-bureau presence/status into `triageItems()`.",
      "evidence": [
        "src/app/api/admin/disputes/triage/route.ts:41",
        "src/app/api/admin/disputes/triage/route.ts:52",
        "src/app/api/admin/disputes/triage/route.ts:55",
        "src/app/api/admin/disputes/triage/route.ts:59",
        "src/app/api/admin/disputes/triage/route.ts:64"
      ]
    },
    {
      "severity": "info",
      "fact": "Triage bureau selection uses `getItemBureaus()`: explicit `on* === true` controls inclusion, while undefined flags fall back to the legacy `bureau` value or 'combined' semantics.",
      "evidence": [
        "src/lib/dispute-triage.ts:192",
        "src/lib/dispute-triage.ts:195",
        "src/lib/dispute-triage.ts:196",
        "src/lib/dispute-triage.ts:200",
        "src/lib/dispute-triage.ts:204",
        "src/lib/dispute-triage.ts:205"
      ]
    },
    {
      "severity": "medium",
      "fact": "Triage discrepancy logic is status-only: high priority and the 'Items with Bureau Discrepancies' quick action both look for differing `transunionStatus/experianStatus/equifaxStatus`, not differing balances or bureau presence.",
      "evidence": [
        "src/lib/dispute-triage.ts:172",
        "src/lib/dispute-triage.ts:176",
        "src/lib/dispute-triage.ts:325",
        "src/lib/dispute-triage.ts:331"
      ]
    },
    {
      "severity": "info",
      "fact": "The discrepancy API maps `account_balance`, `account_status`, `payment_history`, `date_mismatch`, `account_missing`, and PII discrepancy types to UI-facing legal basis and reason codes.",
      "evidence": [
        "src/app/api/admin/disputes/discrepancies/route.ts:83",
        "src/app/api/admin/disputes/discrepancies/route.ts:85",
        "src/app/api/admin/disputes/discrepancies/route.ts:88",
        "src/app/api/admin/disputes/discrepancies/route.ts:92",
        "src/app/api/admin/disputes/discrepancies/route.ts:97",
        "src/app/api/admin/disputes/discrepancies/route.ts:101"
      ]
    },
    {
      "severity": "info",
      "fact": "Unresolved gap: with the available read-only pass, I verified no account-level per-bureau parser shape beyond IdentityIQ's internal `accountData`/`DerogatoryAccount`; I did not find a separate shared account-evidence abstraction already in use by SmartCredit or MyScoreIQ.",
      "evidence": [
        "src/lib/parsers/pdf-parser.ts:52",
        "src/lib/parsers/smartcredit-parser.ts:237",
        "src/lib/parsers/myscoreiq-parser.ts:279",
        "src/lib/parsers/identityiq-parser.ts:687"
      ]
    }
  ],
  "gaps": [
    "I could not write to `/home/nochaserz/Documents/Coding Projects/top-tier-financial-solutions/.pi-subagents/artifacts/outputs/51c0eb9f/inline` because this run exposed only read/search tools.",
    "I did not execute parsing against sample reports, so all findings are static-code observations only."
  ]
}
```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Returned concrete code-map findings with file paths, line references, and severity annotations across parser routing, tri-merge parser behavior, account ingestion, discrepancy detection, and triage bureau selection."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "repository search/read via find/grep/read tools",
      "result": "passed",
      "summary": "Reviewed relevant parser, ingestion, schema, discrepancy, and triage files in read-only mode."
    }
  ],
  "validationOutput": [
    "Static code review only; no runtime validation performed.",
    "Unable to write the requested artifact file because this subagent run had no file-write capability."
  ],
  "residualRisks": [
    "Account-level per-bureau values are persisted in schema, but current ingestion copies one flat account balance/date across all selected bureaus when parser output lacks bureau-specific account data.",
    "Current account discrepancy detection still compares legacy per-row `bureau` values instead of reading account-level `on*` and per-bureau balance columns.",
    "SmartCredit and MyScoreIQ currently do not return bureau-tagged accounts or bureau-tagged negative items, forcing downstream fallback assumptions.",
    "Negative-item bureau enrichment depends on fuzzy creditor-name matching against `derogatoryAccounts`, without account-number verification.",
    "Triage discrepancy prioritization is based on per-bureau status differences only, not account balance differences or missing-presence signals."
  ],
  "noStagedFiles": true,
  "diffSummary": "No files changed; read-only code mapping only.",
  "reviewFindings": [
    "high: src/lib/credit-analysis.ts:190 - combined/unknown-bureau account ingestion marks all three bureaus present and duplicates the same flat account values into all bureau balance/date columns.",
    "high: src/lib/credit-analysis.ts:745 - discrepancy detection groups/comparisons rely on legacy `acc.bureau` rows instead of the newer per-bureau account columns.",
    "high: src/lib/credit-analysis.ts:342 - combined/unknown-bureau negative items without a derogatory match are marked present on all three bureaus.",
    "medium: src/lib/parsers/identityiq-parser.ts:683 - IdentityIQ account extraction deduplicates by creditor name before tradeline emission, which can collapse multiple same-creditor accounts.",
    "medium: src/lib/parsers/smartcredit-parser.ts:237 - SmartCredit accounts are parsed without setting `ParsedAccount.bureau` despite having bureau-context helpers elsewhere.",
    "medium: src/lib/parsers/myscoreiq-parser.ts:279 - MyScoreIQ accounts are parsed without setting `ParsedAccount.bureau` despite having bureau-context helpers elsewhere.",
    "medium: src/lib/credit-analysis.ts:46 - derogatory-match enrichment is creditor-name fuzzy matching only."
  ],
  "manualNotes": "Read-only constraint prevented writing to the required output path; findings are returned inline instead."
}
```