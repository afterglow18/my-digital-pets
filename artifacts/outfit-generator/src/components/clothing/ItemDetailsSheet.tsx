/**
 * ItemDetailsSheet — full-screen overlay showing a clothing item's details.
 * Every field is optional and editable. A "Save" button appears only when
 * the form is dirty. Delete is always available.
 *
 * "Clean Up Photo" opens BgCompareSheet immediately while the WASM model runs.
 * On confirm the display image updates optimistically; the DB write fires in
 * the background so the photo never flashes back to the old version.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, Trash2, Save, ChevronDown, Sparkles, Loader2 } from "lucide-react";
import { removeBackground } from "@/lib/backgroundRemoval";
import { BgCompareSheet } from "./BgCompareSheet";
import { LookbookPickerSheet } from "./LookbookPickerSheet";
import {
  type CarePetSummary,
  type ClothingItem,
  type ClothingItemUpdateCategory,
  useCareItemPetSummary,
  useSetPetCareTotal,
  useUpdateClothingItem,
  useDeleteClothingItem,
  getListClothingQueryKey,
  getListOutfitsQueryKey,
  getWardrobeStatsQueryKey,
  getCareItemPetSummaryQueryKey,
} from "@/hooks/useLocalDB";
import { useQueryClient } from "@tanstack/react-query";
import { getImageUrl } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

const LIFE_STAGE_OPTIONS = ["", "Puppy / Kitten", "Junior", "Adult", "Senior", "All Ages"];
const TYPE_OPTIONS       = ["", "Routine", "Preventive", "Emergency", "Grooming", "Training", "Surgery"];
const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "outfits",    label: "Pet Details" },
  { value: "beauty",     label: "Health" },
  { value: "toiletries", label: "Care" },
  { value: "essentials", label: "Documents" },
];

function Field({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? label}
        className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm font-medium
                   bg-white focus:outline-none focus:ring-2 focus:ring-primary
                   placeholder:font-normal placeholder:text-black/25"
      />
    </div>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: (string | { value: string; label: string })[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none border-2 border-black rounded-lg px-3 py-2 pr-8
                     text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-primary
                     cursor-pointer"
        >
          {options.map((o) => {
            const val = typeof o === "string" ? o : o.value;
            const lbl = typeof o === "string" ? (o || `— ${label} —`) : o.label;
            return <option key={val} value={val}>{lbl}</option>;
          })}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-black/40" />
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ItemDetailsSheetProps {
  item:               ClothingItem | null;
  onClose:            () => void;
  onDeleted?:         () => void;
  /** When true: show "Add to Lookbook" button (search/favorites context).
   *  When false (default): show "Clean Up Photo" button (wardrobe context). */
  showAddToLookbook?: boolean;
  /** Opens the care tracker for this Pet Details photo. */
  onLogCare?: (pet: ClothingItem) => void;
}

interface FormState {
  name: string; brand: string; color: string; size: string;
  season: string; occasion: string; purchasePrice: string;
  purchaseDate: string; notes: string; isFavorite: boolean; category: string;
}

function toForm(item: ClothingItem): FormState {
  return {
    name:          item.name          ?? "",
    brand:         item.brand         ?? "",
    color:         item.color         ?? "",
    size:          item.size          ?? "",
    season:        item.season        ?? "",
    occasion:      item.occasion      ?? "",
    purchasePrice: item.purchasePrice ?? "",
    purchaseDate:  item.purchaseDate  ?? "",
    notes:         item.notes         ?? "",
    isFavorite:    item.isFavorite    ?? false,
    category:      item.category      ?? "",
  };
}

function isDirty(form: FormState, item: ClothingItem): boolean {
  return (
    form.name          !== (item.name          ?? "") ||
    form.brand         !== (item.brand         ?? "") ||
    form.color         !== (item.color         ?? "") ||
    form.size          !== (item.size          ?? "") ||
    form.season        !== (item.season        ?? "") ||
    form.occasion      !== (item.occasion      ?? "") ||
    form.purchasePrice !== (item.purchasePrice ?? "") ||
    form.purchaseDate  !== (item.purchaseDate  ?? "") ||
    form.notes         !== (item.notes         ?? "") ||
    form.isFavorite    !== (item.isFavorite    ?? false) ||
    form.category      !== (item.category      ?? "")
  );
}

function formatCareDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const [year, month, day] = dateStr.split("-").map(Number);
  return `${month}/${day}/${String(year).slice(-2)}`;
}

function CarePetHistoryRow({
  summary,
  onUpdateTotal,
}: {
  summary: CarePetSummary;
  onUpdateTotal: (petId: number, total: number) => void;
}) {
  const [totalValue, setTotalValue] = useState(String(summary.total));

  useEffect(() => {
    setTotalValue(String(summary.total));
  }, [summary.total]);

  const commitTotal = () => {
    const parsed = Number.parseInt(totalValue, 10);
    if (Number.isInteger(parsed) && parsed >= 0) {
      onUpdateTotal(summary.pet.id, parsed);
    } else {
      setTotalValue(String(summary.total));
    }
  };

  return (
    <div className="flex items-center gap-3 border-2 border-black rounded-xl bg-white px-3 py-2.5
                    shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
      <div className="w-10 h-10 flex-shrink-0 overflow-hidden rounded-lg border-2 border-black bg-[#f9f4ee]">
        {summary.pet.imageObjectPath ? (
          <img
            src={getImageUrl(summary.pet.imageObjectPath) ?? undefined}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-black/30 text-xs">—</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display font-bold text-sm truncate">{summary.pet.name}</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-black/45 mt-1">
          Last logged: {formatCareDate(summary.lastLogged)}
        </p>
      </div>
      <label className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-[9px] font-bold uppercase tracking-widest text-black/45">Times logged</span>
        <input
          type="number"
          min={0}
          value={totalValue}
          onChange={(event) => setTotalValue(event.target.value)}
          onBlur={commitTotal}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          aria-label={`Times logged for ${summary.pet.name}`}
          className="w-14 h-8 border-2 border-black rounded-lg bg-[#f9f4ee] text-sm font-bold text-center
                     focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary"
        />
      </label>
    </div>
  );
}

export function ItemDetailsSheet({ item, onClose, onDeleted, showAddToLookbook = false, onLogCare }: ItemDetailsSheetProps) {
  const [form,             setForm]             = useState<FormState | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Optimistic image state ─────────────────────────────────────────────────
  // Updated immediately on confirm so the photo never flashes back to the old
  // version while the DB write is in-flight.
  const [displayImageUrl, setDisplayImageUrl] = useState<string | null>(null);

  // ── Compare sheet state ────────────────────────────────────────────────────
  const [compareOpen,       setCompareOpen]       = useState(false);
  const [cleanedUrl,        setCleanedUrl]        = useState<string | null>(null);
  const [bgProcessing,      setBgProcessing]      = useState(false);
  const [bgFailed,          setBgFailed]          = useState(false);
  const [selected,          setSelected]          = useState<"original" | "cleaned">("original");
  const [lookbookPickerOpen, setLookbookPickerOpen] = useState(false);
  // Generation counter — prevents stale async result writing if item changes mid-removal
  const bgGenRef = useRef(0);

  const updateItem  = useUpdateClothingItem();
  const deleteItem  = useDeleteClothingItem();
  const setCareTotal = useSetPetCareTotal();
  const queryClient = useQueryClient();
  const carePetSummaryQuery = useCareItemPetSummary(item?.id ?? 0, {
    query: {
      enabled: item?.category === "beauty" || item?.category === "toiletries",
    },
  });

  // Reset everything whenever the item changes
  useEffect(() => {
    if (item) {
      setForm(toForm(item));
      setDisplayImageUrl(item.imageObjectPath ?? null);
    }
    setShowDeleteConfirm(false);
    setCompareOpen(false);
    setCleanedUrl(null);
    setBgProcessing(false);
    setBgFailed(false);
    setSelected("original");
    bgGenRef.current += 1;
  }, [item?.id]);

  // ── "Clean Up Photo" — opens compare sheet immediately, runs model in bg ──
  // All useCallback hooks must be declared before any early return (Rules of Hooks).

  const handleCleanUpPhoto = useCallback(async () => {
    const srcUrl = displayImageUrl ?? item?.imageObjectPath;
    if (!srcUrl || bgProcessing) return;

    const myGen = ++bgGenRef.current;
    setCleanedUrl(null);
    setBgFailed(false);
    setSelected("original");
    setBgProcessing(true);
    setCompareOpen(true);   // open immediately — cleaned card shows spinner

    try {
      const result = await removeBackground(srcUrl);
      if (bgGenRef.current !== myGen) return;
      setCleanedUrl(result);
      setSelected("cleaned");
    } catch (err) {
      if (bgGenRef.current !== myGen) return;
      console.warn("BG removal failed:", err);
      setBgFailed(true);
    } finally {
      if (bgGenRef.current === myGen) setBgProcessing(false);
    }
  }, [displayImageUrl, item?.imageObjectPath, bgProcessing]);

  // ── Confirm selection — optimistic update then background DB write ─────────

  const handleConfirm = useCallback(() => {
    const srcUrl    = displayImageUrl ?? item?.imageObjectPath;
    const chosenUrl = selected === "cleaned" && cleanedUrl ? cleanedUrl : srcUrl;
    if (!chosenUrl || !item) return;

    // Cancel any in-flight removal — user has made their choice
    bgGenRef.current += 1;
    setBgProcessing(false);

    // Update on screen immediately — no flash waiting for the DB
    setDisplayImageUrl(chosenUrl);
    setCompareOpen(false);

    // Fire DB write in background — also flag bgRemoved when cleaned version chosen
    const wasCleaned = selected === "cleaned" && !!cleanedUrl;
    updateItem.mutate(
      { id: item.id, data: { imageObjectPath: chosenUrl, ...(wasCleaned ? { bgRemoved: true } : {}) } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getWardrobeStatsQueryKey() });
        },
        onError: (err) => {
          console.error("Image update failed:", err);
          // Revert the optimistic update so the user knows it didn't stick
          setDisplayImageUrl(item.imageObjectPath ?? null);
        },
      },
    );
  }, [selected, cleanedUrl, displayImageUrl, item, updateItem, queryClient]);

  const handleCloseCompare = useCallback(() => {
    bgGenRef.current += 1; // cancel any in-flight model run
    setBgProcessing(false);
    setCompareOpen(false);
  }, []);

  // ── Early return after all hooks ──────────────────────────────────────────

  if (!item || !form) return null;

  const dirty = isDirty(form, item);
  const isCareItem = item.category === "beauty" || item.category === "toiletries";

  // Disable once background removal has been confirmed on this item.
  const isAlreadyCleaned = item.bgRemoved === true;

  const patch = (key: keyof FormState) => (value: string | boolean) =>
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);

  // ── Form save ─────────────────────────────────────────────────────────────

  const handleSave = () => {
    updateItem.mutate(
      {
        id: item.id,
        data: {
          name:          form.name.trim() || item.name,
          brand:         form.brand.trim(),
          color:         form.color.trim(),
          size:          form.size.trim(),
          season:        form.season,
          occasion:      form.occasion,
          purchasePrice: form.purchasePrice.trim(),
          purchaseDate:  form.purchaseDate.trim(),
          notes:         form.notes.trim(),
          isFavorite:    form.isFavorite,
          category:      (form.category || item.category) as ClothingItemUpdateCategory,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getWardrobeStatsQueryKey() });
          onClose();
        },
      },
    );
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = () => {
    deleteItem.mutate(
      { id: item.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getWardrobeStatsQueryKey() });
          onDeleted?.();
          onClose();
        },
      },
    );
  };

  const handleCareTotalUpdate = (petId: number, total: number) => {
    setCareTotal.mutate(
      { petId, itemId: item.id, total },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getCareItemPetSummaryQueryKey(item.id) });
          queryClient.invalidateQueries({ queryKey: ["pet-care"] });
        },
      },
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const shownImageUrl = getImageUrl(displayImageUrl ?? item.imageObjectPath ?? "");

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 240 }}
        className="fixed inset-0 z-[65] flex flex-col max-w-md md:max-w-2xl mx-auto bg-[#f9f4ee] overflow-y-auto"
      >
        {/* ── Header ── */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-4
                     bg-white border-b-2 border-black flex-shrink-0"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}
        >
          <h2 className="font-display font-bold text-xl uppercase tracking-tight">
            Item Details
          </h2>
          <div className="flex items-center gap-2">
            {/* Favourite toggle — saves instantly */}
            <button
              onClick={() => {
                const next = !form.isFavorite;
                patch("isFavorite")(next);
                updateItem.mutate(
                  { id: item.id, data: { isFavorite: next } },
                  {
                    onSuccess: () => {
                      queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
                      queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
                      queryClient.invalidateQueries({ queryKey: getWardrobeStatsQueryKey() });
                    },
                  },
                );
              }}
              className={`w-9 h-9 border-2 border-black rounded-full flex items-center justify-center transition-all
                          ${form.isFavorite
                            ? "bg-red-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            : "bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"}`}
              title="Favourite"
            >
              <Heart
                className="w-4 h-4"
                fill={form.isFavorite ? "white" : "none"}
                stroke={form.isFavorite ? "white" : "currentColor"}
              />
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                         bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                         active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Photo ── */}
        {shownImageUrl && (
          <div className="flex-shrink-0">
            {/* Image with checkerboard to reveal transparency on cleaned PNGs */}
            <div
              className="w-full h-36"
              style={{
                backgroundImage: "repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%)",
                backgroundSize: "16px 16px",
              }}
            >
              <img
                src={shownImageUrl}
                alt={item.name}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        )}

        {/* ── Photo actions ── */}
        <div className="px-4 py-2 border-b-2 border-black flex gap-2 flex-shrink-0">
          {/* Add to Lookbook (search/favorites context) OR Clean Up Photo (wardrobe context) */}
          {showAddToLookbook ? (
            <button
              onClick={() => setLookbookPickerOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                         border-2 border-black bg-white font-display font-bold text-sm uppercase tracking-tight
                         shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                         active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
            >
              🐶 Add to Lookbook
            </button>
          ) : (
            /* Clean Up Photo — only shown when photo exists and not yet cleaned */
            shownImageUrl && !isAlreadyCleaned && (
              <button
                onClick={handleCleanUpPhoto}
                disabled={bgProcessing && !compareOpen}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                           border-2 border-black bg-white font-display font-bold text-sm uppercase tracking-tight
                           shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all
                           disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                           disabled:translate-x-0 disabled:translate-y-0"
              >
                {bgProcessing && !compareOpen ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Starting…</>
                ) : (
                  <><Sparkles className="w-4 h-4" />Clean Up Photo</>
                )}
              </button>
            )
          )}

          {/* Only Pet Details photos identify the pet whose care is being logged. */}
          {item.category === "outfits" && onLogCare && (
            <button
              onClick={() => onLogCare(item)}
              className={`${shownImageUrl && !isAlreadyCleaned ? "flex-1" : "w-full"} flex items-center justify-center gap-2 py-2.5 rounded-xl
                         border-2 border-black bg-primary font-display font-bold text-sm uppercase tracking-tight
                         shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                         active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all`}
            >
              Log Care
            </button>
          )}
        </div>

        {/* ── Form ── */}
        <div className="flex-1 px-4 py-5 flex flex-col gap-4">

          <Field
            label="Name"
            value={form.name}
            onChange={patch("name") as (v: string) => void}
            placeholder="e.g. Annual checkup, flea treatment…"
          />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Brand / Provider" value={form.brand} onChange={patch("brand") as (v: string) => void} placeholder="Banfield, PetSmart…" />
            <Field label="Colour / Breed"   value={form.color} onChange={patch("color") as (v: string) => void} placeholder="Labrador, Tabby…" />
          </div>

          <Field label="Size / Weight" value={form.size} onChange={patch("size") as (v: string) => void} placeholder="5kg, Small, Large…" />

          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Life Stage" value={form.season}   onChange={patch("season") as (v: string) => void}   options={LIFE_STAGE_OPTIONS} />
            <SelectField label="Type"       value={form.occasion} onChange={patch("occasion") as (v: string) => void} options={TYPE_OPTIONS} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Cost" value={form.purchasePrice} onChange={patch("purchasePrice") as (v: string) => void} placeholder="$49.99" />
            <Field label="Date" value={form.purchaseDate}  onChange={patch("purchaseDate") as (v: string) => void}  type="date" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => patch("notes")(e.target.value)}
              placeholder="Anything worth remembering…"
              rows={3}
              className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm font-medium
                         bg-white focus:outline-none focus:ring-2 focus:ring-primary resize-none
                         placeholder:font-normal placeholder:text-black/25"
            />
          </div>

          <SelectField
            label="Category"
            value={form.category}
            onChange={patch("category") as (v: string) => void}
            options={CATEGORY_OPTIONS}
          />

          {isCareItem && (
            <section className="flex flex-col gap-3 pt-1" aria-labelledby="care-history-heading">
              <div>
                <h3 id="care-history-heading" className="font-display font-bold text-base uppercase tracking-tight">
                  Care history by pet
                </h3>
                <p className="text-xs text-black/50 mt-1">
                  Usage stays separate for each pet who uses this item.
                </p>
              </div>

              {carePetSummaryQuery.isLoading && (
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-black/40 py-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading pet history…
                </div>
              )}

              {!carePetSummaryQuery.isLoading && carePetSummaryQuery.data?.length === 0 && (
                <p className="text-xs text-black/45 border-2 border-dashed border-black/20 rounded-xl p-3">
                  Add a Pet Details photo to see pet-specific history here.
                </p>
              )}

              {!carePetSummaryQuery.isLoading && carePetSummaryQuery.data?.map((summary) => (
                <CarePetHistoryRow
                  key={summary.pet.id}
                  summary={summary}
                  onUpdateTotal={handleCareTotalUpdate}
                />
              ))}
            </section>
          )}

        </div>

        {/* ── Footer actions ── */}
        <div className="sticky bottom-0 px-4 py-4 bg-white border-t-2 border-black flex-shrink-0 flex flex-col gap-2">

          {/* Save (only when dirty) */}
          <AnimatePresence>
            {dirty && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                onClick={handleSave}
                disabled={updateItem.isPending}
                className="w-full btn-brutalist py-3 rounded-xl flex items-center justify-center gap-2 text-sm"
              >
                <Save className="w-4 h-4" />
                {updateItem.isPending ? "Saving…" : "Save Changes"}
              </motion.button>
            )}
          </AnimatePresence>

          {/* Delete */}
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm
                         font-bold uppercase border-2 border-black/20 text-black/35
                         hover:border-red-500 hover:text-red-600 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Delete Forever
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-bold uppercase border-2 border-black bg-white
                           shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                           active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteItem.isPending}
                className="flex-1 py-3 rounded-xl text-sm font-bold uppercase border-2 border-red-600
                           bg-red-500 text-white
                           shadow-[2px_2px_0px_0px_rgba(185,28,28,1)]
                           active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all
                           disabled:opacity-50"
              >
                {deleteItem.isPending ? "Deleting…" : "Yes, Delete Forever"}
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── BgCompareSheet — slides over the top at z-75 ── */}
      <BgCompareSheet
        open={compareOpen}
        onClose={handleCloseCompare}
        originalUrl={displayImageUrl ?? item.imageObjectPath ?? ""}
        cleanedUrl={cleanedUrl}
        bgProcessing={bgProcessing}
        bgFailed={bgFailed}
        selected={selected}
        onSelect={setSelected}
        onConfirm={handleConfirm}
      />

      {/* ── LookbookPickerSheet — z-80 ── */}
      <AnimatePresence>
        {lookbookPickerOpen && item && (
          <LookbookPickerSheet
            item={item}
            onClose={() => setLookbookPickerOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
