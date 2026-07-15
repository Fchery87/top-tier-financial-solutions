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
