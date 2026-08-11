"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createLead, type CreateLeadInput } from "@/lib/actions/crm.actions";
import { UserPlus } from "lucide-react";
import type { LeadSource } from "@/types/database";

interface FormValues {
  name: string;
  phone: string;
  email: string;
  source: LeadSource;
  followUpDate: string;
  notes: string;
}

export function NewLeadDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit, reset } = useForm<FormValues>({ defaultValues: { source: "walk_in" } });

  function onSubmit(values: FormValues) {
    setError(null);
    const input: CreateLeadInput = {
      name: values.name,
      phone: values.phone,
      email: values.email || undefined,
      source: values.source,
      followUpDate: values.followUpDate || undefined,
      notes: values.notes || undefined,
    };
    startTransition(async () => {
      const result = await createLead(input);
      if (!result.success) return setError(result.error);
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><UserPlus className="h-4 w-4" /> Add lead</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a lead</DialogTitle>
          <DialogDescription>Walk-in, referral, or online enquiry — track them through to conversion.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Name</Label><Input {...register("name", { required: true })} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input {...register("phone", { required: true })} placeholder="+919876543210" /></div>
            <div className="space-y-1.5"><Label>Email (optional)</Label><Input type="email" {...register("email")} /></div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" {...register("source")}>
                <option value="walk_in">Walk-in</option>
                <option value="referral">Referral</option>
                <option value="online">Online</option>
                <option value="phone">Phone</option>
                <option value="social">Social media</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Follow up on</Label>
              <Input type="date" {...register("followUpDate")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input {...register("notes")} placeholder="What are they interested in?" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isPending}>Add lead</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
