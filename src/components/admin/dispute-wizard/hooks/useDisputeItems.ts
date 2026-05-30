import * as React from 'react';
import type { Client, GenerationMethod, InquiryItem, ItemDisputeInstruction, ItemTab, NegativeItem, PersonalInfoItem } from '../types';

interface UseDisputeItemsOptions {
  getGenerationMethod: () => GenerationMethod;
  setSelectedClient: React.Dispatch<React.SetStateAction<Client | null>>;
  setItemDisputeInstructions: React.Dispatch<React.SetStateAction<Map<string, ItemDisputeInstruction>>>;
}

export function useDisputeItems({ getGenerationMethod, setSelectedClient, setItemDisputeInstructions }: UseDisputeItemsOptions) {
  const [negativeItems, setNegativeItems] = React.useState<NegativeItem[]>([]);
  const [selectedItems, setSelectedItems] = React.useState<string[]>([]);
  const [personalInfoItems, setPersonalInfoItems] = React.useState<PersonalInfoItem[]>([]);
  const [selectedPersonalItems, setSelectedPersonalItems] = React.useState<string[]>([]);
  const [inquiryItems, setInquiryItems] = React.useState<InquiryItem[]>([]);
  const [selectedInquiryItems, setSelectedInquiryItems] = React.useState<string[]>([]);
  const [activeTab, setActiveTab] = React.useState<ItemTab>('tradelines');
  const [loadingItems, setLoadingItems] = React.useState(false);

  const fetchNegativeItems = React.useCallback(async (clientId: string) => {
    setLoadingItems(true);
    try {
      const response = await fetch(`/api/admin/clients/${clientId}`);
      if (response.ok) {
        const data = await response.json();
        setNegativeItems(data.negative_items || []);
        setSelectedItems([]);
        setPersonalInfoItems(data.personal_info_disputes || []);
        setInquiryItems(data.inquiry_disputes || []);
        setSelectedPersonalItems([]);
        setSelectedInquiryItems([]);
      }
    } catch (error) {
      console.error('Error fetching negative items:', error);
    } finally {
      setLoadingItems(false);
    }
  }, []);

  const handleSelectClient = React.useCallback((client: Client) => {
    setSelectedClient(client);
    setSelectedItems([]);
    setSelectedPersonalItems([]);
    setSelectedInquiryItems([]);
    setNegativeItems([]);
    setPersonalInfoItems([]);
    setInquiryItems([]);
    setActiveTab('tradelines');
  }, [setSelectedClient]);

  const handleToggleItem = React.useCallback((itemId: string) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        setItemDisputeInstructions(prevInstructions => {
          const next = new Map(prevInstructions);
          next.delete(itemId);
          return next;
        });
        return prev.filter(id => id !== itemId);
      }

      if (getGenerationMethod() === 'template') {
        setItemDisputeInstructions(prevInstructions => {
          const next = new Map(prevInstructions);
          next.set(itemId, { itemId, instructionType: 'preset', presetCode: '' });
          return next;
        });
      }
      return [...prev, itemId];
    });
  }, [getGenerationMethod, setItemDisputeInstructions]);

  return {
    negativeItems,
    setNegativeItems,
    selectedItems,
    setSelectedItems,
    personalInfoItems,
    setPersonalInfoItems,
    selectedPersonalItems,
    setSelectedPersonalItems,
    inquiryItems,
    setInquiryItems,
    selectedInquiryItems,
    setSelectedInquiryItems,
    activeTab,
    setActiveTab,
    loadingItems,
    setLoadingItems,
    fetchNegativeItems,
    handleSelectClient,
    handleToggleItem,
  };
}
