import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Heart, Loader2, AlertCircle, Plus, Minus, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  usePetCareSummary,
  useSetPetCareTodayQuantity,
  useSetPetCareTotal,
  getPetCareSummaryQueryKey,
  type ClothingItem,
  type CareItemSummary
} from "@/hooks/useLocalDB";
import { getImageUrl } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatWalkDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts.map(Number);
  return `${m}/${d}/${String(y).slice(-2)}`;
}

const CATEGORY_LABELS: Record<string, string> = {
  beauty: "Health",
  toiletries: "Care",
  essentials: "Documents",
  outfits: "Pet Details"
};

const CATEGORY_ORDER = ["beauty", "toiletries", "essentials", "outfits"];

// ── Components ────────────────────────────────────────────────────────────────

function TotalEditor({ row, onUpdate }: { row: CareItemSummary; onUpdate: (val: number) => void }) {
  const [val, setVal] = useState(row.total.toString());
  
  useEffect(() => {
    setVal(row.total.toString());
  }, [row.total]);
  
  return (
    <input 
      type="number" 
      min="0"
      className="w-12 h-6 border-2 border-black rounded bg-[#f9f4ee] text-xs font-bold text-center focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary transition-colors appearance-none"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num >= 0 && num !== row.total) {
          onUpdate(num);
        } else {
          setVal(row.total.toString());
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      aria-label={`Total times logged for ${row.item.name}`}
    />
  );
}

