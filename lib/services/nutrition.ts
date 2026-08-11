import type {
  FoodUnit,
  FoodWithNutrition,
  NutritionMealItem,
  NutritionValues,
} from "@/types/database";

// ============================================================================
// Reusable nutrition math. Nothing in this file talks to the database or
// touches React — every UI component (trainer dialogs, meal cards, client
// view) calls into these instead of computing macros inline.
// ============================================================================

export const ZERO_NUTRITION: NutritionValues = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };

const WEIGHT_UNITS: FoodUnit[] = ["g", "kg"];
const VOLUME_UNITS: FoodUnit[] = ["ml", "l"];

/** Converts a quantity+unit into the same measurement space as the food's basis_quantity/default_unit. */
function normalizeQuantity(food: Pick<FoodWithNutrition, "default_unit" | "basis_quantity">, quantity: number, unit: FoodUnit): number {
  const isWeight = WEIGHT_UNITS.includes(food.default_unit);
  const isVolume = VOLUME_UNITS.includes(food.default_unit);

  if (isWeight) {
    const grams = unit === "kg" ? quantity * 1000 : quantity; // treat any other unit as grams
    return grams;
  }
  if (isVolume) {
    const ml = unit === "l" ? quantity * 1000 : quantity; // treat any other unit as ml
    return ml;
  }
  // Countable foods (piece / egg / scoop / serving) — unit conversion doesn't
  // apply, the quantity is already a count of default_unit.
  return quantity;
}

/**
 * calculateNutrition(food, quantity, unit)
 * Scales a food's per-basis nutrition to an arbitrary quantity/unit.
 * e.g. cooked chicken breast is stored per 100g; entering 150g returns
 * calories/protein/carbs/fat scaled by 150/100 = 1.5.
 */
export function calculateNutrition(
  food: Pick<FoodWithNutrition, "default_unit" | "basis_quantity" | "nutrition">,
  quantity: number,
  unit: FoodUnit = food.default_unit
): NutritionValues {
  if (!quantity || quantity <= 0 || !food.nutrition) return ZERO_NUTRITION;

  const normalizedQty = normalizeQuantity(food, quantity, unit);
  const ratio = normalizedQty / food.basis_quantity;

  const { calories, protein_g, carbs_g, fat_g, fiber_g } = food.nutrition;
  return {
    calories: round1(calories * ratio),
    proteinG: round1(protein_g * ratio),
    carbsG: round1(carbs_g * ratio),
    fatG: round1(fat_g * ratio),
    fiberG: round1((fiber_g ?? 0) * ratio),
  };
}

/** A meal item joined with its food, as loaded by the nutrition actions/queries. */
export interface MealItemWithFood extends NutritionMealItem {
  food: FoodWithNutrition;
}

/** calculateMealTotals(meal) — sums calculateNutrition() across every item in a meal. */
export function calculateMealTotals(items: MealItemWithFood[]): NutritionValues {
  return items.reduce<NutritionValues>((totals, item) => {
    const values = calculateNutrition(item.food, item.quantity, item.unit);
    return sumNutrition(totals, values);
  }, ZERO_NUTRITION);
}

export interface MealWithItems {
  id: string;
  items: MealItemWithFood[];
}

/** calculateDailyTotals(dietPlan) — sums calculateMealTotals() across every meal in a plan/day. */
export function calculateDailyTotals(meals: MealWithItems[]): NutritionValues {
  return meals.reduce<NutritionValues>((totals, meal) => sumNutrition(totals, calculateMealTotals(meal.items)), ZERO_NUTRITION);
}

export function sumNutrition(a: NutritionValues, b: NutritionValues): NutritionValues {
  return {
    calories: round1(a.calories + b.calories),
    proteinG: round1(a.proteinG + b.proteinG),
    carbsG: round1(a.carbsG + b.carbsG),
    fatG: round1(a.fatG + b.fatG),
    fiberG: round1(a.fiberG + b.fiberG),
  };
}

export type MacroStatus = "under" | "on-target" | "over";

export interface MacroProgress {
  actual: number;
  target: number;
  pct: number; // 0-100+ (uncapped so "over target" is visible)
  status: MacroStatus;
}

/**
 * calculateMacroProgress(actual, target) — progress toward a single target
 * (calories, protein, carbs, or fat). "on-target" is a ±5% band around the
 * target so small day-to-day variance doesn't read as under/over.
 */
export function calculateMacroProgress(actual: number, target: number | null | undefined): MacroProgress {
  if (!target || target <= 0) return { actual, target: 0, pct: 0, status: "on-target" };
  const pct = round1((actual / target) * 100);
  const status: MacroStatus = pct < 95 ? "under" : pct > 105 ? "over" : "on-target";
  return { actual, target, pct, status };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ============================================================================
// Display helpers
// ============================================================================

export const FOOD_CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  protein: "Protein",
  carbs: "Carbs",
  legumes: "Legumes",
  fruits: "Fruits",
  vegetables: "Vegetables",
  dairy: "Dairy",
  supplements: "Supplements",
  other: "Other",
};

export const FOOD_STATE_LABELS: Record<string, string> = {
  raw: "Raw",
  cooked: "Cooked",
  dry: "Dry",
  prepared: "Prepared",
  drained: "Drained",
  na: "",
};

export const FOOD_UNIT_LABELS: Record<FoodUnit, string> = {
  g: "g",
  kg: "kg",
  ml: "ml",
  l: "L",
  piece: "piece",
  egg: "egg",
  scoop: "scoop",
  serving: "serving",
};

export function formatQuantity(quantity: number, unit: FoodUnit): string {
  return `${quantity}${["piece", "egg", "scoop", "serving"].includes(unit) ? ` ${FOOD_UNIT_LABELS[unit]}${quantity === 1 ? "" : "s"}` : unit}`;
}

export function unitsForFood(food: Pick<FoodWithNutrition, "default_unit">): FoodUnit[] {
  if (food.default_unit === "g" || food.default_unit === "kg") return ["g", "kg"];
  if (food.default_unit === "ml" || food.default_unit === "l") return ["ml", "l"];
  return [food.default_unit];
}
