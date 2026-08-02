/**
 * visionExtractor.ts
 *
 * Two extraction paths:
 *   1. Web — canvas-based dominant-color analysis (48×48, corner bg exclusion)
 *   2. iOS — Capacitor Swift plugin (VNClassifyImageRequest + VNRecognizeTextRequest)
 *
 * Version scheme:
 *   0  = unanalyzed
 *   1  = iOS Vision OK
 *   4  = web canvas OK
 *   5  = web analyzed but no labels found (skip retry)
 */

import { registerPlugin, Capacitor } from "@capacitor/core";

// ── iOS Vision plugin contract ─────────────────────────────────────────────────

interface VisionPluginInterface {
  analyze(options: { imageBase64: string }): Promise<{ labels: string[]; text: string[] }>;
}

const VisionPlugin = registerPlugin<VisionPluginInterface>("Vision");

export const WEB_VISION_VERSION     = 4;
export const WEB_NO_LABELS_VERSION  = 5;
export const IOS_VISION_VERSION     = 1;

// ── iOS Vision ────────────────────────────────────────────────────────────────

/**
 * Call the Swift Capacitor plugin. Returns { labels, text }; on any failure
 * returns empty arrays (silent fallback as spec'd).
 */
export async function extractIOSVision(
  imageDataUrl: string,
): Promise<{ labels: string[]; text: string[] }> {
  if (!Capacitor.isNativePlatform()) return { labels: [], text: [] };
  try {
    // Strip the data-url prefix — plugin expects raw base64
    const base64 = imageDataUrl.replace(/^data:[^;]+;base64,/, "");
    return await VisionPlugin.analyze({ imageBase64: base64 });
  } catch {
    return { labels: [], text: [] };
  }
}

// ── Web canvas color extraction ───────────────────────────────────────────────

function brightness(r: number, g: number, b: number): number {
  return (r + g + b) / 3;
}

/** Returns 0–360 hue from RGB (0–255 each). */
function hue(r: number, g: number, b: number): number {
  const rf = r / 255, gf = g / 255, bf = b / 255;
  const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
  if (max === min) return 0;
  const d = max - min;
  let h = 0;
  if (max === rf) h = ((gf - bf) / d + (gf < bf ? 6 : 0)) / 6;
  else if (max === gf) h = ((bf - rf) / d + 2) / 6;
  else h = ((rf - gf) / d + 4) / 6;
  return h * 360;
}

function saturation(r: number, g: number, b: number): number {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

/** Map an RGB pixel to one of the 16 color names. */
function rgbToColorName(r: number, g: number, b: number): string {
  const bri = brightness(r, g, b);
  const sat = saturation(r, g, b);

  // Neutral / greyscale (low saturation)
  if (sat < 40) {
    if (bri < 80)  return "black";
    if (bri < 110) return "dark grey";
    if (bri < 175) return "grey";
    if (bri < 225) return "light grey";
    return "white";
  }

  // Earthy tones (moderate saturation, warm cast)
  if (sat < 80 && r > g && r > b) {
    if (bri < 100) return "brown";
    if (bri < 145) return "tan";
    return "beige";
  }

  // Vivid colors — go by hue
  const h = hue(r, g, b);
  if (h < 15 || h >= 345) return "red";
  if (h < 45)  return "orange";
  if (h < 75)  return "yellow";
  if (h < 165) return "green";
  if (h < 195) return "teal";
  if (h < 255) return "blue";
  if (h < 285) return "purple";
  if (h < 345) return "pink";
  return "red";
}

/** Are two RGBA pixels "close enough" to be considered the same background color? */
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}

/**
 * Extract dominant visible colors from a data-URL image using a 48×48 canvas.
 *
 * 1. Draw image onto 48×48 canvas
 * 2. Sample 4×4 corner patches to detect the studio background
 * 3. Exclude pixels that match the background
 * 4. Map surviving pixels to color names
 * 5. Return names covering ≥10% of foreground pixels
 */
export async function extractWebColors(imageDataUrl: string): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const SIZE = 48;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve([]); return; }

        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

        // ── 1. Detect background from 4×4 corners ────────────────────────────
        const CORNER = 4;
        type RGB = [number, number, number];

        function cornerAvg(startX: number, startY: number): RGB {
          let rt = 0, gt = 0, bt = 0, count = 0;
          for (let cy = startY; cy < startY + CORNER; cy++) {
            for (let cx = startX; cx < startX + CORNER; cx++) {
              const i = (cy * SIZE + cx) * 4;
              rt += data[i]; gt += data[i + 1]; bt += data[i + 2];
              count++;
            }
          }
          return [rt / count, gt / count, bt / count];
        }

        const corners: RGB[] = [
          cornerAvg(0, 0),
          cornerAvg(SIZE - CORNER, 0),
          cornerAvg(0, SIZE - CORNER),
          cornerAvg(SIZE - CORNER, SIZE - CORNER),
        ];

        // Average the corners for a single background estimate
        const bgR = corners.reduce((s, c) => s + c[0], 0) / 4;
        const bgG = corners.reduce((s, c) => s + c[1], 0) / 4;
        const bgB = corners.reduce((s, c) => s + c[2], 0) / 4;
        const BG_THRESHOLD = 40; // distance to be considered "background"

        // ── 2. Count foreground pixels by color name ──────────────────────────
        const colorCounts = new Map<string, number>();
        let fgTotal = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 32) continue; // transparent → skip
          if (colorDistance(r, g, b, bgR, bgG, bgB) < BG_THRESHOLD) continue; // background → skip

          fgTotal++;
          const name = rgbToColorName(r, g, b);
          colorCounts.set(name, (colorCounts.get(name) ?? 0) + 1);
        }

        if (fgTotal === 0) { resolve([]); return; }

        // ── 3. Keep colors covering ≥10% of foreground ────────────────────────
        const threshold = fgTotal * 0.1;
        const results: string[] = [];
        colorCounts.forEach((count, name) => {
          if (count >= threshold) results.push(name);
        });

        resolve(results);
      } catch {
        resolve([]);
      }
    };

    img.onerror = () => resolve([]);
    img.src = imageDataUrl;
  });
}
