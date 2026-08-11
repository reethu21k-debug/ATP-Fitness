"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertSalaryConfig } from "@/lib/actions/payroll.actions";

export function SalaryConfigDialog({
  staffId, staffName, initialBase, initialCommission, open, onOpenChange,
}: {
  staffId: string; staffName: string; initialBase: number; initialCommission: number; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [base, setBase] = useState(String(initialBase));
  const [commission, setCommission] = useState(String(initialCommission));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await upsertSalaryConfig(staffId, Number(base), Number(commission));
      if (!result.success) return setError(result.error);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Salary — {staffName}</DialogTitle>
          <DialogDescription>Base salary and commission rate on payments they process.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Base salary (₹/month)</Label><Input type="number" value={base} onChange={(e) => setBase(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Commission rate (%)</Label><Input type="number" step="0.1" value={commission} onChange={(e) => setCommission(e.target.value)} /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} loading={isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
