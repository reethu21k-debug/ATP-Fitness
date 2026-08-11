"use client";

import { useEffect, useState, useCallback } from "react";
import { Mail, Phone, Dumbbell, UserCog } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StaffDialog } from "./staff-dialog";
import { listBranchStaff, setStaffActive } from "@/lib/actions/staff.actions";
import type { Profile } from "@/types/database";

export function TrainersDashboard() {
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "trainer" | "receptionist">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listBranchStaff();
    if (res.success) setStaff(res.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggle(p: Profile) {
    await setStaffActive(p.id, !p.is_active);
    load();
  }

  const filtered = staff.filter((s) => filter === "all" || s.role === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="inline-flex gap-1 rounded-lg bg-secondary/60 p-1">
          {(["all", "trainer", "receptionist"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === f ? "bg-background shadow-soft" : "text-muted-foreground"
              }`}
            >
              {f === "all" ? "All staff" : `${f}s`}
            </button>
          ))}
        </div>
        <StaffDialog onSaved={load} />
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No {filter === "all" ? "staff" : `${filter}s`} in this branch yet. Add one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Card key={p.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {p.role === "trainer" ? <Dumbbell className="h-4.5 w-4.5" /> : <UserCog className="h-4.5 w-4.5" />}
                    </div>
                    <div>
                      <p className="font-medium">{p.full_name}</p>
                      <p className="text-xs capitalize text-muted-foreground">{p.role}</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
                  {p.email && (
                    <p className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> {p.email}
                    </p>
                  )}
                  {p.phone && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> {p.phone}
                    </p>
                  )}
                </div>

                <div className="flex justify-end border-t pt-3">
                  <button
                    onClick={() => handleToggle(p)}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {p.is_active ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
