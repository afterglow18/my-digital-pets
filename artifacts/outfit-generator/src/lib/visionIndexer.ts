/**
 * visionIndexer.ts — background vision analysis queue.
 *
 * Runs once on app start to index all un-analyzed items, then can be called
 * immediately for newly added / updated items.
 *
 * Version scheme:
 *   0  = unanalyzed
 *   1  = iOS Vision only, no canvas colors (legacy — must re-index)
 *   2  = iOS Vision + canvas colors (current iOS target)
 *   4  = web canvas OK
 *   5  = web analyzed, no labels found (skip retry)
 *
 * On web: re-index anything with visionVersion < 4 (0, 1, 2, 3).
 * On iOS: re-index anything with visionVersion < 2 (0 or 1).
 */

import { Capacitor } from "@capacitor/core";
import { listClothing, updateClothingItem } from "./localDB";
import {
  extractWebColors,
  extractIOSVision,
  WEB_VISION_VERSION,
  WEB_NO_LABELS_VERSION,
  IOS_VISION_VERSION,
} from "./visionExtractor";
import { toast } from "@/hooks/use-toast";

// ── State ─────────────────────────────────────────────────────────────────────

let _started    = false;
const _queue    = new Set<number>(); // item IDs pending immediate processing
let   _running  = false;

// ── Internal helpers ──────────────────────────────────────────────────────────

async function analyzeItem(itemId: number): Promise<void> {
  const { getClothingItem } = await import("./localDB");
  const item = await getClothingItem(itemId);
  if (!item?.imageObjectPath) return; // no photo — skip

  const isIOS = Capacitor.isNativePlatform();

  if (isIOS) {
    const { labels, text } = await extractIOSVision(item.imageObjectPath);
    await updateClothingItem(itemId, {
      visionLabels:  labels,
      visionText:    text,
      visionVersion: IOS_VISION_VERSION,
    } as any);
  } else {
    const colors = await extractWebColors(item.imageObjectPath);
    await updateClothingItem(itemId, {
      visionLabels:  colors,
      visionText:    [],
      visionVersion: colors.length > 0 ? WEB_VISION_VERSION : WEB_NO_LABELS_VERSION,
    } as any);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Queue a single item for immediate analysis (e.g. after a photo is added).
 * Safe to call before startVisionIndexer.
 */
export function queueItemForIndexing(itemId: number): void {
  _queue.add(itemId);
  if (_started && !_running) {
    void drainQueue();
  }
}

async function drainQueue(): Promise<void> {
  if (_running || _queue.size === 0) return;
  _running = true;
  try {
    while (_queue.size > 0) {
      const [id] = _queue;
      _queue.delete(id);
      try { await analyzeItem(id); } catch { /* silent */ }
      if (_queue.size > 0) await delay(350);
    }
  } finally {
    _running = false;
  }
}

/**
 * Start the background indexer. Call once on app mount.
 * Idempotent — safe to call multiple times.
 */
export async function startVisionIndexer(): Promise<void> {
  if (_started) return;
  _started = true;

  try {
    const allItems = await listClothing();
    const isIOS    = Capacitor.isNativePlatform();
    const minVersion = isIOS ? IOS_VISION_VERSION : WEB_VISION_VERSION;

    const needsIndexing = allItems.filter((item) => {
      const v = (item as any).visionVersion as number | undefined;
      // Skip items at or above the current platform version
      if (v !== undefined && v >= minVersion) return false;
      // Skip web no-labels (version 5) — don't retry
      if (!isIOS && v === WEB_NO_LABELS_VERSION) return false;
      // Must have a photo
      return !!item.imageObjectPath;
    });

    if (needsIndexing.length === 0) return;

    // Non-blocking toast
    const { dismiss } = toast({
      title:       "Preparing photo search…",
      description: `Indexing ${needsIndexing.length} photo${needsIndexing.length !== 1 ? "s" : ""}`,
      duration:    60_000,
    });

    for (const item of needsIndexing) {
      try { await analyzeItem(item.id); } catch { /* silent */ }
      await delay(350);
    }

    dismiss();

    // Drain any items queued while startup was running
    if (_queue.size > 0) void drainQueue();
  } catch {
    // Silent — indexer failure must never break the app
  }
}
