/**
 * LookbookPickerSheet — modal for adding/removing an item from saved groups.
 *
 * Shows all saved lookbook groups, each with a 3-thumbnail preview row and a
 * filled checkmark on groups that already contain the item. Tap to toggle.
 */
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import { getImageUrl } from "@/lib/utils";
import {
  useListOutfits,
  useAddItemToOutfit,
  useRemoveItemFromOutfit,
  getListOutfitsQueryKey,
  type ClothingItem,
  type SavedOutfit,
} from "@/hooks/useLocalDB";
import { useQueryClient } from "@tanstack/react-query";

interface LookbookPickerSheetProps {
  item:     ClothingItem;
  onClose:  () => void;
}

function ThumbRow({ outfit }: { outfit: SavedOutfit }) {
  const shown = (outfit.items ?? []).slice(0, 3);
  return (
    <div className="flex gap-1">
      {shown.map((i) => (
        <div
          key={i.id}
          className="w-10 h-10 border border-black/20 rounded overflow-hidden flex-shrink-0"
          style={{ background: "#F5EDD8" }}
        >
          {i.imageObjectPath ? (
            <img
              src={getImageUrl(i.imageObjectPath)!}
              alt={i.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full" />
          )}
        </div>
      ))}
      {shown.length === 0 && (
        <div className="text-[10px] text-black/30 self-center">No items yet</div>
      )}
    </div>
  );
}

export function LookbookPickerSheet({ item, onClose }: LookbookPickerSheetProps) {
  const { data: outfits = [], isLoading } = useListOutfits();
  const addItem    = useAddItemToOutfit();
  const removeItem = useRemoveItemFromOutfit();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });

  const handleToggle = (outfit: SavedOutfit) => {
    const alreadyIn = (outfit.items ?? []).some((i) => i.id === item.id);
    if (alreadyIn) {
      removeItem.mutate({ id: outfit.id, itemId: item.id }, { onSuccess: invalidate });
    } else {
      addItem.mutate({ id: outfit.id, data: { itemId: item.id } }, { onSuccess: invalidate });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[80] flex flex-col max-w-md md:max-w-2xl mx-auto bg-[#f9f4ee]"
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-4
                   bg-white border-b-2 border-black flex-shrink-0"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}
      >
        <div>
          <h2 className="font-display font-bold text-xl uppercase tracking-tight">Add to Lookbook</h2>
          <p className="text-xs text-black/50 font-medium">{item.name}</p>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                     bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                     active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-xl border-2 border-black" />
          ))
        ) : outfits.length === 0 ? (
          <div className="text-center text-sm text-black/40 font-medium mt-12">
            No lookbook groups yet. Save a look from the Pets tab first.
          </div>
        ) : (
          outfits.map((outfit) => {
            const alreadyIn = (outfit.items ?? []).some((i) => i.id === item.id);
            return (
              <button
                key={outfit.id}
                onClick={() => handleToggle(outfit)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border-2
                            transition-all
                            ${alreadyIn
                              ? "border-black bg-primary shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                              : "border-black/20 bg-white hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]"
                            }`}
              >
                <ThumbRow outfit={outfit} />
                <div className="flex-1 text-left min-w-0">
                  <p className="font-display font-bold text-sm uppercase tracking-tight truncate">
                    {outfit.name}
                  </p>
                  <p className="text-[10px] text-black/40 font-medium">
                    {(outfit.items ?? []).length} item{(outfit.items ?? []).length !== 1 ? "s" : ""}
                  </p>
                </div>
                {alreadyIn && (
                  <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
