import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { subDays } from 'date-fns';

import { useAuth } from '../auth/AuthProvider';
import { requestResync } from '../services/notifications';
import type { HouseholdSettings } from '../types/db';
import {
  getHouseholdSettings,
  listMembers,
  updateCategoryDefaults,
} from './householdRepo';
import {
  createItem,
  deleteItem,
  getItem,
  listInFridge,
  listRemovedSince,
  markOpened,
  removeItem,
  restoreItem,
  updateItem,
  type ItemPatch,
  type NewItemInput,
} from './itemsRepo';
import { getProduct } from './productsRepo';

export function useHouseholdId(): string | null {
  return useAuth().household?.id ?? null;
}

export function useFridgeItems() {
  const hid = useHouseholdId();
  return useQuery({
    queryKey: ['items', hid, 'fridge'],
    queryFn: () => listInFridge(hid as string),
    enabled: !!hid,
  });
}

export function useItem(id: string | undefined) {
  const hid = useHouseholdId();
  return useQuery({
    queryKey: ['items', hid, 'item', id],
    queryFn: () => getItem(id as string),
    enabled: !!hid && !!id,
  });
}

export function useHistory(days = 30) {
  const hid = useHouseholdId();
  return useQuery({
    queryKey: ['items', hid, 'history', days],
    queryFn: () => listRemovedSince(hid as string, subDays(new Date(), days).toISOString()),
    enabled: !!hid,
  });
}

export function useMembers() {
  const hid = useHouseholdId();
  return useQuery({
    queryKey: ['members', hid],
    queryFn: () => listMembers(hid as string),
    enabled: !!hid,
    staleTime: 5 * 60_000,
  });
}

export function useHouseholdSettings() {
  const hid = useHouseholdId();
  return useQuery({
    queryKey: ['settings', hid],
    queryFn: () => getHouseholdSettings(hid as string),
    enabled: !!hid,
  });
}

export function useProduct(barcode: string | null | undefined) {
  const hid = useHouseholdId();
  return useQuery({
    queryKey: ['products', hid, barcode],
    queryFn: () => getProduct(hid as string, barcode as string),
    enabled: !!hid && !!barcode,
  });
}

export function useUpdateCategoryDefaults() {
  const hid = useHouseholdId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (defaults: HouseholdSettings['category_defaults']) =>
      updateCategoryDefaults(hid as string, defaults),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', hid] }),
  });
}

/** Shared onSuccess for item mutations: refresh the caches, then reschedule notifications. */
function useAfterItemChange() {
  const hid = useHouseholdId();
  const qc = useQueryClient();
  return async () => {
    await qc.invalidateQueries({ queryKey: ['items', hid] });
    requestResync();
  };
}

export function useCreateItem() {
  const after = useAfterItemChange();
  return useMutation({ mutationFn: (input: NewItemInput) => createItem(input), onSuccess: after });
}

export function useUpdateItem() {
  const after = useAfterItemChange();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ItemPatch }) => updateItem(id, patch),
    onSuccess: after,
  });
}

export function useMarkOpened() {
  const after = useAfterItemChange();
  return useMutation({
    mutationFn: ({ id, shelfDays }: { id: string; shelfDays: number }) => markOpened(id, shelfDays),
    onSuccess: after,
  });
}

export function useRemoveItem() {
  const after = useAfterItemChange();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'consumed' | 'discarded' }) =>
      removeItem(id, status),
    onSuccess: after,
  });
}

export function useRestoreItem() {
  const after = useAfterItemChange();
  return useMutation({ mutationFn: (id: string) => restoreItem(id), onSuccess: after });
}

export function useDeleteItem() {
  const after = useAfterItemChange();
  return useMutation({
    mutationFn: (item: Parameters<typeof deleteItem>[0]) => deleteItem(item),
    onSuccess: after,
  });
}
