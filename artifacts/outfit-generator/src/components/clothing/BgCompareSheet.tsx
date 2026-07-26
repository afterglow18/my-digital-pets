/**
 * BgCompareSheet
 *
 * Full-screen overlay showing Original vs. Cleaned (background-removed) side by side.
 * Opens immediately when "Clean Up Photo" is tapped — the cleaned card shows a spinner
 * while the WASM model runs, then fills in when ready.
 *
 * Phase blocks use plain conditional divs — no AnimatePresence — to avoid blank-screen
 * flashes between state changes.
 */
import React from "react";
import { motion } from "framer-motion";
import { X, Check, Loader2 } from "lucide-react";

interface BgCompareSheetProps {
  open:         boolean;
  onClose:      () => void;
  originalUrl:  string;
  cleanedUrl:   string | null;   // null while model is running
  bgProcessing: boolean;
  bgFailed:     boolean;
  selected:     "original" | "cleaned";
  onSelect:     (v: "original" | "cleaned") => void;
  /** Called when user taps "Save …" — commits the current selection. */
  onConfirm:    () => void;
}

export function BgCompareSheet({
  open,
  onClose,
  originalUrl,
  cleanedUrl,
  bgProcessing,
  bgFailed,
  selected,
  onSelect,
  onConfirm,
}: BgCompareSheetProps) {
  if (!open) return null;

  const saveLabel =
    selected === "cleaned" && cleanedUrl
      ? "Save Cleaned Version"
      : "Save Original";

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[75] flex flex-col max-w-md md:max-w-2xl mx-auto bg-[#f9f4ee]"
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 bg-white border-b-2 border-black flex-shrink-0"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}
      >
        <h2 className="font-display font-bold text-xl uppercase tracking-tight">
          Clean Up Photo
        </h2>
        <button
          onClick={onClose}
          className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                     bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                     active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex flex-col overflow-y-auto p-5 gap-4">

        {/* Hint text */}
        <p className="text-center font-display font-bold text-xs uppercase tracking-[0.15em] opacity-50">
          {bgProcessing ? "This will take a moment…" : bgFailed ? "Background removal failed" : "Tap to choose"}
        </p>

        {/* Side-by-side cards */}
        <div className="flex gap-3">

          {/* Original card */}
          <button
            onClick={() => onSelect("original")}
            className="flex-1 flex flex-col rounded-2xl overflow-hidden border-4 transition-all active:scale-95"
            style={{
              borderColor: selected === "original" ? "black" : "rgba(0,0,0,0.2)",
              opacity:     selected === "original" ? 1 : 0.55,
              background:  "none",
              padding:     0,
            }}
          >
            <div className="relative bg-black" style={{ minHeight: 200 }}>
              <img
                src={originalUrl}
                alt="Original"
                className="w-full object-contain block"
                style={{ maxHeight: 200 }}
              />
              {selected === "original" && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary border-2 border-black
                                flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <Check size={13} strokeWidth={3} />
                </div>
              )}
            </div>
            <p className="font-display font-bold text-xs uppercase tracking-widest text-center
                          py-2 bg-white border-t-2 border-black">
              Original
            </p>
          </button>

          {/* Cleaned card */}
          <button
            onClick={() => cleanedUrl && onSelect("cleaned")}
            disabled={!cleanedUrl}
            className="flex-1 flex flex-col rounded-2xl overflow-hidden border-4 transition-all active:scale-95"
            style={{
              borderColor: selected === "cleaned" && cleanedUrl ? "black" : "rgba(0,0,0,0.2)",
              opacity:     selected === "cleaned" && cleanedUrl ? 1 : 0.55,
              background:  "none",
              padding:     0,
            }}
          >
            {/* Checkerboard reveals transparency */}
            <div
              className="relative flex items-center justify-center"
              style={{
                minHeight: 200,
                background: "repeating-conic-gradient(#d1d5db 0% 25%, white 0% 50%) 0 0 / 12px 12px",
              }}
            >
              {cleanedUrl ? (
                <>
                  <img
                    src={cleanedUrl}
                    alt="Cleaned"
                    className="w-full object-contain block"
                    style={{ maxHeight: 200 }}
                  />
                  {selected === "cleaned" && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary border-2 border-black
                                    flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <Check size={13} strokeWidth={3} />
                    </div>
                  )}
                </>
              ) : bgFailed ? (
                <p className="text-xs font-bold uppercase opacity-40 text-center px-3 py-4">
                  Could not remove background
                </p>
              ) : (
                <div className="flex flex-col items-center gap-2 py-8">
                  <Loader2 size={36} className="animate-spin opacity-50" />
                  <p className="text-xs font-bold uppercase opacity-50">Processing…</p>
                </div>
              )}
            </div>
            <p className="font-display font-bold text-xs uppercase tracking-widest text-center
                          py-2 bg-white border-t-2 border-black">
              Cleaned ✨
            </p>
          </button>

        </div>

        {/* Action row */}
        <div className="flex gap-3 mt-auto pt-2">
          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5
                       border-4 border-black rounded-xl bg-white font-display font-bold text-sm uppercase
                       shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
                       active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={bgProcessing && !cleanedUrl && selected === "cleaned"}
            className="flex-[2] flex items-center justify-center gap-2 px-4 py-3.5
                       border-4 border-black rounded-xl bg-primary font-display font-bold text-sm uppercase
                       shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
                       active:translate-x-1 active:translate-y-1 active:shadow-none transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                       disabled:translate-x-0 disabled:translate-y-0"
          >
            <Check className="w-4 h-4" strokeWidth={3} />
            {saveLabel}
          </button>
        </div>

      </div>
    </motion.div>
  );
}
