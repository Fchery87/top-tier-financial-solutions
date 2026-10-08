import * as React from 'react';
import type { ItemDisputeInstruction } from '../types';
import { PRESET_DISPUTE_INSTRUCTIONS } from '../types';

/**
 * The reason code a staff member chose for an item's instruction: the preset's
 * code, or the code picked alongside a custom instruction. A custom instruction
 * has no code until one is chosen.
 */
export function getInstructionReasonCode(instruction: ItemDisputeInstruction | undefined): string | null {
  if (!instruction) return null;
  if (instruction.instructionType === 'custom') return instruction.reasonCode || null;
  return instruction.presetCode && instruction.presetCode !== 'custom' ? instruction.presetCode : null;
}

export function useItemDisputeInstructions() {
  const [itemDisputeInstructions, setItemDisputeInstructions] = React.useState<Map<string, ItemDisputeInstruction>>(new Map());

  const updateItemInstruction = React.useCallback((itemId: string, instructionType: 'preset' | 'custom', value: string) => {
    setItemDisputeInstructions(prev => {
      const newMap = new Map(prev);
      if (instructionType === 'preset') {
        newMap.set(itemId, { itemId, instructionType: value === 'custom' ? 'custom' : 'preset', presetCode: value, customText: value === 'custom' ? (prev.get(itemId)?.customText || '') : undefined });
      } else {
        newMap.set(itemId, { itemId, instructionType: 'custom', presetCode: 'custom', customText: value, reasonCode: prev.get(itemId)?.reasonCode });
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

  const updateItemCustomReasonCode = React.useCallback((itemId: string, reasonCode: string) => {
    setItemDisputeInstructions(prev => {
      const current = prev.get(itemId);
      if (!current || current.instructionType !== 'custom') return prev;
      const newMap = new Map(prev);
      newMap.set(itemId, { ...current, reasonCode: reasonCode || undefined });
      return newMap;
    });
  }, []);

  const getItemReasonCode = React.useCallback(
    (itemId: string): string | null => getInstructionReasonCode(itemDisputeInstructions.get(itemId)),
    [itemDisputeInstructions],
  );

  const hasItemInstruction = React.useCallback((itemId: string) => Boolean(itemDisputeInstructions.get(itemId)), [itemDisputeInstructions]);

  return {
    itemDisputeInstructions,
    setItemDisputeInstructions,
    updateItemInstruction,
    getInstructionText,
    hasItemInstruction,
    updateItemCustomReasonCode,
    getItemReasonCode,
  };
}
