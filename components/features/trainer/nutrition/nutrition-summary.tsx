"use client";

import { Progress } from "@/components/ui/progress";
import { calculateMacroProgress } from "@/lib/services/nutrition";
import type { NutritionValues } from "@/types/database";

interface Targets {
  calorieTarget: number | null;
  proteinTargetG: number | null;
  carbTargetG: number | null;
  fatTargetG: number | null;
}

const ROWS: { key: keyof NutritionValues; targetKey: keyof Targets; label: string; unit: string }[] = [
  { key: "calories", targetKey: "calorieTarget", label: "Calories", unit: "kcal" },
  { key: "proteinG", targetKey: "proteinTargetG", label: "Protein", unit: "g" },
  { key: "carbsG", targetKey: "carbTargetG", label: "Carbs", unit: "g" },
  { key: "fatG", targetKey: "fatTargetG", label: "Fat", unit: "g" },
];

export function NutritionSummary({ targets, planned }: { targets: Targets; planned: NutritionValues }) {
  const anyTarget = targets.calorieTarget || targets.proteinTargetG || targets.carbTargetG || targets.fatTargetG;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ROWS.map((row) => {
        const target = targets[row.targetKey];
        const actual = planned[row.key];
        const progress = calculateMacroProgress(actual, target);
        const barColor = !target
          ? "bg-muted-foreground/30"
          : progress.status === "over"
            ? "bg-amber-500"
            : progress.status === "under"
              ? "bg-primary/60"
              : "bg-emerald-500";

        return (
          <div key={row.key} className="rounded-lg border p-3">
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="font-medium">{row.label}</span>
              <span className="text-xs text-muted-foreground">
                {actual}{row.unit === "kcal" ? "" : row.unit} / {target ? `${target}${row.unit === "kcal" ? "" : row.unit}` : "—"} {row.unit === "kcal" ? "kcal" : ""}
              </span>
            </div>
            <Progress value={target ? Math.min(100, progress.pct) : 0} indicatorClassName={barColor} />
            {target ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {progress.pct}% · {progress.status === "under" ? "Below target" : progress.status === "over" ? "Above target" : "On target"}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground">No target set</p>
            )}
          </div>
        );
      })}
      {!anyTarget && (
        <p className="col-span-2 text-xs text-muted-foreground">Set daily targets to track progress against this plan.</p>
      )}
    </div>
  );
}
