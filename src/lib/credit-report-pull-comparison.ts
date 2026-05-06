export interface PullComparisonNegativeItem {
  id: string;
  creditorName: string;
  itemType: string;
  bureau: string | null;
  amount?: number | null;
  status?: string | null;
}

export interface PullComparisonInput {
  olderNegativeItems: PullComparisonNegativeItem[];
  newerNegativeItems: PullComparisonNegativeItem[];
}

export interface ReviewedPullComparisonInput extends PullComparisonInput {
  olderPull: { parserReviewStatus?: string | null };
  newerPull: { parserReviewStatus?: string | null };
}

function itemKey(item: PullComparisonNegativeItem) {
  return [
    item.creditorName.trim().toLowerCase(),
    item.itemType,
    item.bureau || 'unknown',
  ].join('|');
}

function changedFields(older: PullComparisonNegativeItem, newer: PullComparisonNegativeItem) {
  const fields: string[] = [];

  if ((older.amount ?? null) !== (newer.amount ?? null)) fields.push('amount');
  if ((older.status ?? null) !== (newer.status ?? null)) fields.push('status');

  return fields;
}

export function compareCreditReportPulls(input: PullComparisonInput) {
  const newerByKey = new Map(input.newerNegativeItems.map((item) => [itemKey(item), item]));
  const olderByKey = new Map(input.olderNegativeItems.map((item) => [itemKey(item), item]));

  const deleted = [];
  const updated = [];
  const unchanged = [];
  const added = [];

  for (const older of input.olderNegativeItems) {
    const newer = newerByKey.get(itemKey(older));
    if (!newer) {
      deleted.push({ olderId: older.id, creditorName: older.creditorName, itemType: older.itemType, bureau: older.bureau });
      continue;
    }

    const fields = changedFields(older, newer);
    if (fields.length > 0) {
      updated.push({ olderId: older.id, newerId: newer.id, creditorName: older.creditorName, itemType: older.itemType, bureau: older.bureau, changedFields: fields });
    } else {
      unchanged.push({ olderId: older.id, newerId: newer.id, creditorName: older.creditorName, itemType: older.itemType, bureau: older.bureau });
    }
  }

  for (const newer of input.newerNegativeItems) {
    if (!olderByKey.has(itemKey(newer))) {
      added.push({ newerId: newer.id, creditorName: newer.creditorName, itemType: newer.itemType, bureau: newer.bureau });
    }
  }

  return { deleted, updated, unchanged, added };
}

export function compareApprovedCreditReportPulls(input: ReviewedPullComparisonInput) {
  if (input.olderPull.parserReviewStatus !== 'approved' || input.newerPull.parserReviewStatus !== 'approved') {
    return {
      approved: false,
      code: 'CREDIT_REPORT_PULL_REVIEW_REQUIRED',
      comparison: null,
    };
  }

  return {
    approved: true,
    code: null,
    comparison: compareCreditReportPulls(input),
  };
}
