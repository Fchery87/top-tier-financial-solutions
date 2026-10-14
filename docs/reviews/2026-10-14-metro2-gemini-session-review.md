# Review of the Gemini "Metro 2 Credit Dispute Guide" session

Source: Gemini share `https://share.gemini.google/Atkk2baYeVp9`, a session from October 12, 2026. This review checks that session against the statutes and against this codebase. It says which parts the dispute engine should adopt and which it should reject.

Legal points here are research notes. Have counsel confirm them before you change client-facing policy.

## Adopt (already encoded, or encoded in this change)

- **Specific findings beat generic demands.** A dispute that names the reported value and why it is wrong is harder to dismiss as frivolous under FCRA § 611(a)(3). The default reason text now requests a reinvestigation instead of "demanding documented verification", and the prompts require one stated problem per disputed detail.
- **Dispute through the bureaus first.** The furnisher's § 623(b) duty (15 U.S.C. § 1681s-2(b)) is triggered only by notice from a bureau, and § 623(a) gives consumers no private right of action. The engine's round 1 already targets the bureaus.
- **Method of verification.** The right comes from § 611(a)(7). The bureau must describe its procedure within 15 days of a request, including the business name, address, and telephone number of any furnisher contacted. § 611(a)(6)(B)(iii) is only the notice that the right exists. Round 2 now cites (a)(7).
- **DOFD and re-aging.** For collections and charge-offs, the 7-year period starts 180 days after the delinquency began (§ 605(c), 15 U.S.C. § 1681c(c)). Furnishers must report the DOFD (§ 623(a)(5)). The clock now applies the 180 days, and the Metro 2 payload always carries the reported DOFD so the model can check for re-aging.
- **Cross-bureau contradictions.** Different DOFDs or balances for the same account on different bureaus are strong factual disputes, because at most one of them can be right. `credit-analysis-discrepancies.ts` detects balance differences. Nothing compares DOFDs across bureaus yet. `negative-item-detectors.ts` checks re-aging only against the same bureau's payment grid. See open decision 3.
- **Medical debt in the tri-state area.** NY has banned bureaus from reporting medical debt since December 13, 2023 ([NY AG](https://ag.ny.gov/resources/individuals/health-care-insurance/Reporting-medical-debt)). CT P.A. 24-6 has barred providers and collectors from reporting medical debt since July 1, 2024 ([CT Mirror](https://ctmirror.org/2024/05/17/ct-medical-debt-reporting-bill/)). NJ's Louisa Carman Medical Debt Relief Act (A3861, July 22, 2024) bars most reporting and bars bureaus from including paid medical debt or medical debt under $500 ([NJ Governor](https://www.nj.gov/governor/news/news/562024/20240722a.shtml)). Debt charged to a general-purpose credit card is excluded in all three states.

## Reject

| Session claim | Why it is wrong | Effect if adopted |
| --- | --- | --- |
| Cite Metro 2 field numbers in letters | The session numbers the same field differently in its own answers. Account Status is Field 17A in one answer and Field 16 in another, and its mock letter cites "Field 8 & Field 10" for account type, where Field 10 is Date Opened. Consumer disclosures do not show field numbers. | A wrong field number makes the letter look generated and gives the bureau an easy reason to dismiss it. The prompts already forbid field numbers. Keep that rule. |
| A debt buyer reporting "Open" or Account Type `0C` is an unlawful classification | In Metro 2, collection and debt-buyer tradelines use Portfolio Type `O`, and `0C` is the debt purchaser account type. | The flagship argument in the mock letter would be factually false. |
| Status `62` means paid charge-off | `62` is paid collection. Paid charge-off is `64`. | Wrong code in the letter. |
| CCC `XC` means an FDCPA dispute and `XD` means closed at consumer request | `XB` covers disputes under the FCRA, and collectors use it for FDCPA disputes too. `XC` means an FCRA dispute was investigated and the consumer disagrees. `XD` means closed at consumer request and in dispute. | Wrong code in the letter. |
| Disputing with the furnisher first "eliminates" § 623(b) claims | A direct dispute does not trigger § 623(b), but a later bureau dispute still does. Nothing is lost. | Mostly harmless. The bureau-first order is right for other reasons. |
| Round 2 should go straight to the furnisher under 12 CFR § 1022.43 | 12 CFR § 1022.43(b)(2) and 15 U.S.C. § 1681s-2(a)(8)(G) let a furnisher ignore a direct dispute that a credit repair organization submitted, prepared, or supplied the form for. | Letters this firm prepares carry no duty to investigate when sent to the furnisher. See the open decision below. |
| Freeze LexisNexis and SageStream so bureaus cannot auto-verify | Bureaus verify tradelines by routing the dispute to the furnisher through e-OSCAR. They do not check secondary bureaus. | Wasted client effort. A freeze is still worth placing for identity theft. |
| Vary fonts so the bureau's scanner cannot tell it is a template | The real issue is identical substance. A bureau may treat letters it reasonably believes come from a third party differently. | Formatting tricks do not fix generic content. Specific, client-confirmed facts do. |
| Demand the name of the individual who verified the account, or the "underlying ledger" | § 611(a)(7) requires the business name, address, and phone number of the furnisher, not an individual. No FCRA provision makes a bureau produce documents. | Overreaching demands read like a template mill. The prompts now forbid document demands to bureaus. |
| A validation letter under FDCPA § 1692g(b) forces the collector to stop all credit reporting | § 1692g(b) pauses collection until the debt is verified. Under 12 CFR § 1006.30(a), a collector may not furnish information before contacting the consumer. Once it has, it may keep reporting, but it must report the debt as disputed (§ 1692e(8)). | The overstatement would be a false claim in a letter. |
| NY S03072 statewide employer credit-check ban (April 2026) and a new CDIA `DS` special comment code | Neither could be verified for this review. New York City has banned most employer credit checks since 2015. | Do not repeat these until a primary source confirms them. |

## Gaps the session missed

- **Credit repair organization rules.** Besides the direct-dispute carve-out, CROA (15 U.S.C. § 1679b(a)(1)) bars a credit repair organization from making, or advising a consumer to make, untrue or misleading statements to a bureau. The high-risk claim gate (`high-risk-claim-registry.ts`), which requires the client to confirm "not mine", "never late", and identity-theft claims, is what keeps the firm inside this rule.
- **Second and Third Circuit accuracy law.** NY and CT courts follow the Second Circuit, and NJ courts follow the Third. *Sessa v. Trans Union* (2d Cir. 2023) and *Mader v. Experian* (2d Cir. 2023) require an inaccuracy that is objectively and readily verifiable, and bureaus need not resolve legal disputes such as whether a debt was discharged. *Seamans v. Temple University* (3d Cir. 2014) treats reporting that is technically accurate but misleading, including a missing dispute flag, as inaccurate. A Metro 2 deviation is evidence of inaccuracy, not inaccuracy in itself.
- **Identity theft block.** Under § 605B (15 U.S.C. § 1681c-2), a bureau must block identity-theft items within four business days of receiving an identity theft report. That path is faster than a dispute when the client has a real FTC report.
- **Reinsertion notice.** If a deleted item comes back, § 611(a)(5)(B) requires written notice within five business days of the reinsertion.

## Decisions (resolved October 14, 2026)

The terms below are defined in `CONTEXT.md`.

1. **Round 3 no longer goes to the furnisher.** It is a New-Evidence Bureau Dispute when the item has a New Fact, and a Regulator Complaint when it does not. See ADR 0004.
2. **Medical Debt State Rules** cover NY, NJ and CT exactly, cite the state statutes, and carry a "not yet counsel-reviewed" note. The state is the Client's current residence. The other five vague state entries are removed. National limits are framed as Bureau Reporting Policy.
3. **Cross-bureau comparison covers every field each bureau reports**, not only the DOFD. Each bureau's tradeline becomes its own record (ADR 0005). Single-tradeline checks and Item Timeline checks (DOFD drift, Reinsertion, changes after a Verified response) are added too. Findings are split into objective and interpretive. Items whose findings are all interpretive are held for staff review.
