"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { PlansPanel } from "./plans-panel";
import { InvoicesPanel } from "./invoices-panel";

const TABS = ["Subscription Plans", "Invoices"] as const;
type Tab = (typeof TABS)[number];

export function BillingTabs() {
  const [tab, setTab] = useState<Tab>("Subscription Plans");

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

      {tab === "Subscription Plans" && <PlansPanel />}
      {tab === "Invoices" && <InvoicesPanel />}
    </div>
  );
}
