import { create } from 'zustand';
import type { Item } from '@/lib/db/items';
import type { FilterState } from '@/components/FilterBar';

interface ItemStore {
  items: Item[];
  status: 'loading' | 'success' | 'error';
  error: string | null;
  query: string;
  filters: FilterState;
  selectedItemId: string | null;
  setItems: (items: Item[]) => void;
  addItem: (item: Item) => void;
  updateItemStatus: (itemId: string, status?: Item['status'], updates?: Partial<Item>) => void;
  setError: (error: string | null) => void;
  setQuery: (query: string) => void;
  setFilters: (filters: FilterState) => void;
  setSelectedItemId: (id: string | null) => void;
  
  // Async Business Logic Actions
  updateItemMetadata: (id: string, updates: Record<string, any>) => Promise<void>;
  retryItem: (id: string) => Promise<void>;
  resetStalledItem: (id: string) => Promise<void>;
  nukeArchive: () => Promise<void>;
}

export const useItemStore = create<ItemStore>((set, get) => ({
  items: [],
  status: 'loading',
  error: null,
  query: '',
  filters: { decision: null, high_value: false, category: null },
  selectedItemId: null,
  setItems: (items) => set({ items, status: 'success', error: null }),
  addItem: (item) => set((state) => {
    if (state.items.some(i => i.id === item.id)) return state;
    return { items: [item, ...state.items] };
  }),
  updateItemStatus: (itemId, status, updates) =>
    set((state) => {
      const itemIndex = state.items.findIndex((item) => item.id === itemId);
      if (itemIndex === -1) return state;

      const currentItem = state.items[itemIndex];
      const nextStatus = status || currentItem.status;
      
      // Optimization: If status and updates are the same as current, skip update
      const hasStatusChange = nextStatus !== currentItem.status;
      const hasUpdateChange = updates && Object.keys(updates).some(
        key => (updates as any)[key] !== (currentItem as any)[key]
      );

      if (!hasStatusChange && !hasUpdateChange) return state;

      const newItems = [...state.items];
      newItems[itemIndex] = { ...currentItem, status: nextStatus, ...updates };
      return { items: newItems };
    }),
  setError: (error) => set({ error, status: 'error' }),
  setQuery: (query) => set({ query }),
  setFilters: (filters) => set({ filters }),
  setSelectedItemId: (selectedItemId) => set({ selectedItemId }),

  updateItemMetadata: async (id, updates) => {
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Failed to update metadata');
      get().updateItemStatus(id, undefined, updates);
    } catch (err) {
      console.error('[Store] updateItemMetadata failed:', err);
      throw err;
    }
  },

  retryItem: async (id) => {
    try {
      const res = await fetch(`/api/items/${id}/retry`, { method: 'POST' });
      if (!res.ok) throw new Error('Retry failed');
      const data = await res.json();
      get().updateItemStatus(id, data.status);
    } catch (err) {
      console.error('[Store] retryItem failed:', err);
      throw err;
    }
  },

  resetStalledItem: async (id) => {
    try {
      const res = await fetch(`/api/items/${id}/reset`, { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed');
      const data = await res.json();
      get().updateItemStatus(id, data.status);
    } catch (err) {
      console.error('[Store] resetStalledItem failed:', err);
      throw err;
    }
  },

  nukeArchive: async () => {
    try {
      const res = await fetch('/api/system/nuke', { method: 'POST' });
      if (!res.ok) throw new Error("Nuke failed");
      set({ items: [] });
    } catch (err) {
      console.error('[Store] nukeArchive failed:', err);
      throw err;
    }
  },
}));
