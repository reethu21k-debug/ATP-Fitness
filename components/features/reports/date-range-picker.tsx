"use client";

import { format, startOfMonth, subMonths, subDays } from "date-fns";
import { cn } from "@/lib/utils/cn";

export interface DateRangeValue {
  start: string;
  end: string;
}

const PRESETS: { label: string; range: () => DateRangeValue }[] = [
  {
    label: "This month",
    range: () => ({ start: format(startOfMonth(new Date()), "yyyy-MM-dd"), end: format(new Date(), "yyyy-MM-dd") }),
  },
  {
    label: "Last month",
    range: () => {
      const lastMonth = subMonths(new Date(), 1);
      return { start: format(startOfMonth(lastMonth), "yyyy-MM-dd"), end: format(new Date(), "yyyy-MM-dd") };
    },
  },
  {
    label: "Last 90 days",
    range: () => ({ start: format(subDays(new Date(), 90), "yyyy-MM-dd"), end: format(new Date(), "yyyy-MM-dd") }),
  },
  {
    label: "Last 12 months",
    range: () => ({ start: format(subMonths(new Date(), 12), "yyyy-MM-dd"), end: format(new Date(), "yyyy-MM-dd") }),
  },
];

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        value={value.start}
        max={value.end}
        onChange={(e) => onChange({ ...value, start: e.target.value })}
        className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
      />
      <span className="text-sm text-muted-foreground">to</span>
      <input
        type="date"
        value={value.end}
        min={value.start}
        max={format(new Date(), "yyyy-MM-dd")}
        onChange={(e) => onChange({ ...value, end: e.target.value })}
        className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
      />
      <div className="ml-1 inline-flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(p.range())}
            className={cn(
              "rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
