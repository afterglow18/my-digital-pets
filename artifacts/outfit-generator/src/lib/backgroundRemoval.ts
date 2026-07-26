import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal";

// ── ONNX Runtime main-thread unfreeze ─────────────────────────────────────────
//
// @imgly/background-removal runs ONNX inference synchronously on the JS main
// thread by default, freezing all UI while the model thinks (~10–30 s).
//
// ONNX Runtime Web has a wasm.proxy flag that moves inference into a Web Worker,
// but imgly resets it to false internally right before creating the inference
// session (it only enables the proxy when WebGPU is available, which iOS
// Safari / WKWebView don't support).
//
// Three-part fix:
//   1. Object.defineProperty with a no-op setter — imgly's `proxy = false` write
//      is silently discarded; the value stays true. ONNX Runtime then uses a
//      sub-worker for inference.
//   2. numThreads = 1 — iOS Safari has no SharedArrayBuffer, which WASM
//      multithreading requires. Leaving threads > 1 causes a silent crash.
//   3. Dynamic import() — importing onnxruntime-web at module parse time
//      triggers Vite's dependency pre-bundling mid-session, causing a full
//      page reload that corrupts React's internal dispatcher. Importing it
//      dynamically inside the function means it only loads on first use.

let ortConfigured = false;

async function configureOrt(): Promise<void> {
  if (ortConfigured) return;
  ortConfigured = true;

  const ort = await import("onnxruntime-web");

  // Lock proxy = true so imgly's internal "proxy = false" write is ignored.
  Object.defineProperty(ort.env.wasm, "proxy", {
    get: () => true,
    set: () => {},   // no-op: blocks imgly from resetting it to false
    configurable: true,
  });

  // iOS Safari has no SharedArrayBuffer — single thread avoids a silent crash.
  ort.env.wasm.numThreads = 1;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Remove the background from a JPEG/PNG base64 data-URL or object URL.
 * Returns a PNG data-URL with transparent background.
 *
 * Inference runs in a Web Worker (not the main thread) so the UI stays
 * responsive while the model runs. First call downloads ~15 MB ONNX model
 * from imgly CDN; subsequent calls use the browser cache.
 *
 * Throws on network error or unreadable image — callers should catch and fall back.
 */
export async function removeBackground(dataUrl: string): Promise<string> {
  await configureOrt();

  const sourceBlob = await dataUrlToBlob(dataUrl);
  const resultBlob = await imglyRemoveBackground(sourceBlob, {
    model: "isnet_fp16",  // valid: "isnet" | "isnet_fp16" | "isnet_quint8"
    output: { format: "image/png", quality: 0.9 },
    // publicPath omitted → uses static imgly CDN automatically
  });
  return blobToDataUrl(resultBlob);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
