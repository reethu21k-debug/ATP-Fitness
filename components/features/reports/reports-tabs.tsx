"use client";

import { useState } from "react";
import { format, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils/cn";
import type { DateRangeValue } from "./date-range-picker";
import { RevenuePanel } from "./revenue-panel";
import { MembershipPanel } from "./membership-panel";
import { AttendancePanel } from "./attendance-panel";
import { TrainerPanel } from "./trainer-panel";
import { InventoryReportPanel } from "./inventory-report-panel";
import { PaymentsPanel } from "./payments-panel";
import { ExpensesPanel } from "./expenses-panel";
import { ProfitLossPanel } from "./profit-loss-panel";
import { AnalyticsPanel } from "./analytics-panel";

const TABS = [
  "Revenue", "Membership", "Attendance", "Trainer Performance",
  "Inventory", "Payments", "Expenses", "Profit & Loss", "Analytics",
] as const;
type Tab = (typeof TABS)[number];

function defaultRange(): DateRangeValue {
  const now = new Date();
  return { start: format(startOfMonth(now), "yyyy-MM-dd"), end: format(now, "yyyy-MM-dd") };
}

export function ReportsTabs() {
  const [tab, setTab] = useState<Tab>("Revenue");
  const [range, setRange] = useState<DateRangeValue>(defaultRange());

  return (
    <div className="space-y-5">
      <div className="inline-flex flex-wrap gap-1 rounded-xl bg-secondary/60 p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              tab === t ? "bg-background shadow-soft" : "text-muted-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Revenue" && <RevenuePanel range={range} onRangeChange={setRange} />}
      {tab === "Membership" && <MembershipPanel />}
      {tab === "Attendance" && <AttendancePanel range={range} onRangeChange={setRange} />}
      {tab === "Trainer Performance" && <TrainerPanel range={range} onRangeChange={setRange} />}
      {tab === "Inventory" && <InventoryReportPanel range={range} onRangeChange={setRange} />}
      {tab === "Payments" && <PaymentsPanel range={range} onRangeChange={setRange} />}
      {tab === "Expenses" && <ExpensesPanel range={range} onRangeChange={setRange} />}
      {tab === "Profit & Loss" && <ProfitLossPanel range={range} onRangeChange={setRange} />}
      {tab === "Analytics" && <AnalyticsPanel range={range} onRangeChange={setRange} />}
    </div>
  );
}
