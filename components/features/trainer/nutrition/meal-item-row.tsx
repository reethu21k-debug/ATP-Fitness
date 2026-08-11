"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { removeMealItem, duplicateMealItem, updateMealItem } from "@/lib/actions/nutrition.actions";
import { calculateNutrition, unitsForFood, FOOD_STATE_LABELS, FOOD_UNIT_LABELS } from "@/lib/services/nutrition";
import type { MealItemWithFood } from "@/lib/services/nutrition";
import type { NutritionValues, FoodUnit } from "@/types/database";
import { Copy, Trash2 } from "lucide-react";

export function MealItemRow({
  item,
  memberId,
  onValuesChange,
}: {
  item: MealItemWithFood;
  memberId: string;
  onValuesChange: (itemId: string, values: NutritionValues) => void;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(item.quantity);
  const [unit, setUnit] = useState<FoodUnit>(item.unit);
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const values = calculateNutrition(item.food, quantity, unit);

  // Report live values up immediately on every change — this is what makes
  // meal + daily totals update instantly as the trainer types a new quantity.
  useEffect(() => {
    onValuesChange(item.id, values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantity, unit]);

  function scheduleSave(nextQuantity: number, nextUnit: FoodUnit) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await updateMealItem(item.id, memberId, nextQuantity, nextUnit);
      router.refresh();
    }, 500);
  }

  function onQuantityChange(v: string) {
    const n = v === "" ? 0 : Number(v);
    if (Number.isNaN(n)) return;
    setQuantity(n);
    scheduleSave(n, unit);
  }

  function onUnitChange(v: FoodUnit) {
    setUnit(v);
    scheduleSave(quantity, v);
  }

  async function onRemove() {
    setBusy(true);
    await removeMealItem(item.id, memberId);
    router.refresh();
  }

  async function onDuplicate() {
    setBusy(true);
    await duplicateMealItem(item.id, memberId);
    router.refresh();
  }

  const units = unitsForFood(item.food);
  const stateLabel = FOOD_STATE_LABELS[item.food.state];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
      <div className="min-w-[120px] flex-1">
        <p className="font-medium leading-tight">{item.food.name}</p>
        {stateLabel && <span className="text-[11px] text-muted-foreground">{stateLabel}</span>}
      </div>

      <input
        type="number"
        min={0}
        step="any"
        value={quantity}
        onChange={(e) => onQuantityChange(e.target.value)}
        disabled={busy}
        className="h-8 w-16 rounded-md border border-input bg-background px-2 text-xs"
      />
      {units.length > 1 ? (
        <Select
          value={unit}
          onChange={(e) => onUnitChange(e.target.value as FoodUnit)}
          disabled={busy}
          className="h-8 rounded-md border border-input bg-background px-1.5 text-xs"
        >
          {units.map((u) => (
            <option key={u} value={u}>{FOOD_UNIT_LABELS[u]}</option>
          ))}
        </Select>
      ) : (
        <span className="text-xs text-muted-foreground">{FOOD_UNIT_LABELS[unit]}{quantity === 1 ? "" : "s"}</span>
      )}

      <Badge variant="secondary" className="whitespace-nowrap">{values.calories} kcal</Badge>
      <span className="hidden text-[11px] text-muted-foreground sm:inline">
        P {values.proteinG}g · C {values.carbsG}g · F {values.fatG}g
      </span>

      <div className="ml-auto flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onDuplicate} disabled={busy} title="Duplicate">
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove} disabled={busy} title="Remove">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
