import { describe, it, expect } from 'vitest';
import {
  itemAppearsOnBureau,
  formatItemType,
  formatPersonalInfoType,
  formatCurrency,
  getInstructionText,
  getRecommendedMethodologyForItems,
  buildStepStatuses,
  PRESET_DISPUTE_INSTRUCTIONS,
  type NegativeItem,
  type ItemDisputeInstruction,
} from '../dispute-wizard-utils';

describe('dispute-wizard-utils - itemAppearsOnBureau', () => {
  describe('Using new per-bureau boolean fields', () => {
    it('should return true when on_transunion is true for TransUnion', () => {
      const item: NegativeItem = {
        id: '1',
        creditor_name: 'Test',
        on_transunion: true,
        on_experian: false,
        on_equifax: false,
      };
      expect(itemAppearsOnBureau(item, 'transunion')).toBe(true);
      expect(itemAppearsOnBureau(item, 'TransUnion')).toBe(true);
      expect(itemAppearsOnBureau(item, 'TRANSUNION')).toBe(true);
    });

    it('should return false when on_transunion is false for TransUnion', () => {
      const item: NegativeItem = {
        id: '1',
        creditor_name: 'Test',
        on_transunion: false,
      };
      expect(itemAppearsOnBureau(item, 'transunion')).toBe(false);
    });

    it('should return true when on_experian is true for Experian', () => {
      const item: NegativeItem = {
        id: '1',
        creditor_name: 'Test',
        on_experian: true,
        on_transunion: false,
        on_equifax: false,
      };
      expect(itemAppearsOnBureau(item, 'experian')).toBe(true);
      expect(itemAppearsOnBureau(item, 'Experian')).toBe(true);
      expect(itemAppearsOnBureau(item, 'EXPERIAN')).toBe(true);
    });

    it('should return true when on_equifax is true for Equifax', () => {
      const item: NegativeItem = {
        id: '1',
        creditor_name: 'Test',
        on_equifax: true,
        on_transunion: false,
        on_experian: false,
      };
      expect(itemAppearsOnBureau(item, 'equifax')).toBe(true);
      expect(itemAppearsOnBureau(item, 'Equifax')).toBe(true);
      expect(itemAppearsOnBureau(item, 'EQUIFAX')).toBe(true);
    });

    it('should handle item appearing on multiple bureaus', () => {
      const item: NegativeItem = {
        id: '1',
        creditor_name: 'Test',
        on_transunion: true,
        on_experian: true,
        on_equifax: false,
      };
      expect(itemAppearsOnBureau(item, 'transunion')).toBe(true);
      expect(itemAppearsOnBureau(item, 'experian')).toBe(true);
      expect(itemAppearsOnBureau(item, 'equifax')).toBe(false);
    });
  });

  describe('Using bureaus array', () => {
    it('should return true when bureau is in bureaus array', () => {
      const item: NegativeItem = {
        id: '1',
        creditor_name: 'Test',
        bureaus: ['transunion', 'experian'],
      };
      expect(itemAppearsOnBureau(item, 'transunion')).toBe(true);
      expect(itemAppearsOnBureau(item, 'experian')).toBe(true);
      expect(itemAppearsOnBureau(item, 'equifax')).toBe(false);
    });

    it('should return false when bureau is not in bureaus array', () => {
      const item: NegativeItem = {
        id: '1',
        creditor_name: 'Test',
        bureaus: ['transunion'],
      };
      expect(itemAppearsOnBureau(item, 'experian')).toBe(false);
    });

    it('should handle empty bureaus array', () => {
      const item: NegativeItem = {
        id: '1',
        creditor_name: 'Test',
        bureaus: [],
      };
      // Falls through to legacy bureau logic
      expect(itemAppearsOnBureau(item, 'transunion')).toBe(true); // No specific bureau = all bureaus
    });
  });

  describe('Using legacy bureau field', () => {
    it('should return true when legacy bureau matches', () => {
      const item: NegativeItem = {
        id: '1',
        creditor_name: 'Test',
        bureau: 'transunion',
      };
      expect(itemAppearsOnBureau(item, 'transunion')).toBe(true);
      expect(itemAppearsOnBureau(item, 'experian')).toBe(false);
    });

    it('should return true for all bureaus when bureau is "combined"', () => {
      const item: NegativeItem = {
        id: '1',
        creditor_name: 'Test',
        bureau: 'combined',
      };
      expect(itemAppearsOnBureau(item, 'transunion')).toBe(true);
      expect(itemAppearsOnBureau(item, 'experian')).toBe(true);
      expect(itemAppearsOnBureau(item, 'equifax')).toBe(true);
    });

    it('should return true for all bureaus when bureau is undefined', () => {
      const item: NegativeItem = {
        id: '1',
        creditor_name: 'Test',
        bureau: undefined,
      };
      expect(itemAppearsOnBureau(item, 'transunion')).toBe(true);
      expect(itemAppearsOnBureau(item, 'experian')).toBe(true);
    });

    it('should be case insensitive for legacy bureau field', () => {
      const item: NegativeItem = {
        id: '1',
        creditor_name: 'Test',
        bureau: 'TransUnion',
      };
      expect(itemAppearsOnBureau(item, 'transunion')).toBe(true);
      expect(itemAppearsOnBureau(item, 'TRANSUNION')).toBe(true);
    });
  });

  describe('Field precedence', () => {
    it('should prefer per-bureau boolean over bureaus array', () => {
      const item: NegativeItem = {
        id: '1',
        creditor_name: 'Test',
        on_transunion: false,
        bureaus: ['transunion'],
      };
      expect(itemAppearsOnBureau(item, 'transunion')).toBe(false);
    });

    it('should prefer bureaus array over legacy bureau field', () => {
      const item: NegativeItem = {
        id: '1',
        creditor_name: 'Test',
        bureaus: ['experian'],
        bureau: 'transunion',
      };
      expect(itemAppearsOnBureau(item, 'experian')).toBe(true);
      expect(itemAppearsOnBureau(item, 'transunion')).toBe(false);
    });
  });
});

