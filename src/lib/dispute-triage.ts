// Dispute Triage System - Auto-grouping and strategy recommendation

import { getObsolescenceBaseDate as getSharedObsolescenceBaseDate } from './fcra-clock';
import { detectDuplicateLiability, detectReaging } from './negative-item-detectors';
import { getMedicalRuleRecommendation } from './medical-dispute-rules';
import type { CreditorStrategySummary } from './creditor-strategy-insights';
import { getRecommendedMethodologyForCreditor } from './creditor-strategy-insights';

export interface NegativeItemForTriage {
  id: string;
  creditorName: string;
  itemType: string;
  amount: number | null;
  dateReported: string | null;
  originalCreditor?: string | null;
  accountNumber?: string | null;
  accountType?: string | null;
  paymentHistoryGrid?: Record<string, Record<string, string>> | null;
  // FCRA 7-year clock runs from Date of First Delinquency, not the report date.
  // dateOfLastActivity is the closest on-report proxy when DOFD is unavailable.
  dateOfFirstDelinquency?: string | null;
  bureauStatedRemovalDate?: string | null;
  dateOfLastActivity?: string | null;
  riskSeverity: string;
  recommendedAction: string | null;
  onTransunion?: boolean;
  onExperian?: boolean;
  onEquifax?: boolean;
  bureau?: string | null;
  // For discrepancy detection
  transunionStatus?: string | null;
  experianStatus?: string | null;
  equifaxStatus?: string | null;
}

export interface TriagedBatch {
  batchId: string;
  batchName: string;
  strategy: 'factual' | 'debt_validation' | 'method_of_verification' | 'goodwill' | 'metro2_compliance';
  strategyDescription: string;
  items: NegativeItemForTriage[];
  bureau: string;
  itemType: string;
  recommendedRound: number;
  priority: 'high' | 'medium' | 'low';
  legalBasis: string[];
}

export interface TriageSummary {
  batches: TriagedBatch[];
  totalItems: number;
  byBureau: Record<string, number>;
  byType: Record<string, number>;
  byStrategy: Record<string, number>;
  quickActions: QuickAction[];
  historicalRecommendations?: Record<string, string>;
}

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  itemIds: string[];
  count: number;
  bureau?: string;
  itemType?: string;
}

// Best available date for the FCRA obsolescence clock: DOFD > last activity > date reported
export function getObsolescenceBaseDate(item: NegativeItemForTriage): Date | null {
  return getSharedObsolescenceBaseDate(item);
}

