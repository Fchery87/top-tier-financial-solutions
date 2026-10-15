import { tradelineMatchKey, type SpecificBureau } from '@/lib/tradeline-matching';

/** One Credit Report Pull, and the bureaus it shows. */
export interface TimelinePull {
  id: string;
  /** 'transunion' | 'experian' | 'equifax' for a single-bureau pull, anything else for a combined one. */
  bureau: string | null;
  pulledAt: Date;
}

/** One bureau's view of one account in one pull. */
export interface TimelineRow {
  id: string;
  creditReportId: string;
  bureau: string | null;
  creditorName: string;
  accountNumber: string | null;
  dateOpened: Date | null;
  dateOfFirstDelinquency: Date | null;
  balance: number | null;
  pastDueAmount: number | null;
  accountStatus: string | null;
  paymentStatus: string | null;
  remarks: string | null;
}

/** A dispute outcome on the account behind a stored row. */
export interface TimelineDispute {
  creditAccountId: string;
  bureau: string;
  outcome: string | null;
  responseReceivedAt: Date | null;
  /** True when a later dispute on the same item shows the client still disputes it. */
  stillDisputed: boolean;
}

export type TimelineFindingKind = 'reaged' | 'reinserted' | 'changed_after_verification' | 'missing_dispute_flag';

export interface TimelineFinding {
  kind: TimelineFindingKind;
  tier: 'objective' | 'interpretive';
  bureau: SpecificBureau;
  creditorName: string;
  /** Every stored row of this bureau's tradeline, in pull order. */
  accountIds: string[];
  text: string;
}

const SPECIFIC_BUREAUS: SpecificBureau[] = ['transunion', 'experian', 'equifax'];
const BUREAU_NAMES: Record<SpecificBureau, string> = { transunion: 'TransUnion', experian: 'Experian', equifax: 'Equifax' };

function covers(pull: TimelinePull, bureau: SpecificBureau): boolean {
  return !pull.bureau || !SPECIFIC_BUREAUS.includes(pull.bureau as SpecificBureau) || pull.bureau === bureau;
}

function monthOf(date: Date | null): number | null {
  return date && !Number.isNaN(date.getTime()) ? date.getUTCFullYear() * 12 + date.getUTCMonth() : null;
}

function display(date: Date): string {
  return `${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`;
}

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

interface Track {
  bureau: SpecificBureau;
  /** One entry per pull that covers this bureau, oldest first; null when the account was absent. */
  entries: Array<{ pull: TimelinePull; row: TimelineRow | null }>;
}

/** Follows each bureau's tradeline across every pull, keeping the pulls where it was missing. */
function buildTracks(pulls: TimelinePull[], rows: TimelineRow[]): Track[] {
  const ordered = [...pulls].sort((a, b) => a.pulledAt.getTime() - b.pulledAt.getTime());
  const byKey = new Map<string, { bureau: SpecificBureau; rows: Map<string, TimelineRow> }>();
  for (const row of rows) {
    if (!row.bureau || !SPECIFIC_BUREAUS.includes(row.bureau as SpecificBureau)) continue;
    // Across pulls the report's own grouping no longer applies, so only the digits or creditor match.
    const key = tradelineMatchKey({ ...row, tradelineKey: null });
    if (!key) continue;
    const trackKey = `${row.bureau}|${key}`;
    const track = byKey.get(trackKey) ?? { bureau: row.bureau as SpecificBureau, rows: new Map() };
    if (track.rows.has(row.creditReportId)) continue;
    track.rows.set(row.creditReportId, row);
    byKey.set(trackKey, track);
  }

  return [...byKey.values()].map(({ bureau, rows: rowsByPull }) => ({
    bureau,
    entries: ordered.filter(pull => covers(pull, bureau)).map(pull => ({ pull, row: rowsByPull.get(pull.id) ?? null })),
  }));
}

function present(track: Track) {
  return track.entries.filter((entry): entry is { pull: TimelinePull; row: TimelineRow } => entry.row !== null);
}

function reagingFinding(track: Track): TimelineFinding | null {
  const seen = present(track).filter(entry => monthOf(entry.row.dateOfFirstDelinquency) !== null);
  for (let later = 1; later < seen.length; later += 1) {
    const earliest = seen.slice(0, later).reduce((min, entry) => monthOf(entry.row.dateOfFirstDelinquency)! < monthOf(min.row.dateOfFirstDelinquency)! ? entry : min);
    const current = seen[later];
    if (monthOf(current.row.dateOfFirstDelinquency)! > monthOf(earliest.row.dateOfFirstDelinquency)!) {
      return {
        kind: 'reaged',
        tier: 'objective',
        bureau: track.bureau,
        creditorName: present(track)[0].row.creditorName,
        accountIds: present(track).map(entry => entry.row.id),
        text: `In my credit report from ${display(earliest.pull.pulledAt)} you reported the date of first delinquency for this account as ${display(earliest.row.dateOfFirstDelinquency!)}. You now report it as ${display(current.row.dateOfFirstDelinquency!)}. The date a delinquency began cannot move later, so the account has been re-aged.`,
      };
    }
  }
  return null;
}

