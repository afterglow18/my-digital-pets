/**
 * localDB — all CRUD operations on the IndexedDB database.
 *
 * Every function is async and returns plain objects (no reactive signals).
 * React Query hooks in useLocalDB.ts call these functions and handle caching.
 */

import {
  getDB,
  type CarePetSummary,
  type CareItemSummary,
  type ClothingItem,
  type SavedOutfit,
  type StoredCareLog,
  type StoredCareTotal,
  type StoredClothingItem,
  type StoredOutfit,
  type StoredOutfitItem,
} from "./db";

const CATEGORIES = ["outfits", "beauty", "toiletries", "essentials"] as const;

// ── Clothing items ────────────────────────────────────────────────────────────

export async function listClothing(category?: string): Promise<ClothingItem[]> {
  const db   = await getDB();
  const all  = category
    ? await db.getAllFromIndex("clothing_items", "by_category", category)
    : await db.getAll("clothing_items");

  return (all as ClothingItem[]).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getClothingItem(id: number): Promise<ClothingItem | null> {
  const db   = await getDB();
  const item = await db.get("clothing_items", id);
  return (item as ClothingItem) ?? null;
}

export async function createClothingItem(data: {
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
}): Promise<ClothingItem> {
  const db  = await getDB();
  const now = new Date().toISOString();

  const record: StoredClothingItem = {
    name:           data.name,
    category:       data.category,
    imageObjectPath: data.imageObjectPath ?? null,
    isFavorite:     false,
    timesWorn:      0,
    color:          data.color ?? null,
    brand:          data.brand ?? null,
    size:           data.size  ?? null,
    season:         data.season ?? null,
    occasion:       data.occasion ?? null,
    purchasePrice:  data.purchasePrice ?? null,
    purchaseDate:   data.purchaseDate  ?? null,
    notes:          data.notes ?? null,
    visionLabels:   [],
    visionText:     [],
    visionVersion:  0,
    createdAt:      now,
    updatedAt:      now,
  };

  const id = await db.add("clothing_items", record);
  return { ...record, id: id as number } as ClothingItem;
}

export async function updateClothingItem(
  id: number,
  updates: Partial<Omit<StoredClothingItem, "id" | "createdAt">>,
): Promise<ClothingItem> {
  const db       = await getDB();
  const existing = await db.get("clothing_items", id) as StoredClothingItem | undefined;
  if (!existing) throw new Error(`Clothing item ${id} not found`);

  const updated: StoredClothingItem = {
    ...existing,
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };

  await db.put("clothing_items", updated);
  return updated as ClothingItem;
}

export async function deleteClothingItem(id: number): Promise<void> {
  const db = await getDB();
  await db.delete("clothing_items", id);

  // Remove from any outfits
  const links = await db.getAllFromIndex("outfit_items", "by_item", id);
  const tx    = db.transaction("outfit_items", "readwrite");
  for (const link of links) {
    if (link.id != null) await tx.store.delete(link.id);
  }
  await tx.done;

  // Remove care history and corrections for this item.
  const careLogs = await db.getAllFromIndex("care_logs", "by_item", id) as StoredCareLog[];
  const careLogTx = db.transaction("care_logs", "readwrite");
  for (const log of careLogs) {
    await careLogTx.store.delete([log.petId, log.itemId, log.date]);
  }
  await careLogTx.done;

  const careTotals = await db.getAllFromIndex("care_totals", "by_item", id) as StoredCareTotal[];
  const careTotalTx = db.transaction("care_totals", "readwrite");
  for (const total of careTotals) {
    await careTotalTx.store.delete([total.petId, total.itemId]);
  }
  await careTotalTx.done;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getWardrobeStats() {
  const db      = await getDB();
  const all     = (await db.getAll("clothing_items")) as ClothingItem[];
  const outfits = (await db.getAll("saved_outfits")) as StoredOutfit[];

  const byCategory = CATEGORIES.map((cat) => ({
    category: cat,
    count:    all.filter((i) => i.category === cat).length,
  }));

  return {
    total:            all.length,
    byCategory,
    favorites:        all.filter((i) => i.isFavorite).length,
    outfitsGenerated: outfits.length,
  };
}

// ── Outfit generation (pure Math.random — no backend needed) ──────────────────

export async function generateOutfit(excludeCategories: string[] = []): Promise<ClothingItem[]> {
  const db          = await getDB();
  const all         = (await db.getAll("clothing_items")) as ClothingItem[];
  const active      = CATEGORIES.filter((c) => !excludeCategories.includes(c));
  const picked: ClothingItem[] = [];

  for (const cat of active) {
    const items = all.filter((i) => i.category === cat);
    if (items.length > 0) {
      picked.push(items[Math.floor(Math.random() * items.length)]);
    }
  }

  if (picked.length === 0) {
    throw new Error("Your pets is empty. Add some items first!");
  }

  return picked;
}

// ── Saved outfits ─────────────────────────────────────────────────────────────

async function hydrateOutfit(outfit: StoredOutfit & { id: number }): Promise<SavedOutfit> {
  const db    = await getDB();
  const links = (await db.getAllFromIndex("outfit_items", "by_outfit", outfit.id)) as StoredOutfitItem[];

  const items = await Promise.all(
    links.map((l) => db.get("clothing_items", l.clothingItemId))
  );

  return {
    id:        outfit.id,
    name:      outfit.name,
    notes:     outfit.notes ?? null,
    createdAt: outfit.createdAt,
    items:     items.filter(Boolean) as ClothingItem[],
  };
}

export async function listOutfits(): Promise<SavedOutfit[]> {
  const db      = await getDB();
  const outfits = (await db.getAll("saved_outfits")) as (StoredOutfit & { id: number })[];
  const sorted  = outfits.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return Promise.all(sorted.map(hydrateOutfit));
}

export async function saveOutfit(data: { name: string; itemIds: number[] }): Promise<SavedOutfit> {
  const db  = await getDB();
  const now = new Date().toISOString();

  const record: StoredOutfit = { name: data.name, notes: null, createdAt: now };
  const outfitId = (await db.add("saved_outfits", record)) as number;

  for (const itemId of data.itemIds) {
    const link: StoredOutfitItem = { outfitId, clothingItemId: itemId };
    await db.add("outfit_items", link);
  }

  return hydrateOutfit({ ...record, id: outfitId });
}

export async function updateOutfit(id: number, data: { name?: string; notes?: string | null }): Promise<void> {
  const db       = await getDB();
  const existing = await db.get("saved_outfits", id) as StoredOutfit | undefined;
  if (!existing) throw new Error(`Outfit ${id} not found`);

  await db.put("saved_outfits", { ...existing, ...data, id });
}

export async function deleteOutfit(id: number): Promise<void> {
  const db    = await getDB();
  const links = (await db.getAllFromIndex("outfit_items", "by_outfit", id)) as StoredOutfitItem[];

  await db.delete("saved_outfits", id);

  const tx = db.transaction("outfit_items", "readwrite");
  for (const link of links) {
    if (link.id != null) await tx.store.delete(link.id);
  }
  await tx.done;
}

export async function addItemToOutfit(outfitId: number, itemId: number): Promise<void> {
  const db    = await getDB();
  const links = (await db.getAllFromIndex("outfit_items", "by_outfit", outfitId)) as StoredOutfitItem[];

  // Prevent duplicates in the same outfit
  if (links.some((l) => l.clothingItemId === itemId)) return;

  const link: StoredOutfitItem = { outfitId, clothingItemId: itemId };
  await db.add("outfit_items", link);
}

export async function removeItemFromOutfit(outfitId: number, itemId: number): Promise<void> {
  const db    = await getDB();
  const links = (await db.getAllFromIndex("outfit_items", "by_outfit", outfitId)) as StoredOutfitItem[];
  const match = links.find((l) => l.clothingItemId === itemId);
  if (match?.id != null) await db.delete("outfit_items", match.id);
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const db  = await getDB();
  const row = await db.get("settings", key);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDB();
  await db.put("settings", { key, value });
}

// ── Per-pet care tracking ─────────────────────────────────────────────────────

const CARE_CATEGORIES = ["beauty", "toiletries"] as const;

function localDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function listCareItems(): Promise<ClothingItem[]> {
  const all = await listClothing();
  return all.filter((item) =>
    CARE_CATEGORIES.includes(item.category as (typeof CARE_CATEGORIES)[number]) &&
    item.name.trim().length > 0
  );
}

async function getCareLogs(petId: number, itemId: number): Promise<StoredCareLog[]> {
  const db = await getDB();
  return await db.getAllFromIndex("care_logs", "by_pet_item", [petId, itemId]) as StoredCareLog[];
}

export async function listPetCareSummary(petId: number): Promise<CareItemSummary[]> {
  if (!petId) return [];
  const db = await getDB();
  const items = await listCareItems();
  const result: CareItemSummary[] = [];

  for (const item of items) {
    const logs = await getCareLogs(petId, item.id);
    const correction = await db.get("care_totals", [petId, item.id]) as StoredCareTotal | undefined;
    const rawTotal = logs.reduce((sum, log) => sum + Math.max(0, log.quantity), 0);
    const datedLogs = logs.filter((log) => log.quantity > 0).sort((a, b) => a.date.localeCompare(b.date));
    result.push({
      item,
      todayQuantity: logs.find((log) => log.date === localDateString())?.quantity ?? 0,
      total: correction?.total ?? rawTotal,
      lastLogged: datedLogs.at(-1)?.date ?? null,
    });
  }

  return result;
}

export async function listCareItemPetSummary(itemId: number): Promise<CarePetSummary[]> {
  if (!itemId) return [];
  const db = await getDB();
  const pets = await listClothing("outfits");
  const result: CarePetSummary[] = [];

  for (const pet of pets) {
    const logs = await getCareLogs(pet.id, itemId);
    const correction = await db.get("care_totals", [pet.id, itemId]) as StoredCareTotal | undefined;
    const rawTotal = logs.reduce((sum, log) => sum + Math.max(0, log.quantity), 0);
    const datedLogs = logs
      .filter((log) => log.quantity > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    result.push({
      pet,
      total: correction?.total ?? rawTotal,
      lastLogged: datedLogs.at(-1)?.date ?? null,
    });
  }

  return result;
}

export async function setPetCareTodayQuantity(
  petId: number,
  itemId: number,
  quantity: number,
): Promise<void> {
  if (!petId || !itemId) throw new Error("A pet and care item are required");
  const db = await getDB();
  const date = localDateString();
  const nextQuantity = Math.max(0, Math.floor(quantity));
  const existing = await db.get("care_logs", [petId, itemId, date]) as StoredCareLog | undefined;
  const previousQuantity = existing?.quantity ?? 0;
  const now = new Date().toISOString();

  if (nextQuantity === 0) {
    if (existing) await db.delete("care_logs", [petId, itemId, date]);
  } else {
    await db.put("care_logs", {
      petId,
      itemId,
      date,
      quantity: nextQuantity,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    } satisfies StoredCareLog);
  }

  // Preserve a manual correction while applying today's usage delta.
  const correction = await db.get("care_totals", [petId, itemId]) as StoredCareTotal | undefined;
  if (correction && previousQuantity !== nextQuantity) {
    await db.put("care_totals", {
      ...correction,
      total: Math.max(0, correction.total + nextQuantity - previousQuantity),
      updatedAt: now,
    } satisfies StoredCareTotal);
  }
}

export async function setPetCareTotal(
  petId: number,
  itemId: number,
  total: number,
): Promise<void> {
  if (!petId || !itemId) throw new Error("A pet and care item are required");
  const db = await getDB();
  const nextTotal = Math.max(0, Math.floor(total));
  const logs = await getCareLogs(petId, itemId);
  const rawTotal = logs.reduce((sum, log) => sum + Math.max(0, log.quantity), 0);
  const key: [number, number] = [petId, itemId];

  if (nextTotal === rawTotal) {
    await db.delete("care_totals", key);
  } else {
    await db.put("care_totals", {
      petId,
      itemId,
      total: nextTotal,
      updatedAt: new Date().toISOString(),
    } satisfies StoredCareTotal);
  }
}