function CareRow({
  row,
  onToggle,
  onAdjust,
  onUpdateTotal
}: {
  row: CareItemSummary;
  onToggle: (row: CareItemSummary, checked: boolean) => void;
  onAdjust: (row: CareItemSummary, delta: number) => void;
  onUpdateTotal: (row: CareItemSummary, val: number) => void;
}) {
  return (
    <div className="flex gap-3 p-3 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-center">
        <div className="relative flex items-center justify-center w-6 h-6">
          <input
            type="checkbox"
            checked={row.todayQuantity > 0}
            onChange={(e) => onToggle(row, e.target.checked)}
            className="peer absolute inset-0 opacity-0 cursor-pointer w-full h-full m-0 z-10"
            aria-label={`Mark ${row.item.name} as done today`}
          />
          <div className="w-6 h-6 border-2 border-black rounded bg-white flex items-center justify-center pointer-events-none peer-checked:bg-primary peer-checked:border-black transition-colors">
            {row.todayQuantity > 0 && <Check className="w-4 h-4 text-black" strokeWidth={3} />}
          </div>
        </div>
      </div>

      <div className="w-12 h-12 flex-shrink-0 border-2 border-black rounded-lg bg-[#f9f4ee] overflow-hidden flex items-center justify-center">
        {row.item.imageObjectPath ? (
          <img src={getImageUrl(row.item.imageObjectPath) ?? undefined} alt={row.item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-black/5" />
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="font-bold text-sm truncate leading-tight">{row.item.name}</div>
        <div className="text-[10px] uppercase tracking-widest text-black/50 mt-1 truncate">
          Last Logged: {formatWalkDate(row.lastLogged)}
        </div>
      </div>

      <div className="flex flex-col items-end justify-center gap-1.5 border-l-2 border-black/10 pl-3">
        <div className="flex items-center gap-1">
          {row.todayQuantity > 0 ? (
            <>
              <button 
                onClick={() => onAdjust(row, -1)} 
                className="w-6 h-6 flex items-center justify-center border-2 border-black rounded bg-[#f9f4ee] text-black active:translate-y-px transition-transform"
                aria-label="Decrease today's quantity"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-xs font-bold w-4 text-center">{row.todayQuantity}</span>
              <button 
                onClick={() => onAdjust(row, 1)} 
                className="w-6 h-6 flex items-center justify-center border-2 border-black rounded bg-[#f9f4ee] text-black active:translate-y-px transition-transform"
                aria-label="Increase today's quantity"
              >
                <Plus className="w-3 h-3" />
              </button>
            </>
          ) : (
            <span className="text-[10px] font-bold uppercase text-black/30 tracking-wider h-6 flex items-center">Today: 0</span>
          )}
        </div>
        
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-black/40">Times</span>
          <TotalEditor row={row} onUpdate={val => onUpdateTotal(row, val)} />
        </div>
      </div>
    </div>
  );
}

export interface CareTrackerSheetProps {
  pet: ClothingItem | null;
  onClose: () => void;
}

export function CareTrackerSheet({ pet, onClose }: CareTrackerSheetProps) {
  const queryClient = useQueryClient();
  const petId = pet?.id ?? 0;

  const { data: summary, isLoading, isError } = usePetCareSummary(petId, {
    query: { enabled: petId > 0 }
  });

  const setTodayQuantity = useSetPetCareTodayQuantity();
  const setTotal = useSetPetCareTotal();

  const handleToggleToday = useCallback((row: CareItemSummary, checked: boolean) => {
    const newQty = checked ? 1 : 0;
    setTodayQuantity.mutate({ petId, itemId: row.item.id, quantity: newQty }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getPetCareSummaryQueryKey(petId) });
      }
    });
  }, [petId, setTodayQuantity, queryClient]);

  const handleAdjustToday = useCallback((row: CareItemSummary, delta: number) => {
    const newQty = Math.max(0, row.todayQuantity + delta);
    setTodayQuantity.mutate({ petId, itemId: row.item.id, quantity: newQty }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getPetCareSummaryQueryKey(petId) });
      }
    });
  }, [petId, setTodayQuantity, queryClient]);

  const handleUpdateTotal = useCallback((row: CareItemSummary, newTotal: number) => {
    setTotal.mutate({ petId, itemId: row.item.id, total: newTotal }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getPetCareSummaryQueryKey(petId) });
      }
    });
  }, [petId, setTotal, queryClient]);

  if (!pet) return null;

  const grouped = summary?.reduce((acc, row) => {
    const cat = row.item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(row);
    return acc;
  }, {} as Record<string, CareItemSummary[]>) ?? {};

  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const idxA = CATEGORY_ORDER.indexOf(a);
    const idxB = CATEGORY_ORDER.indexOf(b);
    if (idxA === -1 && idxB === -1) return a.localeCompare(b);
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[65] flex flex-col max-w-md md:max-w-2xl mx-auto bg-[#f9f4ee] overflow-hidden"
    >
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-4
                   bg-white border-b-2 border-black flex-shrink-0"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}
      >
        <div>
          <h2 className="font-display font-bold text-xl uppercase tracking-tight">
            Care Tracker
          </h2>
          <p className="text-[10px] uppercase font-bold tracking-widest text-black/50 mt-0.5">
            For {pet.name}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 flex-shrink-0 border-2 border-black rounded-full flex items-center justify-center
                     bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                     active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 pb-12">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-black/40">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm font-bold uppercase tracking-widest">Loading Care Data</span>
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-red-600">
            <AlertCircle className="w-8 h-8" />
            <span className="text-sm font-bold uppercase tracking-widest">Failed to load</span>
          </div>
        )}

        {!isLoading && !isError && summary?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-3 text-black/40">
            <div className="w-16 h-16 border-2 border-black/20 rounded-2xl flex items-center justify-center mb-2">
              <Heart className="w-8 h-8 text-black/20" />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest">No Care Items</span>
            <p className="text-xs leading-relaxed max-w-[250px]">
              Add health or care items to your wardrobe to start tracking them for {pet.name}.
            </p>
          </div>
        )}

        {!isLoading && !isError && sortedCategories.map(cat => (
          <div key={cat} className="flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-black/50 pl-1 border-b-2 border-black/10 pb-2">
              {CATEGORY_LABELS[cat] || cat}
            </h3>
            <div className="flex flex-col gap-3">
              {grouped[cat].map(row => (
                <CareRow 
                  key={row.item.id} 
                  row={row} 
                  onToggle={handleToggleToday} 
                  onAdjust={handleAdjustToday} 
                  onUpdateTotal={handleUpdateTotal} 
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
