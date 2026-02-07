import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useWizardDraft,
  recoverWizardDraft,
  getDraftMetadata,
  hasDraft,
  type WizardDraftData,
  type DraftMetadata,
} from '../useWizardDraft';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock fetch
global.fetch = vi.fn();
const fetchMock = global.fetch as ReturnType<typeof vi.fn>;

describe('useWizardDraft hook', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('loadDraft', () => {
    it('should return null when no draft exists in localStorage', () => {
      const { result } = renderHook(() => useWizardDraft());
      const draft = result.current.loadDraft();
      expect(draft).toBeNull();
      expect(result.current.draftExists).toBe(false);
    });

    it('should load draft from localStorage', () => {
      const mockDraft: WizardDraftData = {
        selectedClientId: 'client-1',
        selectedItems: ['item-1', 'item-2'],
        currentStep: 2,
      };
      localStorage.setItem('dispute-wizard-draft', JSON.stringify(mockDraft));

      const { result } = renderHook(() => useWizardDraft('client-1'));

      let draft: WizardDraftData | null = null;
      act(() => {
        draft = result.current.loadDraft();
      });

      expect(draft).toEqual(mockDraft);
      expect(result.current.draftLoaded).toBe(true);
      expect(result.current.draftExists).toBe(true);
    });

    it('should return null when draft is for different client', () => {
      const mockDraft: WizardDraftData = {
        selectedClientId: 'client-1',
        selectedItems: ['item-1'],
      };
      localStorage.setItem('dispute-wizard-draft', JSON.stringify(mockDraft));

      const { result } = renderHook(() => useWizardDraft('client-2'));
      const draft = result.current.loadDraft();

      expect(draft).toBeNull();
      expect(result.current.draftExists).toBe(false);
    });

    it('should load last saved time from metadata', () => {
      const mockDraft: WizardDraftData = {
        selectedClientId: 'client-1',
      };
      const mockMetadata: DraftMetadata = {
        draftId: 'draft-1',
        lastSavedAt: '2025-01-01T12:00:00.000Z',
        createdAt: '2025-01-01T11:00:00.000Z',
        itemCount: 2,
        currentStep: 1,
      };
      localStorage.setItem('dispute-wizard-draft', JSON.stringify(mockDraft));
      localStorage.setItem('dispute-wizard-metadata', JSON.stringify(mockMetadata));

      const { result } = renderHook(() => useWizardDraft('client-1'));

      act(() => {
        result.current.loadDraft();
      });

      expect(result.current.lastSavedAt).toBeInstanceOf(Date);
      expect(result.current.lastSavedAt?.toISOString()).toBe('2025-01-01T12:00:00.000Z');
    });

    it('should handle malformed JSON gracefully', () => {
      localStorage.setItem('dispute-wizard-draft', 'invalid json {');

      const { result } = renderHook(() => useWizardDraft());
      const draft = result.current.loadDraft();

      expect(draft).toBeNull();
    });
  });

  describe('saveDraft', () => {
    it('should save draft to localStorage', async () => {
      const { result } = renderHook(() => useWizardDraft('client-1'));
      const mockDraft: WizardDraftData = {
        selectedClientId: 'client-1',
        selectedItems: ['item-1'],
        currentStep: 2,
      };

      fetchMock.mockResolvedValueOnce({ ok: true });

      await act(async () => {
        await result.current.saveDraft(mockDraft);
      });

      const stored = localStorage.getItem('dispute-wizard-draft');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(mockDraft);
    });

    it('should save metadata to localStorage', async () => {
      const { result } = renderHook(() => useWizardDraft('client-1'));
      const mockDraft: WizardDraftData = {
        selectedClientId: 'client-1',
        selectedItems: ['item-1', 'item-2'],
        selectedPersonalItems: ['pi-1'],
        currentStep: 2,
      };

      fetchMock.mockResolvedValueOnce({ ok: true });

      await act(async () => {
        await result.current.saveDraft(mockDraft, { clientName: 'John Doe' });
      });

      const storedMetadata = localStorage.getItem('dispute-wizard-metadata');
      expect(storedMetadata).toBeTruthy();

      const metadata = JSON.parse(storedMetadata!) as DraftMetadata;
      expect(metadata.clientId).toBe('client-1');
      expect(metadata.clientName).toBe('John Doe');
      expect(metadata.itemCount).toBe(3); // 2 items + 1 personal item
      expect(metadata.currentStep).toBe(2);
      expect(metadata.lastSavedAt).toBeTruthy();
    });

    it('should update lastSavedAt state', async () => {
      const { result } = renderHook(() => useWizardDraft('client-1'));
      const mockDraft: WizardDraftData = { selectedClientId: 'client-1' };

      fetchMock.mockResolvedValueOnce({ ok: true });

      expect(result.current.lastSavedAt).toBeNull();

      await act(async () => {
        await result.current.saveDraft(mockDraft);
      });

      expect(result.current.lastSavedAt).toBeInstanceOf(Date);
    });

    it('should gracefully handle database save failure', async () => {
      const { result } = renderHook(() => useWizardDraft('client-1'));
      const mockDraft: WizardDraftData = { selectedClientId: 'client-1' };

      // Mock fetch to reject
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      // Should not throw error
      await act(async () => {
        await result.current.saveDraft(mockDraft);
      });

      // LocalStorage should still be updated
      const stored = localStorage.getItem('dispute-wizard-draft');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(mockDraft);
    });

    it('should prevent concurrent saves', async () => {
      const { result } = renderHook(() => useWizardDraft('client-1'));
      const mockDraft: WizardDraftData = { selectedClientId: 'client-1' };

      fetchMock.mockResolvedValue({ ok: true });

      // Trigger two saves simultaneously
      await act(async () => {
        const promise1 = result.current.saveDraft(mockDraft);
        const promise2 = result.current.saveDraft(mockDraft);
        await Promise.all([promise1, promise2]);
      });

      // Fetch should only be called once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should call database API with correct payload', async () => {
      const { result } = renderHook(() => useWizardDraft('client-1'));
      const mockDraft: WizardDraftData = {
        selectedClientId: 'client-1',
        selectedItems: ['item-1'],
      };

      fetchMock.mockResolvedValueOnce({ ok: true });

      await act(async () => {
        await result.current.saveDraft(mockDraft);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/disputes/draft',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('client-1'),
        })
      );
    });
  });

  describe('setupAutoSave', () => {
    it('should setup auto-save interval', () => {
      const { result } = renderHook(() => useWizardDraft('client-1'));
      const mockDraft: WizardDraftData = { selectedClientId: 'client-1' };

      fetchMock.mockResolvedValue({ ok: true });

      act(() => {
        result.current.setupAutoSave(mockDraft);
      });

      // Advance time by 30 seconds
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      // Should have saved to localStorage
      const stored = localStorage.getItem('dispute-wizard-draft');
      expect(stored).toBeTruthy();
    });

    it('should trigger save at 30 second intervals', async () => {
      const { result } = renderHook(() => useWizardDraft('client-1'));
      const mockDraft: WizardDraftData = { selectedClientId: 'client-1' };

      fetchMock.mockResolvedValue({ ok: true });

      act(() => {
        result.current.setupAutoSave(mockDraft);
      });

      // First interval - 30 seconds
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second interval - 30 more seconds
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should clear previous timer when setting up new auto-save', () => {
      const { result } = renderHook(() => useWizardDraft('client-1'));
      const mockDraft1: WizardDraftData = { selectedClientId: 'client-1', currentStep: 1 };
      const mockDraft2: WizardDraftData = { selectedClientId: 'client-1', currentStep: 2 };

      fetchMock.mockResolvedValue({ ok: true });

      act(() => {
        result.current.setupAutoSave(mockDraft1);
      });

      // Set up new auto-save before first interval fires
      act(() => {
        vi.advanceTimersByTime(15000); // 15 seconds
        result.current.setupAutoSave(mockDraft2);
      });

      // Advance to 30 seconds from second setup
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      // Should only save mockDraft2, not mockDraft1
      const stored = localStorage.getItem('dispute-wizard-draft');
      const savedDraft = JSON.parse(stored!) as WizardDraftData;
      expect(savedDraft.currentStep).toBe(2);
    });
  });

  describe('clearDraft', () => {
    it('should remove draft from localStorage', () => {
      const mockDraft: WizardDraftData = { selectedClientId: 'client-1' };
      localStorage.setItem('dispute-wizard-draft', JSON.stringify(mockDraft));
      localStorage.setItem('dispute-wizard-metadata', JSON.stringify({}));

      const { result } = renderHook(() => useWizardDraft('client-1'));

      fetchMock.mockResolvedValueOnce({ ok: true });

      act(() => {
        result.current.clearDraft();
      });

      expect(localStorage.getItem('dispute-wizard-draft')).toBeNull();
      expect(localStorage.getItem('dispute-wizard-metadata')).toBeNull();
    });

    it('should update state when clearing draft', () => {
      const mockDraft: WizardDraftData = { selectedClientId: 'client-1' };
      localStorage.setItem('dispute-wizard-draft', JSON.stringify(mockDraft));

      const { result } = renderHook(() => useWizardDraft('client-1'));

      fetchMock.mockResolvedValueOnce({ ok: true });

      // Load draft first
      act(() => {
        result.current.loadDraft();
      });
      expect(result.current.draftExists).toBe(true);

      act(() => {
        result.current.clearDraft();
      });

      expect(result.current.draftExists).toBe(false);
      expect(result.current.lastSavedAt).toBeNull();
    });

    it('should call DELETE API to remove draft from database', () => {
      const { result } = renderHook(() => useWizardDraft('client-1'));

      fetchMock.mockResolvedValueOnce({ ok: true });

      act(() => {
        result.current.clearDraft();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/disputes/draft',
        expect.objectContaining({
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should handle database deletion failure gracefully', () => {
      const { result } = renderHook(() => useWizardDraft('client-1'));

      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      // Should not throw error
      expect(() => {
        act(() => {
          result.current.clearDraft();
        });
      }).not.toThrow();

      // localStorage should still be cleared
      expect(localStorage.getItem('dispute-wizard-draft')).toBeNull();
    });
  });

  describe('getLastSavedText', () => {
    it('should return "Never" when no save has occurred', () => {
      const { result } = renderHook(() => useWizardDraft());
      expect(result.current.getLastSavedText()).toBe('Never');
    });

    it('should return "Just now" for recent save (< 60 seconds)', async () => {
      const { result } = renderHook(() => useWizardDraft('client-1'));
      const mockDraft: WizardDraftData = { selectedClientId: 'client-1' };

      fetchMock.mockResolvedValueOnce({ ok: true });

      await act(async () => {
        await result.current.saveDraft(mockDraft);
      });

      // Advance time by 30 seconds
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      expect(result.current.getLastSavedText()).toBe('Just now');
    });

    it('should return minutes for saves between 1-59 minutes', async () => {
      const { result } = renderHook(() => useWizardDraft('client-1'));
      const mockDraft: WizardDraftData = { selectedClientId: 'client-1' };

      fetchMock.mockResolvedValueOnce({ ok: true });

      await act(async () => {
        await result.current.saveDraft(mockDraft);
      });

      // Advance time by 5 minutes
      act(() => {
        vi.advanceTimersByTime(5 * 60 * 1000);
      });

      expect(result.current.getLastSavedText()).toBe('5 minutes ago');
    });

    it('should return "1 minute ago" (singular) for exactly 1 minute', async () => {
      const { result } = renderHook(() => useWizardDraft('client-1'));
      const mockDraft: WizardDraftData = { selectedClientId: 'client-1' };

      fetchMock.mockResolvedValueOnce({ ok: true });

      await act(async () => {
        await result.current.saveDraft(mockDraft);
      });

      // Advance time by 1 minute
      act(() => {
        vi.advanceTimersByTime(60 * 1000);
      });

      expect(result.current.getLastSavedText()).toBe('1 minute ago');
    });

    it('should return hours for saves between 1-23 hours', async () => {
      const { result } = renderHook(() => useWizardDraft('client-1'));
      const mockDraft: WizardDraftData = { selectedClientId: 'client-1' };

      fetchMock.mockResolvedValueOnce({ ok: true });

      await act(async () => {
        await result.current.saveDraft(mockDraft);
      });

      // Advance time by 2 hours
      act(() => {
        vi.advanceTimersByTime(2 * 60 * 60 * 1000);
      });

      expect(result.current.getLastSavedText()).toBe('2 hours ago');
    });

    it('should return formatted date for saves older than 24 hours', async () => {
      const { result } = renderHook(() => useWizardDraft('client-1'));
      const mockDraft: WizardDraftData = { selectedClientId: 'client-1' };

      fetchMock.mockResolvedValueOnce({ ok: true });

      await act(async () => {
        await result.current.saveDraft(mockDraft);
      });

      // Advance time by 25 hours
      act(() => {
        vi.advanceTimersByTime(25 * 60 * 60 * 1000);
      });

      const text = result.current.getLastSavedText();
      // Should contain date/time string (not "Just now" or "hours ago")
      expect(text).not.toBe('Never');
      expect(text).not.toContain('ago');
    });
  });

  describe('cleanup on unmount', () => {
    it('should clear auto-save timer on unmount', () => {
      const { result, unmount } = renderHook(() => useWizardDraft('client-1'));
      const mockDraft: WizardDraftData = { selectedClientId: 'client-1' };

      fetchMock.mockResolvedValue({ ok: true });

      act(() => {
        result.current.setupAutoSave(mockDraft);
      });

      // Unmount the hook
      unmount();

      // Advance time - timer should not fire
      act(() => {
        vi.advanceTimersByTime(60000); // 60 seconds
      });

      // Fetch should not have been called (timer was cleared)
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});

describe('recoverWizardDraft static function', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should return null when no draft exists', async () => {
    const result = await recoverWizardDraft();
    expect(result).toBeNull();
  });

  it('should recover draft from localStorage', async () => {
    const mockDraft: WizardDraftData = {
      selectedClientId: 'client-1',
      selectedItems: ['item-1'],
    };
    localStorage.setItem('dispute-wizard-draft', JSON.stringify(mockDraft));

    const result = await recoverWizardDraft('client-1');
    expect(result).toEqual(mockDraft);
  });

  it('should return null for different client', async () => {
    const mockDraft: WizardDraftData = {
      selectedClientId: 'client-1',
    };
    localStorage.setItem('dispute-wizard-draft', JSON.stringify(mockDraft));

    const result = await recoverWizardDraft('client-2');
    expect(result).toBeNull();
  });

  it('should handle malformed JSON gracefully', async () => {
    localStorage.setItem('dispute-wizard-draft', 'invalid json');
    const result = await recoverWizardDraft();
    expect(result).toBeNull();
  });
});

describe('getDraftMetadata static function', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should return null when no metadata exists', () => {
    const result = getDraftMetadata();
    expect(result).toBeNull();
  });

  it('should return metadata from localStorage', () => {
    const mockMetadata: DraftMetadata = {
      draftId: 'draft-1',
      clientId: 'client-1',
      clientName: 'John Doe',
      createdAt: '2025-01-01T10:00:00.000Z',
      lastSavedAt: '2025-01-01T12:00:00.000Z',
      itemCount: 5,
      currentStep: 3,
    };
    localStorage.setItem('dispute-wizard-metadata', JSON.stringify(mockMetadata));

    const result = getDraftMetadata();
    expect(result).toEqual(mockMetadata);
  });

  it('should handle malformed JSON gracefully', () => {
    localStorage.setItem('dispute-wizard-metadata', 'invalid json');
    const result = getDraftMetadata();
    expect(result).toBeNull();
  });
});

describe('hasDraft static function', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should return false when no draft exists', () => {
    expect(hasDraft()).toBe(false);
  });

  it('should return true when draft exists', () => {
    const mockDraft: WizardDraftData = {
      selectedClientId: 'client-1',
    };
    localStorage.setItem('dispute-wizard-draft', JSON.stringify(mockDraft));

    expect(hasDraft('client-1')).toBe(true);
  });

  it('should return false for different client', () => {
    const mockDraft: WizardDraftData = {
      selectedClientId: 'client-1',
    };
    localStorage.setItem('dispute-wizard-draft', JSON.stringify(mockDraft));

    expect(hasDraft('client-2')).toBe(false);
  });

  it('should handle malformed JSON gracefully', () => {
    localStorage.setItem('dispute-wizard-draft', 'invalid json');
    expect(hasDraft()).toBe(false);
  });
});
