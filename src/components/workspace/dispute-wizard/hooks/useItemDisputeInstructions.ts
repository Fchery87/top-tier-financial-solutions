import * as React from 'react';
import type { ItemDisputeInstruction } from '../types';
import { PRESET_DISPUTE_INSTRUCTIONS } from '../types';

export function useItemDisputeInstructions() {
  const [itemDisputeInstructions, setItemDisputeInstructions] = React.useState<Map<string, ItemDisputeInstruction>>(new Map());

  const updateItemInstruction = React.useCallback((itemId: string, instructionType: 'preset' | 'custom', value: string) => {
    setItemDisputeInstructions(prev => {
      const newMap = new Map(prev);
      if (instructionType === 'preset') {
        newMap.set(itemId, { itemId, instructionType: value === 'custom' ? 'custom' : 'preset', presetCode: value, customText: value === 'custom' ? (prev.get(itemId)?.customText || '') : undefined });
      } else {
        newMap.set(itemId, { itemId, instructionType: 'custom', presetCode: 'custom', customText: value });
      }
      return newMap;
    });
  }, []);

  const getInstructionText = React.useCallback((itemId: string): string => {
    const instruction = itemDisputeInstructions.get(itemId);
    if (!instruction) return '';
    if (instruction.instructionType === 'custom') return instruction.customText || '';
    const preset = PRESET_DISPUTE_INSTRUCTIONS.find(p => p.code === instruction.presetCode);
    return preset?.description || '';
  }, [itemDisputeInstructions]);

  const hasItemInstruction = React.useCallback((itemId: string) => Boolean(itemDisputeInstructions.get(itemId)), [itemDisputeInstructions]);

  return {
    itemDisputeInstructions,
    setItemDisputeInstructions,
    updateItemInstruction,
    getInstructionText,
    hasItemInstruction,
  };
}
