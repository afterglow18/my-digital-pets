/**
 * QuickAddSheet
 *
 * Upload flow:
 *   pick ──(file chosen)──► encoding ──► preview (Original | Cleaned ✨) ──► uploading ──► close
 *
 * Background removal runs on-device via @imgly/background-removal.
 * First call downloads ~15 MB ONNX model from imgly CDN (cached permanently after that).
 *
 * IMPORTANT: phase blocks must NOT be wrapped in AnimatePresence — any AnimatePresence
 * wrapper creates exit-animation windows where no child is mounted → blank screen between
 * every phase change, regardless of mode/initial/transition. Use plain conditional divs.
 * The outer motion.div slide-in is fine.
 */
import React, { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Check, RotateCcw } from "lucide-react";
import {
  useCreateClothingItem,
  getListClothingQueryKey,
  getWardrobeStatsQueryKey,
} from "@/hooks/useLocalDB";
import { useQueryClient } from "@tanstack/react-query";
import { removeBackground, blobToDataUrl, dataUrlToBlob } from "@/lib/backgroundRemoval";

// ── Types ──────────────────────────────────────────────────────────────────────

type Category = "outfits" | "beauty" | "toiletries" | "essentials";

const CATEGORY_LABELS: Record<Category, string> = {
  outfits:    "Pet Details",
  beauty:     "Health",
  toiletries: "Care",
  essentials: "Records",
};

type Phase = "pick" | "encoding" | "preview" | "uploading";

// ── Helpers (outside component) ────────────────────────────────────────────────

/**
 * Re-encodes any image File/Blob to JPEG ≤ 2048px, ready for background removal.
 * Rejects with "blank image" when the canvas output is suspiciously small.
 */
async function encodeForUpload(input: File | Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(input);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 2048;
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth  * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (b) => (b && b.size > 1000 ? resolve(b) : reject(new Error("blank image"))),
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("failed to load image"));
    };
    img.src = objectUrl;
  });
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PHOTO_TIPS = [
  "Photograph one pet, item, or document at a time.",
  "Use good lighting for a clear image.",
  "Keep all important details visible.",
  "Keep the entire pet, item, or document in frame.",
] as const;


// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  category:      Category;
  existingCount: number;
  /** Called with the newly created item after a successful upload. */
  onCreated?:    (item: import("@/lib/db").ClothingItem) => void;
}

