"use client";

import { useQuery } from '@tanstack/react-query';
import { useItemStore } from '@/store/itemStore';
import { useEffect } from 'react';

export function useItems() {
  const { query, filters, setItems, items } = useItemStore();

  const hasProcessing = items.some(i => 
    !['complete', 'error'].includes(i.status)
  );

  const fetchItems = async () => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (filters.decision) params.set('decision', filters.decision);
    if (filters.high_value) params.set('high_value', '1');
    if (filters.category) params.set('category', filters.category);

    const res = await fetch(`/api/items?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch items');
    const data = await res.json();
    return data.data || [];
  };

  const queryResult = useQuery({
    queryKey: ['items', query, filters],
    queryFn: fetchItems,
    refetchInterval: hasProcessing ? 3000 : 20000,
  });

  // Sync with Zustand store
  useEffect(() => {
    if (queryResult.data) {
      setItems(queryResult.data);
    }
  }, [queryResult.data, setItems]);

  return queryResult;
}