describe('dispute-wizard-utils - formatItemType', () => {
  it('should format single word snake_case', () => {
    expect(formatItemType('delinquency')).toBe('Delinquency');
  });

  it('should format multi-word snake_case', () => {
    expect(formatItemType('charge_off')).toBe('Charge Off');
    expect(formatItemType('late_payment')).toBe('Late Payment');
  });

  it('should handle already formatted text', () => {
    expect(formatItemType('Collection')).toBe('Collection');
  });

  it('should handle empty string', () => {
    expect(formatItemType('')).toBe('');
  });

  it('should handle single character', () => {
    expect(formatItemType('a')).toBe('A');
  });

  it('should handle three or more words', () => {
    expect(formatItemType('credit_card_account')).toBe('Credit Card Account');
  });

  it('should handle mixed case input', () => {
    expect(formatItemType('Charge_Off')).toBe('Charge Off');
  });
});

describe('dispute-wizard-utils - formatPersonalInfoType', () => {
  it('should format snake_case with underscores', () => {
    expect(formatPersonalInfoType('date_of_birth')).toBe('Date Of Birth');
  });

  it('should format address fields', () => {
    expect(formatPersonalInfoType('street_address')).toBe('Street Address');
  });

  it('should format single word', () => {
    expect(formatPersonalInfoType('name')).toBe('Name');
  });

  it('should format social security number', () => {
    expect(formatPersonalInfoType('social_security_number')).toBe('Social Security Number');
  });

  it('should handle empty string', () => {
    expect(formatPersonalInfoType('')).toBe('');
  });

  it('should capitalize each word', () => {
    expect(formatPersonalInfoType('employer_name')).toBe('Employer Name');
  });

  it('should handle already formatted text', () => {
    expect(formatPersonalInfoType('Name')).toBe('Name');
  });
});

describe('dispute-wizard-utils - formatCurrency', () => {
  it('should format positive amounts correctly', () => {
    expect(formatCurrency(123456)).toBe('$1,234.56');
  });

  it('should format small amounts', () => {
    expect(formatCurrency(50)).toBe('$0.50');
    expect(formatCurrency(1)).toBe('$0.01');
  });

  it('should format zero', () => {
    expect(formatCurrency(0)).toBe('—');
  });

  it('should format null', () => {
    expect(formatCurrency(null)).toBe('—');
  });

  it('should format undefined', () => {
    expect(formatCurrency(undefined)).toBe('—');
  });

  it('should format large amounts with commas', () => {
    expect(formatCurrency(1000000)).toBe('$10,000.00');
    expect(formatCurrency(123456789)).toBe('$1,234,567.89');
  });

  it('should handle edge case amounts', () => {
    expect(formatCurrency(99)).toBe('$0.99');
    expect(formatCurrency(100)).toBe('$1.00');
    expect(formatCurrency(101)).toBe('$1.01');
  });
});

