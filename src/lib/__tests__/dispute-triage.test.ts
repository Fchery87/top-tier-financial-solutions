import { describe, expect, it } from 'vitest';

import { triageItems, type NegativeItemForTriage } from '../dispute-triage';

const baseItem: Omit<NegativeItemForTriage, 'id'> = {
  creditorName: 'Test Creditor',
  itemType: 'collection',
  amount: 10000,
  dateReported: '2024-01-01',
  riskSeverity: 'medium',
  recommendedAction: null,
};

describe('dispute-triage bureau presence', () => {
  it('assigns items with all bureau flags false to no bureaus', () => {
    const summary = triageItems([
      {
        ...baseItem,
        id: 'item-none',
        onTransunion: false,
        onExperian: false,
        onEquifax: false,
        bureau: 'combined',
      },
    ]);

    expect(summary.batches).toEqual([]);
    expect(summary.byBureau).toEqual({});
  });

  it('keeps single-bureau items on only their explicit bureau', () => {
    const summary = triageItems([
      {
        ...baseItem,
        id: 'item-tu',
        onTransunion: true,
        onExperian: false,
        onEquifax: false,
        bureau: 'combined',
      },
    ]);

    expect(summary.batches).toHaveLength(1);
    expect(summary.batches[0].bureau).toBe('transunion');
    expect(summary.batches[0].items.map(item => item.id)).toEqual(['item-tu']);
    expect(summary.byBureau).toEqual({ transunion: 1 });
  });

  it('does not imply all bureaus from combined or undefined legacy bureau values without evidence flags', () => {
    const summary = triageItems([
      {
        ...baseItem,
        id: 'item-combined',
        bureau: 'combined',
      },
      {
        ...baseItem,
        id: 'item-undefined',
        bureau: undefined,
      },
    ]);

    expect(summary.batches).toEqual([]);
    expect(summary.byBureau).toEqual({});
  });
});

describe('dispute-triage medical debt', () => {
  it('lists medical items in a quick action and counts the ones awaiting confirmation', () => {
    const summary = triageItems([
      { ...baseItem, id: 'med-confirmed', accountType: 'medical', onEquifax: true },
      { ...baseItem, id: 'med-possible', creditorName: 'Medical Data Systems', onEquifax: true },
      { ...baseItem, id: 'not-medical', onEquifax: true },
    ]);

    expect(summary.quickActions.find(action => action.id === 'medical-debt')).toEqual({
      id: 'medical-debt',
      label: 'Medical Debt',
      description: '2 items look like medical debt; 1 needs client confirmation because only the creditor name suggests it',
      itemIds: ['med-confirmed', 'med-possible'],
      count: 2,
    });
  });

  it('does not give a whole batch a medical strategy because of its first item', () => {
    const summary = triageItems([
      { ...baseItem, id: 'med-first', accountType: 'medical', onEquifax: true },
      { ...baseItem, id: 'card-collection', onEquifax: true },
    ]);

    expect(summary.batches[0].strategyDescription).not.toContain('Medical');
  });
});

describe('dispute-triage cross-bureau mismatches', () => {
  it('lists the items with an objective cross-bureau mismatch', () => {
    const summary = triageItems([
      { ...baseItem, id: 'mismatch', onEquifax: true },
      { ...baseItem, id: 'clean', onEquifax: true },
    ], 1, undefined, { crossBureauItemIds: ['mismatch'] });

    expect(summary.quickActions.find(action => action.id === 'cross-bureau-mismatch')).toEqual({
      id: 'cross-bureau-mismatch',
      label: 'Cross-Bureau Mismatches',
      description: '1 items are reported differently by different bureaus, so at most one version can be accurate',
      itemIds: ['mismatch'],
      count: 1,
    });
  });
});

describe('dispute-triage Item Timeline findings', () => {
  it('lists re-aged and reinserted items', () => {
    const summary = triageItems([
      { ...baseItem, id: 'reaged', onEquifax: true },
      { ...baseItem, id: 'back', onEquifax: true },
    ], 1, undefined, { reagedItemIds: ['reaged'], reinsertedItemIds: ['back'] });

    expect(summary.quickActions.filter(action => ['reaged-over-time', 'reinserted'].includes(action.id)).map(action => [action.id, action.itemIds])).toEqual([
      ['reaged-over-time', ['reaged']],
      ['reinserted', ['back']],
    ]);
  });
});