export function QuickAddSheet({ open, onOpenChange, category, existingCount, onCreated }: Props) {
  const [phase,        setPhase]        = useState<Phase>("pick");
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);
  const [originalBlob, setOriginalBlob] = useState<Blob | null>(null);
  const [originalUrl,  setOriginalUrl]  = useState<string | null>(null);
  const [cleanedBlob,  setCleanedBlob]  = useState<Blob | null>(null);
  const [cleanedUrl,   setCleanedUrl]   = useState<string | null>(null);
  const [bgProcessing, setBgProcessing] = useState(false);
  const [bgFailed,     setBgFailed]     = useState(false);
  const [selected,     setSelected]     = useState<"original" | "cleaned">("original");
  // Queue for multi-photo selection — each photo goes through preview/compare individually
  const [fileQueue,    setFileQueue]    = useState<File[]>([]);
  const savedCountRef  = useRef(0);  // tracks saves within this open session for naming

  // Each photo bumps this counter. Every async step checks it before writing state —
  // prevents a slow first photo from clobbering a fast second one.
  const bgGenRef = useRef(0);

  // Two separate file inputs: one triggers camera, one opens gallery
  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const createItem  = useCreateClothingItem();
  const queryClient = useQueryClient();

  // ── Reset ─────────────────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    bgGenRef.current += 1;   // cancels any in-flight removal
    setBgProcessing(false);  // MUST reset — close can happen mid-removal
    setPhase("pick");
    setErrorMsg(null);
    setOriginalBlob(null);
    setOriginalUrl(null);
    setCleanedBlob(null);
    setCleanedUrl(null);
    setBgFailed(false);
    setSelected("original");
    setFileQueue([]);
    savedCountRef.current = 0;
    onOpenChange(false);
  }, [onOpenChange]);

  // ── Photo pipeline ────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File | Blob) => {
    setErrorMsg(null);
    // Switch to "encoding" phase BEFORE any async work so the user sees a
    // full-screen spinner immediately instead of a blank pick screen for 1–3 s.
    const myGen = ++bgGenRef.current;
    setOriginalBlob(null);
    setOriginalUrl(null);
    setCleanedBlob(null);
    setCleanedUrl(null);
    setBgFailed(false);
    setBgProcessing(false);
    setSelected("original");
    setPhase("encoding");

    // Encode to JPEG ≤ 2048px
    let jpeg: Blob;
    try {
      jpeg = await encodeForUpload(file);
    } catch (err) {
      if (bgGenRef.current !== myGen) return;
      setErrorMsg(`Could not read the photo: ${err instanceof Error ? err.message : String(err)}`);
      setPhase("pick");
      return;
    }
    if (bgGenRef.current !== myGen) return;

    // Show original, switch to comparison screen
    setOriginalBlob(jpeg);
    setOriginalUrl(URL.createObjectURL(jpeg));
    setPhase("preview");

    // Background removal — generation guard discards stale results
    setBgProcessing(true);
    try {
      const dataUrl = await blobToDataUrl(jpeg);
      if (bgGenRef.current !== myGen) return;
      const resultUrl = await removeBackground(dataUrl);
      if (bgGenRef.current !== myGen) return;
      const resultBlob   = await dataUrlToBlob(resultUrl);
      const resultObjUrl = URL.createObjectURL(resultBlob);
      if (bgGenRef.current !== myGen) { URL.revokeObjectURL(resultObjUrl); return; }
      setCleanedBlob(resultBlob);
      setCleanedUrl(resultObjUrl);
      setSelected("cleaned");
    } catch (err) {
      if (bgGenRef.current !== myGen) return;
      console.warn("Background removal failed:", err);
      setBgFailed(true);
    } finally {
      if (bgGenRef.current === myGen) setBgProcessing(false);
    }
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    const blob = selected === "cleaned" && cleanedBlob ? cleanedBlob : originalBlob;
    if (!blob) return;
    setPhase("uploading");
    try {
      const dataUrl  = await blobToDataUrl(blob);
      const label    = CATEGORY_LABELS[category];
      const n        = existingCount + savedCountRef.current;
      const autoName = n === 0 ? label : `${label} ${n + 1}`;
      await new Promise<void>((resolve, reject) => {
        createItem.mutate(
          { data: { name: autoName, category, imageObjectPath: dataUrl } },
          {
            onSuccess: (createdItem) => {
              queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
              queryClient.invalidateQueries({ queryKey: getWardrobeStatsQueryKey() });
              if (onCreated) onCreated(createdItem);
              resolve();
            },
            onError: reject,
          },
        );
      });
      savedCountRef.current += 1;
      // If more photos are queued, process the next one instead of closing
      setFileQueue(prev => {
        const [next, ...rest] = prev;
        if (next) {
          handleFile(next);
          return rest;
        }
        handleClose();
        return [];
      });
    } catch (err) {
      setErrorMsg(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
      setPhase("preview");
    }
  }, [selected, cleanedBlob, originalBlob, handleClose, handleFile, category, existingCount, createItem, queryClient, onCreated]);

  // ── Input handler ─────────────────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) { e.target.value = ""; return; }
    // All photos — single or multiple — go through the preview/compare flow.
    // For multiple files, queue the rest and process the first immediately.
    savedCountRef.current = 0;
    const [first, ...rest] = files;
    setFileQueue(rest);
    handleFile(first);
    e.target.value = "";
  };

  if (!open) return null;

  const label = CATEGORY_LABELS[category];

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[70] flex flex-col max-w-md md:max-w-2xl mx-auto bg-[#f9f4ee]"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 bg-white border-b-2 border-black flex-shrink-0"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}
      >
        <h2 className="font-display font-bold text-xl uppercase tracking-tight">
          Add {label}
        </h2>
        {(phase === "pick" || phase === "preview") && (
          <button
            onClick={handleClose}
            className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                       bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                       active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Body — NO AnimatePresence here; plain conditional divs prevent blank-screen flashes */}
      <div className="flex-1 flex flex-col overflow-y-auto">

        {/* ── PICK ── */}
        {phase === "pick" && (
          <div className="flex flex-col p-5 gap-5">
            {errorMsg && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                {errorMsg}
              </p>
            )}

            {/* Two big action buttons */}
            <div className="flex gap-3">
              {/* Take Photo */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-3 py-8
                           border-4 border-black rounded-2xl bg-primary
                           shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-1 active:translate-y-1 active:shadow-none
                           transition-all"
              >
                <span className="text-4xl leading-none">📷</span>
                <span className="font-display font-bold text-base uppercase tracking-tight text-center leading-tight">
                  Take<br />Photo
                </span>
              </button>

              {/* Upload Photo */}
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-3 py-8
                           border-4 border-black rounded-2xl bg-white
                           shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-1 active:translate-y-1 active:shadow-none
                           transition-all"
              >
                <span className="text-4xl leading-none">🖼️</span>
                <span className="font-display font-bold text-base uppercase tracking-tight text-center leading-tight">
                  Upload<br />Photo
                </span>
              </button>
            </div>

            {/* Photo tips */}
            <div className="border-2 border-black rounded-2xl bg-white p-4
                            shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <p className="font-display font-bold text-sm uppercase tracking-tight mb-3 flex items-center gap-2">
                <span>📸</span> PHOTO TIPS
              </p>
              <ul className="flex flex-col gap-2">
                {PHOTO_TIPS.map((tip) => (
                  <li key={tip} className="flex items-start gap-2 text-sm text-black/70 leading-snug">
                    <span className="mt-0.5 w-4 h-4 border-2 border-black rounded-sm bg-primary
                                     flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5" strokeWidth={3} />
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ── ENCODING — full-screen spinner, shown immediately after photo is picked ── */}
        {phase === "encoding" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6">
            <div className="w-28 h-28 border-4 border-black rounded-3xl bg-white
                            flex items-center justify-center
                            shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <Loader2 className="w-12 h-12 animate-spin" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-2xl uppercase tracking-tight">Processing…</p>
              <p className="text-sm text-muted-foreground mt-1">Getting your photo ready.</p>
            </div>
          </div>
        )}

        {/* ── PREVIEW — side-by-side comparison ── */}
        {phase === "preview" && (
          <div className="flex flex-col gap-4 p-5">
            {errorMsg && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                {errorMsg}
              </p>
            )}

            <p className="text-center font-display font-bold text-xs uppercase tracking-[0.15em] opacity-50">
              {bgProcessing ? "This will take a moment…" : bgFailed ? "Original" : "Tap to choose"}
            </p>

            {/* Side-by-side cards */}
            <div className="flex gap-3">

              {/* Original card */}
              <button
                onClick={() => setSelected("original")}
                className="flex-1 flex flex-col border-4 border-black rounded-2xl overflow-hidden
                           transition-all active:scale-95"
                style={{
                  borderColor: selected === "original" ? "black" : "rgba(0,0,0,0.2)",
                  opacity:     selected === "original" ? 1 : 0.55,
                  background:  "none",
                  padding:     0,
                }}
              >
                <div className="relative bg-black" style={{ minHeight: 176 }}>
                  {originalUrl && (
                    <img
                      src={originalUrl}
                      alt="Original"
                      className="w-full object-contain block"
                      style={{ maxHeight: 176 }}
                    />
                  )}
                  {selected === "original" && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black
                                    flex items-center justify-center">
                      <Check size={12} color="white" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <p className="font-display font-bold text-xs uppercase tracking-widest text-center py-1.5 bg-white border-t-2 border-black">
                  Original
                </p>
              </button>

              {/* Cleaned card */}
              <button
                onClick={() => cleanedUrl && setSelected("cleaned")}
                disabled={!cleanedUrl}
                className="flex-1 flex flex-col border-4 rounded-2xl overflow-hidden
                           transition-all active:scale-95"
                style={{
                  borderColor: selected === "cleaned" && cleanedUrl ? "black" : "rgba(0,0,0,0.2)",
                  opacity:     selected === "cleaned" && cleanedUrl ? 1 : 0.55,
                  background:  "none",
                  padding:     0,
                }}
              >
                {/* Checkerboard background reveals transparency */}
                <div
                  className="relative flex items-center justify-center"
                  style={{
                    minHeight: 176,
                    background: "repeating-conic-gradient(#d1d5db 0% 25%, white 0% 50%) 0 0 / 12px 12px",
                  }}
                >
                  {cleanedUrl ? (
                    <>
                      <img
                        src={cleanedUrl}
                        alt="Cleaned"
                        className="w-full object-contain block"
                        style={{ maxHeight: 176 }}
                      />
                      {selected === "cleaned" && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black
                                        flex items-center justify-center">
                          <Check size={12} color="white" strokeWidth={3} />
                        </div>
                      )}
                    </>
                  ) : bgFailed ? (
                    <p className="text-xs font-bold uppercase opacity-40 text-center px-3">
                      Could not remove background
                    </p>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 size={32} className="animate-spin opacity-50" />
                      <p className="text-xs font-bold uppercase opacity-50">Processing</p>
                    </div>
                  )}
                </div>
                <p className="font-display font-bold text-xs uppercase tracking-widest text-center py-1.5 bg-white border-t-2 border-black">
                  Cleaned ✨
                </p>
              </button>

            </div>

            {/* Action row */}
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => setPhase("pick")}
                className="flex items-center justify-center gap-2 px-4 py-3
                           border-4 border-black rounded-xl bg-white font-display font-bold text-sm uppercase
                           shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Retake
              </button>
              <button
                onClick={handleSave}
                disabled={selected === "cleaned" && !cleanedUrl}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3
                           border-4 border-black rounded-xl bg-primary font-display font-bold text-sm uppercase
                           shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-1 active:translate-y-1 active:shadow-none transition-all
                           disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                           disabled:translate-x-0 disabled:translate-y-0"
              >
                <Check className="w-4 h-4" strokeWidth={3} />
                {selected === "cleaned" && !cleanedUrl ? "Processing…" : "Save Original"}
              </button>
            </div>
          </div>
        )}

        {/* ── UPLOADING ── */}
        {phase === "uploading" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6">
            <div className="w-28 h-28 border-4 border-black rounded-3xl bg-white
                            flex items-center justify-center
                            shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <Loader2 className="w-12 h-12 animate-spin" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-2xl uppercase tracking-tight">Saving…</p>
              <p className="text-sm text-muted-foreground mt-1">Adding to your pets.</p>
            </div>
          </div>
        )}

      </div>

      {/* Hidden file inputs */}
      {/* Camera — shows native photo picker (camera + library); capture="environment" removed
           as it force-opens rear camera directly and is a known crash trigger in WKWebView */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
      />
      {/* Gallery — opens photo library / file picker (multiple OK; single → preview, batch → direct upload) */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />
    </motion.div>
  );
}