// Strategy determination based on item type and characteristics
function determineStrategy(
  itemType: string,
  items: NegativeItemForTriage[],
  round: number = 1,
  historicalSummary?: CreditorStrategySummary
): { strategy: TriagedBatch['strategy']; description: string; legalBasis: string[] } {
  const type = itemType.toLowerCase();

  // Round 2+ always use method of verification
  if (round >= 2) {
    return {
      strategy: 'method_of_verification',
      description: 'Request proof of investigation method from prior dispute',
      legalBasis: [
        'FCRA § 611(a)(6)(B)(iii) - Right to description of verification method',
        'FCRA § 611(a)(7) - Reinvestigation procedures',
      ],
    };
  }

  const medicalRecommendation = getMedicalRuleRecommendation({
    accountType: items[0]?.accountType,
    itemType,
    amount: items[0]?.amount,
  });
  if (medicalRecommendation) {
    return {
      strategy: 'factual',
      description: medicalRecommendation.description,
      legalBasis: [
        'FCRA § 607(b) - Maximum possible accuracy',
        'Medical debt reporting policies require factual verification before continued reporting',
      ],
    };
  }

  const historicalMethodology = historicalSummary && items[0]
    ? getRecommendedMethodologyForCreditor(items[0].creditorName, historicalSummary)
    : null;
  if (historicalMethodology === 'debt_validation' || historicalMethodology === 'factual' || historicalMethodology === 'method_of_verification' || historicalMethodology === 'goodwill' || historicalMethodology === 'metro2_compliance') {
    return {
      strategy: historicalMethodology,
      description: 'Recommended from historical creditor outcome data; static heuristics remain the fallback.',
      legalBasis: [
        'Historical outcome-driven recommendation (advisory only)',
        'FCRA § 611 / § 607(b) factual dispute framework',
      ],
    };
  }

  switch (type) {
    case 'collection':
      return {
        strategy: 'debt_validation',
        description: 'Request debt validation under FDCPA and verify Metro 2 compliance',
        legalBasis: [
          'FDCPA § 809(b) - Debt validation rights',
          'FCRA § 623(a)(2) - Furnisher accuracy requirements',
          'Metro 2 K1 segment original creditor name should be reported',
        ],
      };

    case 'charge_off':
      return {
        strategy: 'factual',
        description: 'Challenge accuracy of balance, status, and DOFD reporting',
        legalBasis: [
          'FCRA § 607(b) - Maximum possible accuracy',
          'FCRA § 605(a) - 7-year reporting limit from DOFD',
          'Metro 2 status code consistency requirements',
        ],
      };

    case 'late_payment':
      // Check if old late payment - might be goodwill candidate
      const hasOldItems = items.some(item => {
        if (!item.dateReported) return false;
        const reportDate = new Date(item.dateReported);
        const yearsOld = (Date.now() - reportDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
        return yearsOld > 4;
      });

      if (hasOldItems) {
        return {
          strategy: 'goodwill',
          description: 'Request goodwill removal for older late payments with otherwise good history',
          legalBasis: [
            'Creditor discretion - goodwill adjustment',
            'Consumer relationship consideration',
          ],
        };
      }

      return {
        strategy: 'factual',
        description: 'Verify accuracy of payment history reporting',
        legalBasis: [
          'FCRA § 607(b) - Maximum possible accuracy',
          'Metro 2 payment history field requirements',
        ],
      };

    case 'inquiry':
      return {
        strategy: 'factual',
        description: 'Challenge permissible purpose documentation',
        legalBasis: [
          'FCRA § 604 - Permissible purposes required',
          'FCRA § 605(a)(3) - 2-year inquiry limit',
        ],
      };

    case 'bankruptcy':
    case 'foreclosure':
    case 'repossession':
      return {
        strategy: 'metro2_compliance',
        description: 'Verify Metro 2 compliance and DOFD accuracy',
        legalBasis: [
          'FCRA § 605(a) - Reporting time limits',
          'Metro 2 public record reporting requirements',
        ],
      };

    default:
      return {
        strategy: 'factual',
        description: 'Request verification of account data accuracy',
        legalBasis: [
          'FCRA § 611 - Right to dispute',
          'FCRA § 607(b) - Maximum possible accuracy',
        ],
      };
  }
}

// Determine priority based on item characteristics
function determinePriority(items: NegativeItemForTriage[]): 'high' | 'medium' | 'low' {
  // High priority: severe items, high amounts, or discrepancies detected
  const hasSevere = items.some(i => i.riskSeverity === 'severe');
  const hasHighAmount = items.some(i => (i.amount || 0) > 500000); // $5000+
  const hasDiscrepancy = items.some(i => {
    // Different statuses across bureaus = discrepancy
    const statuses = [i.transunionStatus, i.experianStatus, i.equifaxStatus].filter(Boolean);
    return new Set(statuses).size > 1;
  });

  if (hasSevere || hasHighAmount || hasDiscrepancy) return 'high';

  // Medium priority: high risk items
  const hasHigh = items.some(i => i.riskSeverity === 'high');
  if (hasHigh) return 'medium';

  return 'low';
}

// Check which bureaus an item appears on
function getItemBureaus(item: NegativeItemForTriage): string[] {
  const bureaus: string[] = [];

  if (item.onTransunion === true) bureaus.push('transunion');
  if (item.onExperian === true) bureaus.push('experian');
  if (item.onEquifax === true) bureaus.push('equifax');

  if (bureaus.length > 0) {
    return bureaus;
  }

  const legacyBureau = item.bureau?.toLowerCase();
  if (legacyBureau === 'transunion' || legacyBureau === 'experian' || legacyBureau === 'equifax') {
    return [legacyBureau];
  }

  return [];
}

// Main triage function
export function triageItems(
  items: NegativeItemForTriage[],
  round: number = 1,
  historicalSummary?: CreditorStrategySummary
): TriageSummary {
  const batches: TriagedBatch[] = [];
  const batchMap = new Map<string, NegativeItemForTriage[]>();

  // Group items by bureau + type
  for (const item of items) {
    const bureaus = getItemBureaus(item);
    const type = item.itemType.toLowerCase();

    for (const bureau of bureaus) {
      const key = `${bureau}|${type}`;
      if (!batchMap.has(key)) {
        batchMap.set(key, []);
      }
      batchMap.get(key)!.push(item);
    }
  }

  // Create batches from groups
  let batchIndex = 0;
  for (const [key, batchItems] of batchMap.entries()) {
    const [bureau, itemType] = key.split('|');
    const { strategy, description, legalBasis } = determineStrategy(itemType, batchItems, round, historicalSummary);
    const priority = determinePriority(batchItems);

    const typeName = itemType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const bureauName = bureau.charAt(0).toUpperCase() + bureau.slice(1);

    batches.push({
      batchId: `batch-${batchIndex++}`,
      batchName: `${bureauName} ${typeName}s - Round ${round}`,
      strategy,
      strategyDescription: description,
      items: batchItems,
      bureau,
      itemType,
      recommendedRound: round,
      priority,
      legalBasis,
    });
  }

  // Sort batches by priority
  batches.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Calculate summary stats
  const byBureau: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byStrategy: Record<string, number> = {};

  for (const batch of batches) {
    byBureau[batch.bureau] = (byBureau[batch.bureau] || 0) + batch.items.length;
    byType[batch.itemType] = (byType[batch.itemType] || 0) + batch.items.length;
    byStrategy[batch.strategy] = (byStrategy[batch.strategy] || 0) + batch.items.length;
  }

  // Generate quick actions
  const quickActions: QuickAction[] = [];

  // Quick action: All collections on each bureau
  for (const bureau of ['transunion', 'experian', 'equifax']) {
    const collectionBatch = batches.find(b => b.bureau === bureau && b.itemType === 'collection');
    if (collectionBatch && collectionBatch.items.length > 0) {
      quickActions.push({
        id: `collections-${bureau}`,
        label: `All ${bureau.charAt(0).toUpperCase() + bureau.slice(1)} Collections`,
        description: `Select all ${collectionBatch.items.length} collection accounts on ${bureau}`,
        itemIds: collectionBatch.items.map(i => i.id),
        count: collectionBatch.items.length,
        bureau,
        itemType: 'collection',
      });
    }
  }

  // Quick action: Items approaching 7-year limit (6+ years since first delinquency)
  const oldItems = items.filter(item => {
    const baseDate = getObsolescenceBaseDate(item);
    if (!baseDate) return false;
    const yearsOld = (Date.now() - baseDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    return yearsOld >= 6;
  });
  if (oldItems.length > 0) {
    quickActions.push({
      id: 'approaching-obsolete',
      label: 'Items Approaching 7-Year Limit',
      description: `${oldItems.length} items are 6+ years old and approaching FCRA obsolescence`,
      itemIds: oldItems.map(i => i.id),
      count: oldItems.length,
    });
  }

  const reagedItems = detectReaging(items.map(item => ({
    id: item.id,
    creditorName: item.creditorName,
    originalCreditor: item.originalCreditor,
    accountNumber: item.accountNumber,
    itemType: item.itemType,
    bureau: item.bureau,
    dateOfFirstDelinquency: item.dateOfFirstDelinquency,
    paymentHistoryGrid: item.paymentHistoryGrid?.[item.bureau || ''] || null,
  })));
  if (reagedItems.length > 0) {
    quickActions.push({
      id: 'reaged-items',
      label: 'Potential Re-aged Items',
      description: `${reagedItems.length} items have DOFD later than the first late month in payment history`,
      itemIds: reagedItems.map(item => item.itemId),
      count: reagedItems.length,
    });
  }

  const duplicateLiabilities = detectDuplicateLiability(items.map(item => ({
    id: item.id,
    creditorName: item.creditorName,
    originalCreditor: item.originalCreditor,
    accountNumber: item.accountNumber,
    itemType: item.itemType,
    bureau: item.bureau,
  })));
  if (duplicateLiabilities.length > 0) {
    const itemIds = [...new Set(duplicateLiabilities.flatMap(group => group.itemIds))];
    quickActions.push({
      id: 'duplicate-liability',
      label: 'Potential Duplicate Liability',
      description: `${itemIds.length} items may reflect the same debt reporting on multiple tradelines`,
      itemIds,
      count: itemIds.length,
    });
  }

  // Quick action: High severity items
  const severeItems = items.filter(i => i.riskSeverity === 'severe' || i.riskSeverity === 'high');
  if (severeItems.length > 0) {
    quickActions.push({
      id: 'high-severity',
      label: 'High Priority Items',
      description: `${severeItems.length} items with high/severe impact on credit score`,
      itemIds: severeItems.map(i => i.id),
      count: severeItems.length,
    });
  }

  // Quick action: Items with discrepancies
  const discrepancyItems = items.filter(i => {
    const statuses = [i.transunionStatus, i.experianStatus, i.equifaxStatus].filter(Boolean);
    return new Set(statuses).size > 1;
  });
  if (discrepancyItems.length > 0) {
    quickActions.push({
      id: 'discrepancies',
      label: 'Items with Bureau Discrepancies',
      description: `${discrepancyItems.length} items report differently across bureaus`,
      itemIds: discrepancyItems.map(i => i.id),
      count: discrepancyItems.length,
    });
  }

  const historicalRecommendations: Record<string, string> = {};
  if (historicalSummary) {
    for (const item of items) {
      const recommended = getRecommendedMethodologyForCreditor(item.creditorName, historicalSummary);
      if (recommended) historicalRecommendations[item.id] = recommended;
    }
  }

  return {
    batches,
    totalItems: items.length,
    byBureau,
    byType,
    byStrategy,
    quickActions,
    historicalRecommendations,
  };
}

// Get recommended strategy for a specific item
export function getItemStrategy(
  item: NegativeItemForTriage,
  round: number = 1
): { strategy: string; description: string } {
  const { strategy, description } = determineStrategy(item.itemType, [item], round);
  return { strategy, description };
}
