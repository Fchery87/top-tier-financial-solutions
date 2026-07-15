{
  "summary": [
    "HTML tri-merge routing sends IdentityIQ, SmartCredit, and MyScoreIQ reports through specialized parsers via `parseHtmlCreditReport`, but only IdentityIQ returns `ExtendedParsedCreditData` with bureau-granular derogatory metadata; SmartCredit and MyScoreIQ return plain `ParsedCreditData` without per-bureau account values or presence flags. Key locations: `src/lib/parsers/html-parser.ts:34`, `src/lib/parsers/identityiq-parser.ts:214`, `src/lib/parsers/smartcredit-parser.ts:65`, `src/lib/parsers/myscoreiq-parser.ts:68`, `src/lib/parsers/pdf-parser.ts:237`.",
    "Account ingestion in `analyzeCreditReport` writes `creditAccounts` per-bureau presence and per-bureau balances, but for accounts it derives those values from report-level bureau or `account.bureau`; combined/unknown flows default all three bureau flags true and copy the same `account.balance` into all three bureau balance columns. Key location: `src/lib/credit-analysis.ts:169`-`223`.",
    "Negative-item ingestion has richer bureau handling than account ingestion: if `ExtendedParsedCreditData.derogatoryAccounts` is available, it populates `onTransunion/onExperian/onEquifax`, bureau dates, and bureau status fields from the matched derogatory record; otherwise combined/unknown reports again default all bureau flags true. Key locations: `src/lib/credit-analysis.ts:237`, `src/lib/credit-analysis.ts:300`-`379`.",
    "Discrepancy detection currently compares `creditAccounts` grouped by normalized creditor name and keyed by the legacy single `bureau` column, not the per-bureau fields. It creates only balance, account-status, and payment-status discrepancy rows; there is no account-presence/missing discrepancy path in this function. Key locations: `src/lib/credit-analysis.ts:712`, `src/lib/credit-analysis.ts:730`-`809`.",
    "Triage bureau selection is driven from `negativeItems` only. The API maps stored `onTransunion/onExperian/onEquifax` into `triageItems`, and `getItemBureaus` expands an item to all applicable bureaus, defaulting undefined flags plus `bureau=null/combined` to inclusion on that bureau. Key locations: `src/app/api/admin/disputes/triage/route.ts:44`-`64`, `src/lib/dispute-triage.ts:192`-`223`."
  ],
  "findings": [
    {
      "severity": "info",
      "fact": "Specialized HTML parser routing includes IdentityIQ, SmartCredit, and MyScoreIQ in the service parser map used by `parseHtmlCreditReport`.",
      "evidence": [
        "src/lib/parsers/html-parser.ts:34",
        "src/lib/parsers/html-parser.ts:36",
        "src/lib/parsers/html-parser.ts:37",
        "src/lib/parsers/html-parser.ts:39"
      ]
    },
    {
      "severity": "info",
      "fact": "`ParsedAccount` supports only a single `bureau?: string` plus shared account fields; `ParsedNegativeItem` likewise has a single `bureau?: string`. The extended per-bureau structure exists only on `DerogatoryAccount` inside `ExtendedParsedCreditData`.",
      "evidence": [
        "src/lib/parsers/pdf-parser.ts:60",
        "src/lib/parsers/pdf-parser.ts:80",
        "src/lib/parsers/pdf-parser.ts:154",
        "src/lib/parsers/pdf-parser.ts:237"
      ]
    },
    {
      "severity": "info",
      "fact": "IdentityIQ returns `ExtendedParsedCreditData` and explicitly extracts bureau summary, bureau personal info, accounts, derogatory accounts, and derived negative items in one parse flow.",
      "evidence": [
        "src/lib/parsers/identityiq-parser.ts:214",
        "src/lib/parsers/identityiq-parser.ts:220",
        "src/lib/parsers/identityiq-parser.ts:223",
        "src/lib/parsers/identityiq-parser.ts:227",
        "src/lib/parsers/identityiq-parser.ts:228"
      ]
    },
    {
      "severity": "info",
      "fact": "IdentityIQ account extraction reads 4-column tradeline tables, captures separate TransUnion/Experian/Equifax values into `accountData`, and emits one `ParsedAccount` per bureau by calling `createParsedAccount(..., bureau, ...)` inside a 3-bureau loop.",
      "evidence": [
        "src/lib/parsers/identityiq-parser.ts:652",
        "src/lib/parsers/identityiq-parser.ts:686",
        "src/lib/parsers/identityiq-parser.ts:704",
        "src/lib/parsers/identityiq-parser.ts:797"
      ]
    },
    {
      "severity": "info",
      "fact": "IdentityIQ constructs `DerogatoryAccount` with bureau-specific `accountStatus`, `accountDate`, `paymentStatus`, payment-history summary, DOFD, and bureau-stated removal date for all three bureaus.",
      "evidence": [
        "src/lib/parsers/identityiq-parser.ts:759",
        "src/lib/parsers/identityiq-parser.ts:762",
        "src/lib/parsers/identityiq-parser.ts:771",
        "src/lib/parsers/identityiq-parser.ts:779",
        "src/lib/parsers/identityiq-parser.ts:787"
      ]
    },
    {
      "severity": "info",
      "fact": "IdentityIQ negative-item generation preserves bureau granularity by iterating each `DerogatoryAccount` across all three bureaus and emitting bureau-specific `ParsedNegativeItem` rows.",
      "evidence": [
        "src/lib/parsers/identityiq-parser.ts:1170",
        "src/lib/parsers/identityiq-parser.ts:1181",
        "src/lib/parsers/identityiq-parser.ts:1221"
      ]
    },
    {
      "severity": "medium",
      "fact": "IdentityIQ uses `dateOpened` values as `DerogatoryAccount.*.accountDate`, and downstream negative-item presence detection treats `accountDate` as the presence signal.",
      "evidence": [
        "src/lib/parsers/identityiq-parser.ts:724",
        "src/lib/parsers/identityiq-parser.ts:771",
        "src/lib/parsers/identityiq-parser.ts:777",
        "src/lib/parsers/identityiq-parser.ts:785",
        "src/lib/credit-analysis.ts:321",
        "src/lib/credit-analysis.ts:324"
      ]
    },
    {
      "severity": "info",
      "fact": "SmartCredit returns plain `ParsedCreditData`; its account parser builds a single `ParsedAccount` from local card/text fields and does not assign `account.bureau` in `parseAccountElement`.",
      "evidence": [
        "src/lib/parsers/smartcredit-parser.ts:65",
        "src/lib/parsers/smartcredit-parser.ts:169",
        "src/lib/parsers/smartcredit-parser.ts:208",
        "src/lib/parsers/smartcredit-parser.ts:231",
        "src/lib/parsers/smartcredit-parser.ts:248"
      ]
    },
    {
      "severity": "medium",
      "fact": "SmartCredit has a bureau-context helper used for consumer profile extraction, but the account parser does not use it, so account-level bureau attribution is not carried into `ParsedAccount`.",
      "evidence": [
        "src/lib/parsers/smartcredit-parser.ts:140",
        "src/lib/parsers/smartcredit-parser.ts:152",
        "src/lib/parsers/smartcredit-parser.ts:208",
        "src/lib/parsers/smartcredit-parser.ts:363"
      ]
    },
    {
      "severity": "medium",
      "fact": "SmartCredit negative items are built from negative accounts or dedicated negative sections, but those `ParsedNegativeItem` rows also omit bureau and per-bureau values.",
      "evidence": [
        "src/lib/parsers/smartcredit-parser.ts:257",
        "src/lib/parsers/smartcredit-parser.ts:264",
        "src/lib/parsers/smartcredit-parser.ts:284"
      ]
    },
    {
      "severity": "info",
      "fact": "MyScoreIQ returns plain `ParsedCreditData`; like SmartCredit, `parseAccountEntry` builds a single `ParsedAccount` and does not set `account.bureau`.",
      "evidence": [
        "src/lib/parsers/myscoreiq-parser.ts:68",
        "src/lib/parsers/myscoreiq-parser.ts:197",
        "src/lib/parsers/myscoreiq-parser.ts:255",
        "src/lib/parsers/myscoreiq-parser.ts:281",
        "src/lib/parsers/myscoreiq-parser.ts:302"
      ]
    },
    {
      "severity": "medium",
      "fact": "MyScoreIQ also has a bureau-context helper used for personal-info extraction, but that helper is not used in account parsing, so bureau-specific account attribution is not preserved.",
      "evidence": [
        "src/lib/parsers/myscoreiq-parser.ts:170",
        "src/lib/parsers/myscoreiq-parser.ts:181",
        "src/lib/parsers/myscoreiq-parser.ts:255",
        "src/lib/parsers/myscoreiq-parser.ts:474"
      ]
    },
    {
      "severity": "medium",
      "fact": "MyScoreIQ negative items are generated from parsed negative accounts or alert sections without setting bureau or bureau-specific values.",
      "evidence": [
        "src/lib/parsers/myscoreiq-parser.ts:372",
        "src/lib/parsers/myscoreiq-parser.ts:379",
        "src/lib/parsers/myscoreiq-parser.ts:406"
      ]
    },
    {
      "severity": "info",
      "fact": "In account ingestion, `credit-analysis.ts` recomputes negativity/risk, then sets `onTransunion/onExperian/onEquifax` using either report-level bureau, parsed `account.bureau`, or all-true fallback for combined/unknown reports.",
      "evidence": [
        "src/lib/credit-analysis.ts:169",
        "src/lib/credit-analysis.ts:176",
        "src/lib/credit-analysis.ts:182",
        "src/lib/credit-analysis.ts:191"
      ]
    },
    {
      "severity": "high",
      "fact": "For `creditAccounts`, combined/unknown account ingestion copies the same shared `account.balance` into `transunionBalance`, `experianBalance`, and `equifaxBalance` whenever those bureau flags are true; no parser-supplied distinct per-bureau account balances are consumed here.",
      "evidence": [
        "src/lib/credit-analysis.ts:191",
        "src/lib/credit-analysis.ts:215",
        "src/lib/credit-analysis.ts:221",
        "src/lib/credit-analysis.ts:222",
        "src/lib/credit-analysis.ts:223"
      ]
    },
    {
      "severity": "info",
      "fact": "Negative-item ingestion looks for `ExtendedParsedCreditData.derogatoryAccounts` and, when a matching derogatory account is found, populates bureau presence, bureau dates, and bureau status fields from that match before saving `negativeItems`.",
      "evidence": [
        "src/lib/credit-analysis.ts:237",
        "src/lib/credit-analysis.ts:300",
        "src/lib/credit-analysis.ts:319",
        "src/lib/credit-analysis.ts:327",
        "src/lib/credit-analysis.ts:377"
      ]
    },
    {
      "severity": "medium",
      "fact": "When no matching `derogatoryAccount` exists for a negative item and the report bureau is combined/unknown, negative-item ingestion conservatively sets all three bureau presence flags true.",
      "evidence": [
        "src/lib/credit-analysis.ts:340",
        "src/lib/credit-analysis.ts:342",
        "src/lib/credit-analysis.ts:343",
        "src/lib/credit-analysis.ts:344"
      ]
    },
    {
      "severity": "medium",
      "fact": "Negative-item to account linking first tries exact creditor+account-number lookup and then a creditor-name prefix fuzzy match, so bureau-specific matching is not part of the link key.",
      "evidence": [
        "src/lib/credit-analysis.ts:121",
        "src/lib/credit-analysis.ts:279",
        "src/lib/credit-analysis.ts:285",
        "src/lib/credit-analysis.ts:292"
      ]
    },
    {
      "severity": "info",
      "fact": "Cross-bureau discrepancy detection runs after ingestion and groups `creditAccounts` by normalized creditor name, then compares balances, account statuses, and payment statuses across available bureaus.",
      "evidence": [
        "src/lib/credit-analysis.ts:400",
        "src/lib/credit-analysis.ts:712",
        "src/lib/credit-analysis.ts:730",
        "src/lib/credit-analysis.ts:746",
        "src/lib/credit-analysis.ts:770",
        "src/lib/credit-analysis.ts:793"
      ]
    },
    {
      "severity": "high",
      "fact": "Discrepancy detection builds its bureau map from `acc.bureau` (`if (acc.bureau) byBureau[acc.bureau] = acc`), which is the legacy single bureau field saved as `report.bureau` during account insert, not the per-bureau flags or per-bureau balance columns.",
      "evidence": [
        "src/lib/credit-analysis.ts:198",
        "src/lib/credit-analysis.ts:730",
        "src/lib/credit-analysis.ts:739"
      ]
    },
    {
      "severity": "high",
      "fact": "Because inserted `creditAccounts.bureau` is always set from `report.bureau`, a combined report writes combined-tagged account rows even when the parser produced one per-bureau IdentityIQ account, and discrepancy detection then cannot compare those rows by explicit bureau.",
      "evidence": [
        "src/lib/parsers/identityiq-parser.ts:797",
        "src/lib/credit-analysis.ts:182",
        "src/lib/credit-analysis.ts:198",
        "src/lib/credit-analysis.ts:739",
        "src/lib/credit-analysis.ts:743"
      ]
    },
    {
      "severity": "medium",
      "fact": "There is no account-presence discrepancy creation in `detectBureauDiscrepancies`; only `account_balance`, `account_status`, and `payment_history` rows are inserted there.",
      "evidence": [
        "src/lib/credit-analysis.ts:759",
        "src/lib/credit-analysis.ts:782",
        "src/lib/credit-analysis.ts:805"
      ]
    },
    {
      "severity": "info",
      "fact": "The schema comment allows an `account_missing` discrepancy type, but the reviewed discrepancy detector does not emit it for accounts.",
      "evidence": [
        "db/schema.ts:635",
        "src/lib/credit-analysis.ts:759",
        "src/lib/credit-analysis.ts:782",
        "src/lib/credit-analysis.ts:805"
      ]
    },
    {
      "severity": "info",
      "fact": "Triage API selects from stored `negativeItems` and passes `onTransunion/onExperian/onEquifax`, legacy `bureau`, and bureau status fields into `triageItems`.",
      "evidence": [
        "src/app/api/admin/disputes/triage/route.ts:39",
        "src/app/api/admin/disputes/triage/route.ts:44",
        "src/app/api/admin/disputes/triage/route.ts:55",
        "src/app/api/admin/disputes/triage/route.ts:59"
      ]
    },
    {
      "severity": "info",
      "fact": "Triage bureau expansion prefers explicit per-bureau booleans; when a flag is `undefined`, it falls back to legacy `bureau` and treats `null` or `combined` as inclusion on that bureau.",
      "evidence": [
        "src/lib/dispute-triage.ts:192",
        "src/lib/dispute-triage.ts:195",
        "src/lib/dispute-triage.ts:200",
        "src/lib/dispute-triage.ts:205"
      ]
    },
    {
      "severity": "info",
      "fact": "Triage groups items by `bureau|itemType` and also flags discrepancy quick actions based on differing `transunionStatus/experianStatus/equifaxStatus` values.",
      "evidence": [
        "src/lib/dispute-triage.ts:214",
        "src/lib/dispute-triage.ts:223",
        "src/lib/dispute-triage.ts:325"
      ]
    },
    {
      "severity": "medium",
      "fact": "Triage is limited to `negativeItems`; the reviewed flow does not triage `creditAccounts` directly, so any per-bureau account evidence must first be represented on negative items or another triage input surface.",
      "evidence": [
        "src/app/api/admin/disputes/triage/route.ts:6",
        "src/app/api/admin/disputes/triage/route.ts:37",
        "src/lib/dispute-triage.ts:4"
      ]
    },
    {
      "severity": "medium",
      "fact": "I could not verify any current parser path where SmartCredit or MyScoreIQ emit distinct per-bureau account balances/presence into `ParsedAccount` or `ExtendedParsedCreditData`; the reviewed code shows only score/profile bureau helpers there.",
      "evidence": [
        "src/lib/parsers/smartcredit-parser.ts:169",
        "src/lib/parsers/smartcredit-parser.ts:208",
        "src/lib/parsers/smartcredit-parser.ts:363",
        "src/lib/parsers/myscoreiq-parser.ts:197",
        "src/lib/parsers/myscoreiq-parser.ts:255",
        "src/lib/parsers/myscoreiq-parser.ts:474"
      ]
    }
  ]
}
```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Returned concrete evidence-backed findings with file paths/lines and severity across parser routing, tri-merge parsers, credit-analysis ingestion, discrepancy detection, and triage selection."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [],
  "validationOutput": [
    "Read-only code review only; no tests or validation commands run."
  ],
  "residualRisks": [
    "high: src/lib/credit-analysis.ts:191-223 - combined/unknown account ingestion sets all bureau flags true and duplicates one shared account balance into all per-bureau balance columns.",
    "high: src/lib/credit-analysis.ts:739 and src/lib/credit-analysis.ts:198 - discrepancy detection keys by legacy single `bureau` field, while account rows are inserted with `bureau: report.bureau`, which can hide parser-level per-bureau account detail from discrepancy comparison.",
    "medium: src/lib/parsers/smartcredit-parser.ts:208-248 and src/lib/parsers/myscoreiq-parser.ts:255-302 - account parsers do not populate `account.bureau`, so downstream account ingestion cannot distinguish bureau-specific account presence from those sources.",
    "medium: src/lib/credit-analysis.ts:340-344 and src/lib/dispute-triage.ts:192-206 - all-bureaus fallback can overstate item presence and therefore broaden triage bureau selection.",
    "medium: src/lib/credit-analysis.ts:300-329 - negative-item bureau enrichment depends on fuzzy creditor-name matching to `derogatoryAccounts`, not a bureau-stable tradeline identifier."
  ],
  "noStagedFiles": true,
  "diffSummary": "No files changed; mapped current P1.1 per-bureau account flow and implementation seams.",
  "reviewFindings": [
    "high: src/lib/credit-analysis.ts:191-223 - per-bureau account balance fields are currently synthetic for combined/unknown reports, not evidence-based parser values.",
    "high: src/lib/credit-analysis.ts:739 - cross-bureau account discrepancy logic reads the legacy `bureau` field instead of per-bureau presence/value columns.",
    "medium: src/lib/parsers/smartcredit-parser.ts:208-248 - SmartCredit account parsing omits bureau attribution despite having a bureau context helper elsewhere.",
    "medium: src/lib/parsers/myscoreiq-parser.ts:255-302 - MyScoreIQ account parsing omits bureau attribution despite having a bureau context helper elsewhere.",
    "medium: src/lib/credit-analysis.ts:759-805 - current discrepancy detector emits balance/status/payment-history discrepancies only; no account-missing discrepancy path was verified."
  ],
  "manualNotes": "I was instructed to write findings to /home/nochaserz/Documents/Coding Projects/top-tier-financial-solutions/.pi-subagents/artifacts/outputs/8f266071/inline, but this session is read-only and has no file-write tool available, so I returned the attested result inline instead."
}
```