function reinsertionFinding(track: Track): TimelineFinding | null {
  let seenPresent = false;
  let gap: TimelinePull | null = null;
  for (const entry of track.entries) {
    if (entry.row && gap) {
      return {
        kind: 'reinserted',
        tier: 'objective',
        bureau: track.bureau,
        creditorName: present(track)[0].row.creditorName,
        accountIds: present(track).map(item => item.row.id),
        text: `This account did not appear in my credit report from ${display(gap.pulledAt)} and has since reappeared. Under FCRA Section 611(a)(5)(B), information that was deleted may be reinserted only after the furnisher certifies that it is complete and accurate, and you must notify me in writing within five business days. Please provide the furnisher's certification and a copy of the reinsertion notice.`,
      };
    }
    if (entry.row) seenPresent = true;
    else if (seenPresent && !gap) gap = entry.pull;
  }
  return null;
}

function statusOf(row: TimelineRow): string {
  return `${row.accountStatus ?? ''}/${row.paymentStatus ?? ''}`;
}

function changedAfterVerification(track: Track, disputes: TimelineDispute[]): TimelineFinding[] {
  const rows = present(track);
  const ids = rows.map(entry => entry.row.id);
  return disputes
    .filter(dispute => dispute.bureau === track.bureau && dispute.outcome === 'verified' && dispute.responseReceivedAt && ids.includes(dispute.creditAccountId))
    .flatMap(dispute => {
      const respondedAt = dispute.responseReceivedAt!.getTime();
      const before = [...rows].reverse().find(entry => entry.pull.pulledAt.getTime() <= respondedAt);
      const after = rows.find(entry => entry.pull.pulledAt.getTime() > respondedAt);
      if (!before || !after) return [];

      const changes: string[] = [];
      if (before.row.balance !== null && after.row.balance !== null && before.row.balance !== after.row.balance) changes.push(`the balance from ${money(before.row.balance)} to ${money(after.row.balance)}`);
      if (before.row.pastDueAmount !== null && after.row.pastDueAmount !== null && before.row.pastDueAmount !== after.row.pastDueAmount) changes.push(`the past-due amount from ${money(before.row.pastDueAmount)} to ${money(after.row.pastDueAmount)}`);
      if (statusOf(before.row) !== statusOf(after.row) && before.row.accountStatus && after.row.accountStatus) changes.push(`the status from "${before.row.accountStatus}" to "${after.row.accountStatus}"`);
      const beforeDofd = monthOf(before.row.dateOfFirstDelinquency);
      const afterDofd = monthOf(after.row.dateOfFirstDelinquency);
      if (beforeDofd !== null && afterDofd !== null && beforeDofd !== afterDofd) changes.push(`the date of first delinquency from ${display(before.row.dateOfFirstDelinquency!)} to ${display(after.row.dateOfFirstDelinquency!)}`);
      const disputedFlag = /disput/i;
      const missingFlag = dispute.stillDisputed && !disputedFlag.test(after.row.remarks ?? '');

      const findings: TimelineFinding[] = [];
      if (changes.length > 0) {
        findings.push({
          kind: 'changed_after_verification',
          tier: 'objective',
          bureau: track.bureau,
          creditorName: rows[0].row.creditorName,
          accountIds: ids,
          text: `You told me this account was verified as accurate on ${display(dispute.responseReceivedAt!)}, but you have since changed ${changes.join(', ')}. The information you verified was not accurate.`,
        });
      }
      if (missingFlag) {
        findings.push({
          kind: 'missing_dispute_flag',
          tier: 'interpretive',
          bureau: track.bureau,
          creditorName: rows[0].row.creditorName,
          accountIds: ids,
          text: `I continue to dispute this account after your ${display(dispute.responseReceivedAt!)} response, but it is not reported as disputed by me. Reporting a disputed account without that notation is misleading.`,
        });
      }
      return findings;
    });
}

/** Every Item Timeline finding across all of a Service Engagement's pulls. */
export function findTimelineFindings(input: { pulls: TimelinePull[]; rows: TimelineRow[]; disputes: TimelineDispute[] }): TimelineFinding[] {
  return buildTracks(input.pulls, input.rows).flatMap(track => [
    reagingFinding(track),
    reinsertionFinding(track),
    ...changedAfterVerification(track, input.disputes),
  ].filter((item): item is TimelineFinding => item !== null));
}

export function bureauName(bureau: SpecificBureau): string {
  return BUREAU_NAMES[bureau];
}
