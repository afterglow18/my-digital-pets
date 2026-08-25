/**
 * Local IndexedDB database for My Digital Pets.
 *
 * Works in both the browser (Replit preview) and in the Capacitor iOS WebView —
 * IndexedDB is natively available in both environments and persists to the
 * app's sandboxed storage on-device.
 *
 * Schema v3:
 *   clothing_items  — wardrobe items with embedded image data URLs
 *   saved_outfits   — named outfit collections
 *   outfit_items    — junction: outfit ↔ clothing item
 *   settings        — key/value store for app preferences
 *   care_logs       — dated quantity entries for pet ↔ care item usage
 *   care_totals     — optional per-pet/item total corrections
 */

import { openDB, type IDBPDatabase } from "idb";

export const DB_NAME    = "my-digital-pets";
export const DB_VERSION = 3;

// ── Stored types (IndexedDB records) ─────────────────────────────────────────

export interface StoredClothingItem {
  id?:            number;        // auto-incremented
  name:           string;
  category:       string;        // "outfits" | "beauty" | "toiletries" | "essentials"
  imageObjectPath: string | null; // JPEG data URL  (e.g. "data:image/jpeg;base64,...")
  isFavorite:     boolean;
  timesWorn:      number;
  bgRemoved?:     boolean;          // true once background removal has been confirmed
  lastWalkedDate?: string | null;   // "YYYY-MM-DD" local date of last walk log; null if never
  color?:         string | null;
  brand?:         string | null;
  size?:          string | null;
  season?:        string | null;
  occasion?:      string | null;
  purchasePrice?: string | null;
  purchaseDate?:  string | null;
  notes?:         string | null;
  // Vision indexing fields (added in DB v2 — absent on old records, treated as defaults)
  visionLabels?:  string[] | null;  // color/object labels extracted from the photo
  visionText?:    string[] | null;  // OCR text detected inside the photo
  visionVersion?: number;           // 0=unanalyzed, 1=iOS, 4=web OK, 5=web/no labels
  createdAt:      string;
  updatedAt:      string;
}

export interface StoredOutfit {
  id?:       number;
  name:      string;
  notes?:    string | null;
  createdAt: string;
}

export interface StoredOutfitItem {
  id?:             number;
  outfitId:        number;
  clothingItemId:  number;
}

export interface StoredSetting {
  key:   string;
  value: string;
}

export interface StoredCareLog {
  petId:       number;
  itemId:      number;
  date:        string; // local "YYYY-MM-DD"
  quantity:    number;
  createdAt:   string;
  updatedAt:   string;
}

export interface StoredCareTotal {
  petId:       number;
  itemId:      number;
  total:       number;
  updatedAt:   string;
}

export interface CareItemSummary {
  item:          ClothingItem;
  todayQuantity: number;
  total:         number;
  lastLogged:    string | null;
}

export interface CarePetSummary {
  pet:           ClothingItem;
  todayQuantity: number;
  total:         number;
  lastLogged:    string | null;
}

// ── Public types (consumed by hooks and pages) ────────────────────────────────

export interface ClothingItem extends Required<StoredClothingItem> {
  id: number;
}

export interface SavedOutfit {
  id:        number;
  name:      string;
  notes?:    string | null;
  createdAt: string;
  items:     ClothingItem[];
}

// ── Singleton DB connection ───────────────────────────────────────────────────

let _db: IDBPDatabase | null = null;

export async function getDB(): Promise<IDBPDatabase> {
  if (_db) return _db;

  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // clothing_items
      if (!db.objectStoreNames.contains("clothing_items")) {
        const store = db.createObjectStore("clothing_items", {
          keyPath:       "id",
          autoIncrement: true,
        });
        store.createIndex("by_category", "category");
        store.createIndex("by_favorite", "isFavorite");
      }

      // saved_outfits
      if (!db.objectStoreNames.contains("saved_outfits")) {
        db.createObjectStore("saved_outfits", {
          keyPath:       "id",
          autoIncrement: true,
        });
      }

      // outfit_items
      if (!db.objectStoreNames.contains("outfit_items")) {
        const store = db.createObjectStore("outfit_items", {
          keyPath:       "id",
          autoIncrement: true,
        });
        store.createIndex("by_outfit", "outfitId");
        store.createIndex("by_item",   "clothingItemId");
      }

      // settings
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }

      // care_logs — one row per pet, item, and local calendar day
      if (!db.objectStoreNames.contains("care_logs")) {
        const store = db.createObjectStore("care_logs", {
          keyPath: ["petId", "itemId", "date"],
        });
        store.createIndex("by_pet", ["petId"]);
        store.createIndex("by_item", ["itemId"]);
        store.createIndex("by_pet_item", ["petId", "itemId"]);
      }

      // care_totals — only present when a user manually corrects a total
      if (!db.objectStoreNames.contains("care_totals")) {
        const store = db.createObjectStore("care_totals", {
          keyPath: ["petId", "itemId"],
        });
        store.createIndex("by_pet", ["petId"]);
        store.createIndex("by_item", ["itemId"]);
      }
    },

    blocked() {
      console.warn("[DB] Upgrade blocked — close other tabs");
    },

    blocking() {
      _db?.close();
      _db = null;
    },
  });

  return _db;
}
