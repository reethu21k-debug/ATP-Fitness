"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MealItemRow } from "./meal-item-row";
import { FoodPickerDialog } from "./food-picker-dialog";
import { renameMeal, deleteMeal, reorderMeal } from "@/lib/actions/nutrition.actions";
import { ZERO_NUTRITION, calculateNutrition, sumNutrition } from "@/lib/services/nutrition";
import type { NutritionMealWithItems } from "@/lib/actions/nutrition.actions";
import type { NutritionValues } from "@/types/database";
import { ChevronUp, ChevronDown, Pencil, Trash2, Check } from "lucide-react";

export function MealCard({
  meal, memberId, planId, isFirst, isLast, onTotalsChange,
}: {
  meal: NutritionMealWithItems;
  memberId: string;
  planId: string;
  isFirst: boolean;
  isLast: boolean;
  onTotalsChange: (mealId: string, totals: NutritionValues) => void;
}) {
  const router = useRouter();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(meal.name);
  const [busy, setBusy] = useState(false);

  const initialValues = useMemo(
    () => Object.fromEntries(meal.items.map((it) => [it.id, calculateNutrition(it.food, it.quantity, it.unit)])),
    [meal.items]
  );
  const [liveValues, setLiveValues] = useState<Record<string, NutritionValues>>(initialValues);

  useEffect(() => setLiveValues(initialValues), [initialValues]);

  const totals = Object.values(liveValues).reduce<NutritionValues>((acc, v) => sumNutrition(acc, v), ZERO_NUTRITION);

  useEffect(() => {
    onTotalsChange(meal.id, totals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.calories, totals.proteinG, totals.carbsG, totals.fatG]);

  function handleValueChange(itemId: string, values: NutritionValues) {
    setLiveValues((prev) => ({ ...prev, [itemId]: values }));
  }

  async function saveName() {
    setEditingName(false);
    if (name.trim() && name !== meal.name) await renameMeal(meal.id, memberId, name.trim());
    router.refresh();
  }

  async function onDelete() {
    if (!confirm(`Delete "${meal.name}" and all its foods?`)) return;
    setBusy(true);
    await deleteMeal(meal.id, memberId);
    router.refresh();
  }

  async function onMove(direction: "up" | "down") {
    setBusy(true);
    await reorderMeal(planId, memberId, meal.id, direction);
    router.refresh();
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex flex-col">
          <Button type="button" variant="ghost" size="icon" className="h-4 w-6" disabled={isFirst || busy} onClick={() => onMove("up")}>
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-4 w-6" disabled={isLast || busy} onClick={() => onMove("down")}>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>

        {editingName ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm font-semibold"
            />
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={saveName}><Check className="h-3.5 w-3.5" /></Button>
          </div>
        ) : (
          <button onClick={() => setEditingName(true)} className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide">
            {meal.name} <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        )}

        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span>{totals.calories} kcal</span>
          <span className="hidden sm:inline">P {totals.proteinG}g · C {totals.carbsG}g · F {totals.fatG}g</span>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete} disabled={busy}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        {meal.items.map((item) => (
          <MealItemRow key={item.id} item={item} memberId={memberId} onValuesChange={handleValueChange} />
        ))}
        {meal.items.length === 0 && <p className="py-2 text-xs text-muted-foreground">No foods added yet.</p>}
      </div>

      <div className="mt-2">
        <FoodPickerDialog mealId={meal.id} memberId={memberId} mealName={meal.name} />
      </div>
    </div>
  );
}
