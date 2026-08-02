/**
 * searchWardrobe.ts — offline full-text search across wardrobe items and groups.
 *
 * Scoring weights (higher = more important):
 *   name / brand         → 10 / 8
 *   color / category     → 5 / 4
 *   notes / size         → 4 / 3
 *   season / occasion    → 3 / 3
 *   purchasePrice/Date   → 2 / 2
 *   visionLabels / text  → 1 / 1
 *
 * A group matches if its name, notes, or any member item matches the query.
 */

import type { ClothingItem, SavedOutfit } from "@/lib/db";

export interface SearchResults {
  items: ClothingItem[];
  groups: SavedOutfit[];
}

type ScoredItem = { item: ClothingItem; score: number };

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().trim();
}

/**
 * Return a score > 0 if `value` contains any word from the query.
 * Exact substring match scores `weight`; full match scores `weight * 2`.
 */
function scoreField(value: string | null | undefined, terms: string[], weight: number): number {
  const v = normalize(value);
  if (!v) return 0;
  let score = 0;
  for (const term of terms) {
    if (!term) continue;
    if (v === term) score += weight * 2;
    else if (v.includes(term)) score += weight;
  }
  return score;
}

function scoreArrayField(values: string[] | null | undefined, terms: string[], weight: number): number {
  if (!values?.length) return 0;
  return values.reduce((sum, v) => sum + scoreField(v, terms, weight), 0);
}

// ── Item scoring ──────────────────────────────────────────────────────────────

function scoreItem(item: ClothingItem, terms: string[]): number {
  return (
    scoreField(item.name,          terms, 10) +
    scoreField(item.brand,         terms,  8) +
    scoreField(item.color,         terms,  5) +
    scoreField(item.category,      terms,  4) +
    scoreField(item.notes,         terms,  4) +
    scoreField(item.size,          terms,  3) +
    scoreField(item.season,        terms,  3) +
    scoreField(item.occasion,      terms,  3) +
    scoreField(item.purchasePrice, terms,  2) +
    scoreField(item.purchaseDate,  terms,  2) +
    scoreArrayField((item as any).visionLabels, terms, 1) +
    scoreArrayField((item as any).visionText,   terms, 1)
  );
}

// ── Main search function ──────────────────────────────────────────────────────

export function searchWardrobe(
  query: string,
  items: ClothingItem[],
  outfits: SavedOutfit[],
): SearchResults {
  const q = normalize(query);
  if (!q) return { items: [], groups: [] };

  // Split into individual terms, remove very short noise
  const terms = q.split(/\s+/).filter((t) => t.length >= 1);

  // ── Score items ────────────────────────────────────────────────────────────
  const scoredItems: ScoredItem[] = [];
  const itemScoreMap = new Map<number, number>();

  for (const item of items) {
    const score = scoreItem(item, terms);
    if (score > 0) {
      scoredItems.push({ item, score });
      itemScoreMap.set(item.id, score);
    }
  }

  scoredItems.sort((a, b) => b.score - a.score);
  const matchedItems = scoredItems.map((s) => s.item);

  // ── Score groups ───────────────────────────────────────────────────────────
  const matchedGroups: SavedOutfit[] = [];

  for (const outfit of outfits) {
    // Group matches by name or notes
    const groupScore =
      scoreField(outfit.name,  terms, 10) +
      scoreField(outfit.notes, terms,  4);

    // Or if any member item matches
    const memberMatch = outfit.items?.some((item) => (itemScoreMap.get(item.id) ?? 0) > 0);

    if (groupScore > 0 || memberMatch) {
      matchedGroups.push(outfit);
    }
  }

  // Deduplicate items (by id) — in case data is somehow duplicated
  const seenIds = new Set<number>();
  const deduped = matchedItems.filter((item) => {
    if (seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    return true;
  });

  return { items: deduped, groups: matchedGroups };
}
