"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { suspendTenant, reactivateTenant } from "@/lib/actions/platform.actions";
import type { Tenant } from "@/types/database";

export function TenantAdminActions({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSuspend() {
    setError(null);
    if (reason.trim().length < 3) {
      setError("Give a reason — it's logged to this tenant's admin history.");
      return;
    }
    startTransition(async () => {
      const result = await suspendTenant(tenant.id, reason.trim());
      if (!result.success) return setError(result.error);
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  function onReactivate() {
    startTransition(async () => {
      const result = await reactivateTenant(tenant.id);
      if (result.success) router.refresh();
    });
  }

  if (tenant.subscription_status === "suspended") {
    return (
      <Button onClick={onReactivate} loading={isPending} variant="outline">
        <CheckCircle2 className="h-4 w-4" /> Reactivate tenant
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Ban className="h-4 w-4" /> Suspend tenant
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspend {tenant.name}?</DialogTitle>
          <DialogDescription>
            This immediately blocks the gym owner and their staff from accessing the dashboard until reactivated.
            The reason is recorded in this tenant&apos;s admin action history.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Reason</Label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Non-payment for 60+ days"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" loading={isPending} onClick={onSuspend}>
            Suspend
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
