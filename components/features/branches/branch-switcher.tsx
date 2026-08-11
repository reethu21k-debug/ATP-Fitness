"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Check } from "lucide-react";
import { listBranches, switchActiveBranch } from "@/lib/actions/branches.actions";
import type { Gym } from "@/types/database";

export function BranchSwitcher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState<Gym[]>([]);
  const [activeGymId, setActiveGymId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    listBranches().then((res) => {
      if (res.success && res.data) {
        setBranches(res.data.branches);
        setActiveGymId(res.data.activeGymId);
      }
    });
  }, []);

  if (branches.length <= 1) return null; // nothing to switch between yet

  const active = branches.find((b) => b.id === activeGymId);

  function handleSwitch(gymId: string) {
    if (gymId === activeGymId) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const result = await switchActiveBranch(gymId);
      if (result.success) {
        setActiveGymId(gymId);
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        className="flex max-w-[45vw] items-center gap-2 rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-accent sm:max-w-none sm:px-3"
      >
        <Building2 className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate">{active?.name ?? "Select branch"}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border bg-popover p-1 shadow-soft">
          <p className="px-2.5 pb-1 pt-1.5 text-xs font-medium text-muted-foreground">Switch branch</p>
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => handleSwitch(b.id)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent"
            >
              <span className="flex flex-col">
                <span className="font-medium">{b.name}</span>
                <span className="text-xs text-muted-foreground">
                  {b.code}
                  {!b.is_active && " · inactive"}
                </span>
              </span>
              {b.id === activeGymId && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
