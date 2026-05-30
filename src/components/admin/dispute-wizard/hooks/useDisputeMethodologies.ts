import * as React from 'react';
import type { DisputeType, Methodology, NegativeItem, ReasonCode } from '../types';

interface UseDisputeMethodologiesOptions {
  selectedItems?: string[];
  negativeItems?: NegativeItem[];
  disputeRound?: number;
}

export function useDisputeMethodologies({
  selectedItems = [],
  negativeItems = [],
  disputeRound = 1,
}: UseDisputeMethodologiesOptions = {}) {
  const [methodologies, setMethodologies] = React.useState<Methodology[]>([]);
  const [selectedMethodology, setSelectedMethodology] = React.useState<string>('factual');
  const [recommendedMethodology, setRecommendedMethodology] = React.useState<string | null>(null);
  const [loadingMethodologies, setLoadingMethodologies] = React.useState(false);
  const [reasonCodes, setReasonCodes] = React.useState<ReasonCode[]>([]);
  const [_disputeTypes, setDisputeTypes] = React.useState<DisputeType[]>([]);

  const fetchReasonCodes = React.useCallback(async (methodology?: string) => {
    try {
      const url = methodology ? `/api/admin/disputes/methodologies?methodology=${methodology}` : '/api/admin/disputes/generate-letter';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setReasonCodes(data.reason_codes || []);
        if (data.dispute_types) setDisputeTypes(data.dispute_types || []);
      }
    } catch (error) {
      console.error('Error fetching reason codes:', error);
    }
  }, []);

  const fetchMethodologies = React.useCallback(async () => {
    setLoadingMethodologies(true);
    try {
      const response = await fetch('/api/admin/disputes/methodologies');
      if (response.ok) {
        const data = await response.json();
        setMethodologies(data.methodologies || []);
        if (data.reason_codes && data.reason_codes.length > 0) setReasonCodes(data.reason_codes);
      }
    } catch (error) {
      console.error('Error fetching methodologies:', error);
    } finally {
      setLoadingMethodologies(false);
    }
  }, []);

  const getRecommendedMethodologyForItems = React.useCallback(() => {
    if (selectedItems.length === 0) return null;

    const hasCollection = negativeItems
      .filter(item => selectedItems.includes(item.id))
      .some(item => item.item_type === 'collection');

    if (hasCollection && disputeRound === 1) return 'debt_validation';
    if (disputeRound >= 2) return 'method_of_verification';
    return 'factual';
  }, [selectedItems, negativeItems, disputeRound]);

  React.useEffect(() => {
    setRecommendedMethodology(getRecommendedMethodologyForItems());
  }, [getRecommendedMethodologyForItems]);

  React.useEffect(() => {
    if (selectedMethodology) void fetchReasonCodes(selectedMethodology);
  }, [selectedMethodology, fetchReasonCodes]);

  return {
    methodologies,
    setMethodologies,
    selectedMethodology,
    setSelectedMethodology,
    recommendedMethodology,
    setRecommendedMethodology,
    loadingMethodologies,
    setLoadingMethodologies,
    reasonCodes,
    setReasonCodes,
    fetchReasonCodes,
    fetchMethodologies,
  };
}
