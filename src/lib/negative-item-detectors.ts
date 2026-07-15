export interface DetectedReagingItem {
  itemId: string;
  creditorName: string;
  bureau: string | null;
  firstLateDate: string | null;
  reportedDofd: string | null;
  monthsDifference: number;
}

export interface DetectedDuplicateLiability {
  creditorGroup: string;
  itemIds: string[];
  creditorNames: string[];
  bureaus: string[];
}

export interface DetectorInputItem {
  id: string;
  creditorName: string;
  originalCreditor?: string | null;
  accountNumber?: string | null;
  itemType: string;
  bureau?: string | null;
  dateOfFirstDelinquency?: Date | string | null;
  paymentHistoryGrid?: Record<string, string> | null;
}

function normalize(value: string | null | undefined): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseMonthIndex(label: string): number | null {
  const match = label.match(/(\d{4})[-/](\d{1,2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!year || !month) return null;
  return year * 12 + (month - 1);
}

function formatMonthIndex(index: number): string {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function getFirstLateMonthIndex(grid?: Record<string, string> | null): number | null {
  if (!grid) return null;

  const lateMonths = Object.entries(grid)
    .filter(([, code]) => {
      const normalized = String(code).toUpperCase();
      return ['30', '60', '90', '120', '150', '180', 'CO', 'COL', 'L', 'G'].includes(normalized);
    })
    .map(([label]) => parseMonthIndex(label))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  return lateMonths[0] ?? null;
}

export function detectReaging(items: DetectorInputItem[]): DetectedReagingItem[] {
  return items.flatMap((item) => {
    const gridIndex = getFirstLateMonthIndex(item.paymentHistoryGrid);
    const dofd = item.dateOfFirstDelinquency ? new Date(item.dateOfFirstDelinquency) : null;
    if (gridIndex === null || !dofd || Number.isNaN(dofd.getTime())) return [];

    const dofdIndex = dofd.getUTCFullYear() * 12 + dofd.getUTCMonth();
    if (dofdIndex <= gridIndex) return [];

    return [{
      itemId: item.id,
      creditorName: item.creditorName,
      bureau: item.bureau || null,
      firstLateDate: formatMonthIndex(gridIndex),
      reportedDofd: dofd.toISOString(),
      monthsDifference: dofdIndex - gridIndex,
    }];
  });
}

export function detectDuplicateLiability(items: DetectorInputItem[]): DetectedDuplicateLiability[] {
  const groups = new Map<string, DetectorInputItem[]>();

  for (const item of items) {
    const creditorGroup = normalize(item.originalCreditor) || normalize(item.creditorName);
    if (!creditorGroup) continue;

    const last4 = item.accountNumber ? item.accountNumber.slice(-4) : '';
    const key = `${creditorGroup}|${normalize(last4)}`;
    const current = groups.get(key) || [];
    current.push(item);
    groups.set(key, current);
  }

  const duplicates: DetectedDuplicateLiability[] = [];
  for (const [key, group] of groups.entries()) {
    if (group.length < 2) continue;

    duplicates.push({
      creditorGroup: key,
      itemIds: group.map((item) => item.id),
      creditorNames: [...new Set(group.map((item) => item.creditorName))],
      bureaus: [...new Set(group.map((item) => item.bureau || 'combined'))],
    });
  }

  return duplicates;
}

export function hasDuplicateLiability(items: DetectorInputItem[]): boolean {
  return detectDuplicateLiability(items).length > 0;
}
