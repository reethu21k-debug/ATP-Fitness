"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  searchFoods, getQuickAddData, addMealItem, toggleFavoriteFood, createCustomFood,
  type FoodSearchResult, type QuickAddData,
} from "@/lib/actions/nutrition.actions";
import { FOOD_CATEGORY_LABELS, FOOD_STATE_LABELS, FOOD_UNIT_LABELS, calculateNutrition, formatQuantity } from "@/lib/services/nutrition";
import type { FoodCategory, FoodState, FoodUnit, FoodWithNutrition } from "@/types/database";
import { Plus, Search, Star, Clock, Zap, Loader2, PenLine } from "lucide-react";

const CATEGORIES: (FoodCategory | "all")[] = ["all", "protein", "carbs", "legumes", "fruits", "vegetables", "dairy", "supplements", "other"];
const CUSTOM_CATEGORIES: FoodCategory[] = ["protein", "carbs", "legumes", "fruits", "vegetables", "dairy", "supplements", "other"];
const CUSTOM_STATES: FoodState[] = ["na", "raw", "cooked", "dry", "prepared", "drained"];
const CUSTOM_UNITS: FoodUnit[] = ["g", "kg", "ml", "l", "piece", "egg", "scoop", "serving"];

export function FoodPickerDialog({ mealId, memberId, mealName }: { mealId: string; memberId: string; mealName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("quick");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FoodCategory | "all">("all");
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [quickData, setQuickData] = useState<QuickAddData | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    getQuickAddData().then(setQuickData);
    searchFoods("", "all").then(setResults);
  }, [open]);

  useEffect(() => {
    if (!open || tab !== "search") return;
    setSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await searchFoods(query, category);
      setResults(res);
      setSearching(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, category, tab, open]);

  async function quickAdd(foodId: string, quantity: number, unit: FoodUnit) {
    setPendingId(foodId);
    await addMealItem({ mealId, memberId, foodId, quantity, unit });
    setPendingId(null);
    setOpen(false);
    router.refresh();
  }

  async function handleCustomFoodAdded(foodId: string, quantity: number, unit: FoodUnit) {
    await quickAdd(foodId, quantity, unit);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-full border-dashed">
          <Plus className="h-3.5 w-3.5" /> Add food
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add food — {mealName}</DialogTitle>
          <DialogDescription>Quick-add a saved food, or search the full database.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="quick"><Zap className="h-3 w-3" /> Frequent</TabsTrigger>
            <TabsTrigger value="favorites"><Star className="h-3 w-3" /> Favorites</TabsTrigger>
            <TabsTrigger value="recent"><Clock className="h-3 w-3" /> Recent</TabsTrigger>
            <TabsTrigger value="search"><Search className="h-3 w-3" /> Search</TabsTrigger>
            <TabsTrigger value="custom"><PenLine className="h-3 w-3" /> Custom</TabsTrigger>
          </TabsList>

          <TabsContent value="quick">
            <QuickChipGrid
              empty="Foods you use often will show up here after you add a few."
              items={(quickData?.frequentlyUsed ?? []).map((f) => ({ food: f, quantity: f.defaultQuantity, unit: f.defaultUnit }))}
              pendingId={pendingId}
              onPick={quickAdd}
            />
          </TabsContent>

          <TabsContent value="favorites">
            <QuickChipGrid
              empty="No favorites yet — star a food from Search to save it here."
              items={(quickData?.favorites ?? []).map((f) => ({ food: f, quantity: f.defaultQuantity, unit: f.defaultUnit }))}
              pendingId={pendingId}
              onPick={quickAdd}
            />
          </TabsContent>

          <TabsContent value="recent">
            <QuickChipGrid
              empty="Foods you've added recently will show up here."
              items={(quickData?.recent ?? []).map((f) => ({ food: f, quantity: f.defaultQuantity, unit: f.defaultUnit }))}
              pendingId={pendingId}
              onPick={quickAdd}
            />
          </TabsContent>

          <TabsContent value="search" className="space-y-3">
            <Input placeholder="Search foods — chicken, rice, paneer…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${category === c ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground"}`}
                >
                  {FOOD_CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
            <div className="max-h-80 space-y-1.5 overflow-y-auto">
              {searching && <p className="py-4 text-center text-xs text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></p>}
              {!searching && results.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No foods found.</p>}
              {!searching && results.map((food) => (
                <SearchResultRow key={food.id} food={food} busy={pendingId === food.id} onAdd={(qty, unit) => quickAdd(food.id, qty, unit)} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="custom">
            <CustomFoodForm onAdded={handleCustomFoodAdded} busy={pendingId !== null} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function QuickChipGrid({
  items, empty, pendingId, onPick,
}: {
  items: { food: FoodWithNutrition; quantity: number; unit: FoodUnit }[];
  empty: string;
  pendingId: string | null;
  onPick: (foodId: string, quantity: number, unit: FoodUnit) => void;
}) {
  if (items.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ food, quantity, unit }) => (
        <button
          key={food.id}
          onClick={() => onPick(food.id, quantity, unit)}
          disabled={pendingId === food.id}
          className="rounded-full border border-input bg-background px-3 py-1.5 text-xs font-medium transition hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-50"
        >
          {pendingId === food.id ? <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> : null}
          {food.name} · {formatQuantity(quantity, unit)}
        </button>
      ))}
    </div>
  );
}

function CustomFoodForm({ onAdded, busy }: { onAdded: (foodId: string, quantity: number, unit: FoodUnit) => void; busy: boolean }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<FoodCategory>("other");
  const [state, setState] = useState<FoodState>("na");
  const [unit, setUnit] = useState<FoodUnit>("g");
  const [basisQuantity, setBasisQuantity] = useState(100);
  const [calories, setCalories] = useState<number | "">("");
  const [proteinG, setProteinG] = useState<number | "">("");
  const [carbsG, setCarbsG] = useState<number | "">("");
  const [fatG, setFatG] = useState<number | "">("");
  const [fiberG, setFiberG] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCountable = !["g", "kg", "ml", "l"].includes(unit);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Give the food a name.");
    if (!basisQuantity || basisQuantity <= 0) return setError("Basis quantity must be greater than 0.");
    if (calories === "" || proteinG === "" || carbsG === "" || fatG === "") {
      return setError("Calories, protein, carbs, and fat are required.");
    }

    setSaving(true);
    const res = await createCustomFood({
      name: name.trim(),
      category,
      state,
      defaultUnit: unit,
      basisQuantity,
      calories: Number(calories),
      proteinG: Number(proteinG),
      carbsG: Number(carbsG),
      fatG: Number(fatG),
      fiberG: fiberG === "" ? undefined : Number(fiberG),
    });
    setSaving(false);

    if (!res.success) {
      setError(res.error);
      return;
    }
    if (!res.data) {
      setError("Could not save the food.");
      return;
    }

    onAdded(res.data.food.id, basisQuantity, unit);
  }

  return (
    <form onSubmit={handleSubmit} className="max-h-96 space-y-3 overflow-y-auto pr-1">
      <p className="text-xs text-muted-foreground">
        Not in the database? Add it here with its nutrition values — it'll be saved for your gym and added to this meal.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="cf-name">Food name</Label>
        <Input id="cf-name" placeholder="e.g. Homemade protein laddu" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1.5">
          <Label htmlFor="cf-category">Category</Label>
          <Select
            id="cf-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as FoodCategory)}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            {CUSTOM_CATEGORIES.map((c) => (
              <option key={c} value={c}>{FOOD_CATEGORY_LABELS[c]}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-state">State</Label>
          <Select
            id="cf-state"
            value={state}
            onChange={(e) => setState(e.target.value as FoodState)}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            {CUSTOM_STATES.map((s) => (
              <option key={s} value={s}>{FOOD_STATE_LABELS[s] || "—"}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1.5">
          <Label htmlFor="cf-unit">Measured in</Label>
          <Select
            id="cf-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value as FoodUnit)}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            {CUSTOM_UNITS.map((u) => (
              <option key={u} value={u}>{FOOD_UNIT_LABELS[u]}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-basis">
            {isCountable ? "Nutrition is per how many?" : `Nutrition is per how many ${FOOD_UNIT_LABELS[unit]}?`}
          </Label>
          <Input
            id="cf-basis"
            type="number"
            min={0}
            step="any"
            value={basisQuantity}
            onChange={(e) => setBasisQuantity(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="rounded-lg border p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Nutrition per {basisQuantity || 0} {isCountable ? `${FOOD_UNIT_LABELS[unit]}${basisQuantity === 1 ? "" : "s"}` : FOOD_UNIT_LABELS[unit]}
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="cf-cal" className="text-xs">Calories</Label>
            <Input id="cf-cal" type="number" min={0} step="any" placeholder="kcal" value={calories} onChange={(e) => setCalories(e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cf-protein" className="text-xs">Protein (g)</Label>
            <Input id="cf-protein" type="number" min={0} step="any" placeholder="g" value={proteinG} onChange={(e) => setProteinG(e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cf-carbs" className="text-xs">Carbs (g)</Label>
            <Input id="cf-carbs" type="number" min={0} step="any" placeholder="g" value={carbsG} onChange={(e) => setCarbsG(e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cf-fat" className="text-xs">Fat (g)</Label>
            <Input id="cf-fat" type="number" min={0} step="any" placeholder="g" value={fatG} onChange={(e) => setFatG(e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
        </div>
        <div className="mt-2.5 w-1/2 space-y-1 sm:w-1/4">
          <Label htmlFor="cf-fiber" className="text-xs">Fiber (g) <span className="text-muted-foreground">— optional</span></Label>
          <Input id="cf-fiber" type="number" min={0} step="any" placeholder="g" value={fiberG} onChange={(e) => setFiberG(e.target.value === "" ? "" : Number(e.target.value))} />
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="submit" size="sm" className="w-full" disabled={saving || busy}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        Save &amp; add to meal
      </Button>
    </form>
  );
}

function SearchResultRow({ food, busy, onAdd }: { food: FoodSearchResult; busy: boolean; onAdd: (qty: number, unit: FoodUnit) => void }) {
  const [qty, setQty] = useState(food.basis_quantity);
  const [unit, setUnit] = useState<FoodUnit>(food.default_unit);
  const values = calculateNutrition(food, qty, unit);
  const [favorited, setFavorited] = useState(false);

  async function onFavorite() {
    const res = await toggleFavoriteFood(food.id, qty, unit);
    if (res.success && res.data) setFavorited(res.data.favorited);
  }

  return (
    <div className="rounded-lg border p-2.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{food.name}</p>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {FOOD_STATE_LABELS[food.state] && <Badge variant="outline">{FOOD_STATE_LABELS[food.state]}</Badge>}
            <span>{FOOD_CATEGORY_LABELS[food.category]}</span>
          </div>
        </div>
        <button onClick={onFavorite} title="Save to favorites" className="text-muted-foreground hover:text-amber-500">
          <Star className={`h-4 w-4 ${favorited ? "fill-amber-400 text-amber-400" : ""}`} />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input type="number" min={0} step="any" value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} className="h-8 w-16 rounded-md border border-input bg-background px-2 text-xs" />
        <span className="text-xs text-muted-foreground">{FOOD_UNIT_LABELS[unit]}</span>
        <span className="ml-auto text-xs text-muted-foreground">{values.calories} kcal · {values.proteinG}g P · {values.carbsG}g C · {values.fatG}g F</span>
        <Button type="button" size="sm" className="h-7 px-2 text-xs" disabled={busy} onClick={() => onAdd(qty, unit)}>
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add
        </Button>
      </div>
    </div>
  );
}
