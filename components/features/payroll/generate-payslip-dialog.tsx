"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generatePayslip } from "@/lib/actions/payroll.actions";

export function GeneratePayslipDialog({ staffId, staffName, open, onOpenChange }: { staffId: string; staffName: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM-01"));
  const [bonus, setBonus] = useState("0");
  const [deductions, setDeductions] = useState("0");
  const [presentDays, setPresentDays] = useState("");
  const [totalWorkingDays, setTotalWorkingDays] = useState("26");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await generatePayslip({
        staffId,
        month,
        bonus: Number(bonus),
        deductions: Number(deductions),
        presentDays: presentDays ? Number(presentDays) : undefined,
        totalWorkingDays: totalWorkingDays ? Number(totalWorkingDays) : undefined,
      });
      if (!result.success) return setError(result.error);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate payslip — {staffName}</DialogTitle>
          <DialogDescription>Commission is calculated automatically from payments they processed that month.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Month</Label>
            <Input type="month" value={month.slice(0, 7)} onChange={(e) => setMonth(`${e.target.value}-01`)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Present days</Label><Input type="number" value={presentDays} onChange={(e) => setPresentDays(e.target.value)} placeholder="Optional" /></div>
            <div className="space-y-1.5"><Label>Total working days</Label><Input type="number" value={totalWorkingDays} onChange={(e) => setTotalWorkingDays(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Bonus (₹)</Label><Input type="number" value={bonus} onChange={(e) => setBonus(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Deductions (₹)</Label><Input type="number" value={deductions} onChange={(e) => setDeductions(e.target.value)} /></div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} loading={isPending}>Generate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
