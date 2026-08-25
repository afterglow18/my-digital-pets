/**
 * useLocalDB — React Query hooks that replace @workspace/api-client-react.
 *
 * All data lives in the device's IndexedDB (via src/lib/localDB.ts).
 * Mutation signatures deliberately mirror the old generated API client so
 * pages need only a one-line import change.
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import {
  listClothing,
  getClothingItem,
  createClothingItem,
  updateClothingItem,
  deleteClothingItem,
  getWardrobeStats,
  generateOutfit,
  listOutfits,
  saveOutfit,
  updateOutfit,
  deleteOutfit,
  addItemToOutfit,
  removeItemFromOutfit,
  listCareItems,
  listPetCareSummary,
  listCareItemPetSummary,
  setPetCareTodayQuantity,
  setPetCareLastLoggedDate,
  setPetCareTotal,
} from "@/lib/localDB";

export type { CareItemSummary, CarePetSummary, ClothingItem, SavedOutfit } from "@/lib/db";
import type { CareItemSummary, CarePetSummary, ClothingItem, SavedOutfit } from "@/lib/db";

// ── Query keys ────────────────────────────────────────────────────────────────

export function getListClothingQueryKey(params?: { category?: string }) {
  return params?.category
    ? ["clothing", { category: params.category }]
    : ["clothing"];
}

export function getListOutfitsQueryKey() {
  return ["outfits"];
}

export function getWardrobeStatsQueryKey() {
  return ["wardrobe-stats"];
}

export function getGetClothingItemQueryKey(id: number) {
  return ["clothing", id];
}

export function getListCareItemsQueryKey() {
  return ["care-items"];
}

export function getPetCareSummaryQueryKey(petId: number) {
  return ["pet-care", petId];
}

export function getCareItemPetSummaryQueryKey(itemId: number) {
  return ["care-item-pets", itemId];
}

// ── Clothing hooks ────────────────────────────────────────────────────────────

export function useListClothing(
  params?: { category?: string },
  options?: { query?: { enabled?: boolean; queryKey?: unknown[] } },
) {
  return useQuery<ClothingItem[], Error>({
    queryKey: options?.query?.queryKey ?? getListClothingQueryKey(params),
    queryFn:  () => listClothing(params?.category),
    staleTime: 0,
    enabled:  options?.query?.enabled !== false,
  });
}

export function useGetClothingItem(
  id: number,
  options?: { query?: { enabled?: boolean; queryKey?: unknown[] } },
) {
  return useQuery<ClothingItem | null, Error>({
    queryKey: options?.query?.queryKey ?? getGetClothingItemQueryKey(id),
    queryFn:  () => getClothingItem(id),
    enabled:  options?.query?.enabled !== false,
    staleTime: 0,
  });
}

export function useCreateClothingItem() {
  return useMutation<ClothingItem, Error, {
    data: {
      name:            string;
      category:        string;
      imageObjectPath?: string | null;
      color?:          string | null;
      brand?:          string | null;
      size?:           string | null;
      season?:         string | null;
      occasion?:       string | null;
      purchasePrice?:  string | null;
      purchaseDate?:   string | null;
      notes?:          string | null;
    };
  }>({
    mutationFn: ({ data }) => createClothingItem(data),
  });
}

export function useUpdateClothingItem() {
  return useMutation<ClothingItem, Error, {
    id:   number;
    data: Parameters<typeof updateClothingItem>[1];
  }>({
    mutationFn: ({ id, data }) => updateClothingItem(id, data),
  });
}

export function useDeleteClothingItem() {
  return useMutation<void, Error, { id: number }>({
    mutationFn: ({ id }) => deleteClothingItem(id),
  });
}

// ── Stats + generate ──────────────────────────────────────────────────────────

type WardrobeStats = {
  total:            number;
  byCategory:       { category: string; count: number }[];
  favorites:        number;
  outfitsGenerated: number;
};

export function useGetWardrobeStats() {
  return useQuery<WardrobeStats, Error>({
    queryKey: getWardrobeStatsQueryKey(),
    queryFn:  getWardrobeStats,
    staleTime: 0,
  });
}

export function useGenerateOutfit() {
  return useMutation<{ items: ClothingItem[] }, Error, { data: { excludeCategories?: string[] } }>({
    mutationFn: ({ data }) =>
      generateOutfit(data.excludeCategories ?? []).then((items) => ({ items })),
  });
}

// ── Outfit hooks ──────────────────────────────────────────────────────────────

export function useListOutfits(
  options?: { query?: { enabled?: boolean; queryKey?: unknown[] } },
) {
  return useQuery<SavedOutfit[], Error>({
    queryKey: options?.query?.queryKey ?? getListOutfitsQueryKey(),
    queryFn:  listOutfits,
    staleTime: 0,
    enabled:  options?.query?.enabled !== false,
  });
}

export function useSaveOutfit() {
  return useMutation<SavedOutfit, Error, { data: { name: string; itemIds: number[] } }>({
    mutationFn: ({ data }) => saveOutfit(data),
  });
}

export function useRenameOutfit() {
  return useMutation<void, Error, { id: number; data: { name?: string; notes?: string | null } }>({
    mutationFn: ({ id, data }) => updateOutfit(id, data),
  });
}

export function useDeleteOutfit() {
  return useMutation<void, Error, { id: number }>({
    mutationFn: ({ id }) => deleteOutfit(id),
  });
}

export function useAddItemToOutfit() {
  return useMutation<void, Error, { id: number; data: { itemId: number } }>({
    mutationFn: ({ id, data }) => addItemToOutfit(id, data.itemId),
  });
}

export function useRemoveItemFromOutfit() {
  return useMutation<void, Error, { id: number; itemId: number }>({
    mutationFn: ({ id, itemId }) => removeItemFromOutfit(id, itemId),
  });
}

// ── Per-pet care hooks ─────────────────────────────────────────────────────────

export function useListCareItems(
  options?: { query?: { enabled?: boolean; queryKey?: unknown[] } },
) {
  return useQuery<ClothingItem[], Error>({
    queryKey: options?.query?.queryKey ?? getListCareItemsQueryKey(),
    queryFn: listCareItems,
    staleTime: 0,
    enabled: options?.query?.enabled !== false,
  });
}

export function usePetCareSummary(
  petId: number,
  options?: { query?: { enabled?: boolean; queryKey?: unknown[] } },
) {
  return useQuery<CareItemSummary[], Error>({
    queryKey: options?.query?.queryKey ?? getPetCareSummaryQueryKey(petId),
    queryFn: () => listPetCareSummary(petId),
    staleTime: 0,
    enabled: (options?.query?.enabled !== false) && petId > 0,
  });
}

export function useCareItemPetSummary(
  itemId: number,
  options?: { query?: { enabled?: boolean; queryKey?: unknown[] } },
) {
  return useQuery<CarePetSummary[], Error>({
    queryKey: options?.query?.queryKey ?? getCareItemPetSummaryQueryKey(itemId),
    queryFn: () => listCareItemPetSummary(itemId),
    staleTime: 0,
    enabled: (options?.query?.enabled !== false) && itemId > 0,
  });
}

export function useSetPetCareTodayQuantity() {
  return useMutation<void, Error, { petId: number; itemId: number; quantity: number }>({
    mutationFn: ({ petId, itemId, quantity }) =>
      setPetCareTodayQuantity(petId, itemId, quantity),
  });
}

export function useSetPetCareLastLoggedDate() {
  return useMutation<void, Error, { petId: number; itemId: number; date: string }>({
    mutationFn: ({ petId, itemId, date }) =>
      setPetCareLastLoggedDate(petId, itemId, date),
  });
}

export function useSetPetCareTotal() {
  return useMutation<void, Error, { petId: number; itemId: number; total: number }>({
    mutationFn: ({ petId, itemId, total }) => setPetCareTotal(petId, itemId, total),
  });
}

// ── Runtime value + type for ClothingItemInputCategory ────────────────────────

/** Used by ClothingForm.tsx as z.nativeEnum(ClothingItemInputCategory) */
export const ClothingItemInputCategory = {
  outfits:    "outfits",
  beauty:     "beauty",
  toiletries: "toiletries",
  essentials: "essentials",
} as const;

// ── Type aliases kept for compatibility with old api-client-react consumers ───
export type ClothingItemCategory       = "outfits" | "beauty" | "toiletries" | "essentials";
export type ListClothingCategory        = ClothingItemCategory;
export type ClothingItemUpdateCategory  = ClothingItemCategory;
export type ClothingItemInputCategoryType = ClothingItemCategory;