describe('dispute-wizard-utils - getInstructionText', () => {
  const createInstructionsMap = (instructions: ItemDisputeInstruction[]): Map<string, ItemDisputeInstruction> => {
    const map = new Map<string, ItemDisputeInstruction>();
    instructions.forEach(i => map.set(i.itemId, i));
    return map;
  };

  it('should return empty string when no instruction exists', () => {
    const instructions = createInstructionsMap([]);
    expect(getInstructionText('item-1', instructions)).toBe('');
  });

  it('should return custom text for custom instruction', () => {
    const instructions = createInstructionsMap([
      {
        itemId: 'item-1',
        instructionType: 'custom',
        customText: 'My custom dispute reason',
      },
    ]);
    expect(getInstructionText('item-1', instructions)).toBe('My custom dispute reason');
  });

  it('should return empty string for custom instruction with no text', () => {
    const instructions = createInstructionsMap([
      {
        itemId: 'item-1',
        instructionType: 'custom',
      },
    ]);
    expect(getInstructionText('item-1', instructions)).toBe('');
  });

  it('should return preset description for preset instruction', () => {
    const instructions = createInstructionsMap([
      {
        itemId: 'item-1',
        instructionType: 'preset',
        presetCode: 'verification_required',
      },
    ]);
    const result = getInstructionText('item-1', instructions);
    expect(result).toContain('requesting documented verification');
  });

  it('should return empty string for unknown preset code', () => {
    const instructions = createInstructionsMap([
      {
        itemId: 'item-1',
        instructionType: 'preset',
        presetCode: 'unknown_code',
      },
    ]);
    expect(getInstructionText('item-1', instructions)).toBe('');
  });

  it('should handle all preset codes', () => {
    const presetCodes = PRESET_DISPUTE_INSTRUCTIONS.filter(p => p.code !== 'custom').map(p => p.code);

    presetCodes.forEach(code => {
      const instructions = createInstructionsMap([
        {
          itemId: 'item-1',
          instructionType: 'preset',
          presetCode: code,
        },
      ]);
      const result = getInstructionText('item-1', instructions);
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

describe('dispute-wizard-utils - getRecommendedMethodologyForItems', () => {
  const createItems = (types: string[]): NegativeItem[] => {
    return types.map((type, i) => ({
      id: `item-${i}`,
      creditor_name: `Creditor ${i}`,
      item_type: type,
    }));
  };

  it('should return null when no items selected', () => {
    const items = createItems(['delinquency', 'charge_off']);
    expect(getRecommendedMethodologyForItems([], items, 1)).toBeNull();
  });

  it('should return debt_validation for collections in round 1', () => {
    const items = createItems(['collection', 'delinquency']);
    const result = getRecommendedMethodologyForItems(['item-0'], items, 1);
    expect(result).toBe('debt_validation');
  });

  it('should return factual for collections in round 2+', () => {
    const items = createItems(['collection']);
    const result = getRecommendedMethodologyForItems(['item-0'], items, 2);
    expect(result).toBe('method_of_verification');
  });

  it('should return method_of_verification for round 2', () => {
    const items = createItems(['delinquency', 'charge_off']);
    const result = getRecommendedMethodologyForItems(['item-0', 'item-1'], items, 2);
    expect(result).toBe('method_of_verification');
  });

  it('should return method_of_verification for round 3', () => {
    const items = createItems(['delinquency']);
    const result = getRecommendedMethodologyForItems(['item-0'], items, 3);
    expect(result).toBe('method_of_verification');
  });

  it('should return factual for non-collection items in round 1', () => {
    const items = createItems(['delinquency', 'charge_off']);
    const result = getRecommendedMethodologyForItems(['item-0', 'item-1'], items, 1);
    expect(result).toBe('factual');
  });

  it('should prioritize collection over other types in round 1', () => {
    const items = createItems(['delinquency', 'collection', 'charge_off']);
    const result = getRecommendedMethodologyForItems(['item-0', 'item-1', 'item-2'], items, 1);
    expect(result).toBe('debt_validation');
  });

  it('should handle mixed selection with collection in round 1', () => {
    const items = createItems(['delinquency', 'charge_off', 'collection']);
    // Only select non-collection items
    const result = getRecommendedMethodologyForItems(['item-0', 'item-1'], items, 1);
    expect(result).toBe('factual');
  });
});

describe('dispute-wizard-utils - buildStepStatuses', () => {
  const createValidationErrors = (errors: Record<number, string[]>) => errors;
  const createValidationWarnings = (warnings: Record<number, string[]>) => warnings;

  it('should mark step 1 complete when client is selected', () => {
    const statuses = buildStepStatuses(
      1,
      { id: 'client-1' },
      0,
      0,
      0,
      {},
      {}
    );

    expect(statuses[0].isComplete).toBe(true);
    expect(statuses[0].stepId).toBe(1);
  });

  it('should mark step 1 incomplete when no client selected', () => {
    const statuses = buildStepStatuses(
      1,
      null,
      0,
      0,
      0,
      {},
      {}
    );

    expect(statuses[0].isComplete).toBe(false);
  });

  it('should mark step 2 complete when items are selected', () => {
    const statuses = buildStepStatuses(
      2,
      { id: 'client-1' },
      3,
      0,
      0,
      {},
      {}
    );

    expect(statuses[1].isComplete).toBe(true);
    expect(statuses[1].stepId).toBe(2);
  });

  it('should mark step 3 complete when bureaus are selected', () => {
    const statuses = buildStepStatuses(
      3,
      { id: 'client-1' },
      3,
      2,
      0,
      {},
      {}
    );

    expect(statuses[2].isComplete).toBe(true);
    expect(statuses[2].stepId).toBe(3);
  });

  it('should mark step 4 complete when letters are generated', () => {
    const statuses = buildStepStatuses(
      4,
      { id: 'client-1' },
      3,
      2,
      1,
      {},
      {}
    );

    expect(statuses[3].isComplete).toBe(true);
    expect(statuses[3].stepId).toBe(4);
  });

  it('should mark current step correctly', () => {
    const statuses = buildStepStatuses(
      2,
      { id: 'client-1' },
      0,
      0,
      0,
      {},
      {}
    );

    expect(statuses[0].isCurrentStep).toBe(false);
    expect(statuses[1].isCurrentStep).toBe(true);
    expect(statuses[2].isCurrentStep).toBe(false);
    expect(statuses[3].isCurrentStep).toBe(false);
  });

  it('should detect errors in steps', () => {
    const errors = createValidationErrors({
      1: ['Client is required'],
      3: ['At least one bureau must be selected'],
    });

    const statuses = buildStepStatuses(
      1,
      null,
      0,
      0,
      0,
      errors,
      {}
    );

    expect(statuses[0].hasErrors).toBe(true);
    expect(statuses[1].hasErrors).toBe(false);
    expect(statuses[2].hasErrors).toBe(true);
    expect(statuses[3].hasErrors).toBe(false);
  });

  it('should detect warnings in steps', () => {
    const warnings = createValidationWarnings({
      2: ['Consider selecting more items'],
    });

    const statuses = buildStepStatuses(
      2,
      { id: 'client-1' },
      1,
      0,
      0,
      {},
      warnings
    );

    expect(statuses[0].hasWarnings).toBe(false);
    expect(statuses[1].hasWarnings).toBe(true);
    expect(statuses[2].hasWarnings).toBe(false);
    expect(statuses[3].hasWarnings).toBe(false);
  });

  it('should handle both errors and warnings', () => {
    const errors = createValidationErrors({ 1: ['Error'] });
    const warnings = createValidationWarnings({ 1: ['Warning'] });

    const statuses = buildStepStatuses(
      1,
      null,
      0,
      0,
      0,
      errors,
      warnings
    );

    expect(statuses[0].hasErrors).toBe(true);
    expect(statuses[0].hasWarnings).toBe(true);
  });

  it('should return all 4 steps', () => {
    const statuses = buildStepStatuses(
      1,
      null,
      0,
      0,
      0,
      {},
      {}
    );

    expect(statuses).toHaveLength(4);
    expect(statuses.map(s => s.stepId)).toEqual([1, 2, 3, 4]);
  });
});
