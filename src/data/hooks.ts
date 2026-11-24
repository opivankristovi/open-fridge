import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { subDays } from 'date-fns';

import { useAuth } from '../auth/AuthProvider';
import { requestResync } from '../services/notifications';
import type { ShelfOverrides } from '../domain/shelfLife';
import type { LocationKind } from '../types/db';
import {
  getHouseholdSettings,
  listMembers,
  updateShelfDefaults,
} from './householdRepo';
import {
  createItem,
  deleteItem,
  getItem,
  listInStock,
  listRemovedSince,
  markOpened,
  moveItem,
  removeItem,
  restoreItem,
  updateItem,
  type ItemPatch,
  type NewItemInput,
} from './itemsRepo';
import {
  createLocation,
  deleteLocation,
  listLocations,
  updateLocation,
} from './locationsRepo';
import { getProduct } from './productsRepo';

export function useHouseholdId(): string | null {
  return useAuth().household?.id ?? null;
}

export function useStockItems() {
  const hid = useHouseholdId();
  return useQuery({
    queryKey: ['items', hid, 'stock'],
    queryFn: () => listInStock(hid as string),
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

export function useUpdateShelfDefaults() {
  const hid = useHouseholdId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shelf: ShelfOverrides) => updateShelfDefaults(hid as string, shelf),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', hid] }),
  });
}

export function useLocations() {
  const hid = useHouseholdId();
  return useQuery({
    queryKey: ['locations', hid],
    queryFn: () => listLocations(hid as string),
    enabled: !!hid,
  });
}

export function useCreateLocation() {
  const hid = useHouseholdId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string | null; kind: LocationKind }) =>
      createLocation({ household_id: hid as string, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations', hid] }),
  });
}

export function useUpdateLocation() {
  const hid = useHouseholdId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { name?: string | null; kind?: LocationKind } }) =>
      updateLocation(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations', hid] }),
  });
}

export function useDeleteLocation() {
  const hid = useHouseholdId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, moveTo }: { id: string; moveTo: string | null }) => deleteLocation(id, moveTo),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['locations', hid] }),
        qc.invalidateQueries({ queryKey: ['items', hid] }),
      ]);
      requestResync();
    },
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

export function useMoveItem() {
  const after = useAfterItemChange();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof moveItem>[1] }) =>
      moveItem(id, patch),
    onSuccess: after,
  });
}

export function useMarkOpened() {
  const after = useAfterItemChange();
  return useMutation({
    mutationFn: ({ id, shelfDays }: { id: string; shelfDays: number | null }) => markOpened(id, shelfDays),
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
