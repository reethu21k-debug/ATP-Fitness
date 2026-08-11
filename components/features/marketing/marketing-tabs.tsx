"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { CampaignsPanel } from "./campaigns-panel";
import { CouponsPanel } from "./coupons-panel";
import { ReferralsPanel } from "./referrals-panel";
import { AutomationPanel } from "./automation-panel";

const TABS = ["Campaigns", "Coupons", "Referrals", "Automation"] as const;
type Tab = (typeof TABS)[number];

export function MarketingTabs({ basePath, canManage }: { basePath: string; canManage: boolean }) {
  const [tab, setTab] = useState<Tab>("Campaigns");

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-xl bg-secondary/60 p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t ? "bg-background shadow-soft" : "text-muted-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Campaigns" && <CampaignsPanel basePath={basePath} canManage={canManage} />}
      {tab === "Coupons" && <CouponsPanel canManage={canManage} />}
      {tab === "Referrals" && <ReferralsPanel canManage={canManage} />}
      {tab === "Automation" && <AutomationPanel canManage={canManage} />}
    </div>
  );
}
