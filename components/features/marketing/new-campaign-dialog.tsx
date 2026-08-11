"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createCampaign, estimateAudienceSize, type CreateCampaignInput } from "@/lib/actions/marketing.actions";
import { Plus, Users } from "lucide-react";
import type { CampaignChannel, CampaignAudienceType } from "@/types/database";

interface FormValues {
  name: string;
  channel: CampaignChannel;
  audienceType: CampaignAudienceType;
  subject: string;
  messageBody: string;
  scheduledAt: string;
}

const AUDIENCE_OPTIONS: { value: CampaignAudienceType; label: string }[] = [
  { value: "all_members", label: "All members" },
  { value: "active_members", label: "Active members" },
  { value: "expired_members", label: "Expired members" },
  { value: "expiring_soon", label: "Expiring within 7 days" },
  { value: "frozen_members", label: "Frozen members" },
  { value: "leads", label: "Open leads" },
];

export function NewCampaignDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audienceSize, setAudienceSize] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit, reset, watch } = useForm<FormValues>({
    defaultValues: { channel: "email", audienceType: "all_members" },
  });

  const audienceType = watch("audienceType");
  const channel = watch("channel");

  useEffect(() => {
    if (!open) return;
    estimateAudienceSize(audienceType).then(setAudienceSize);
  }, [audienceType, open]);

  function onSubmit(values: FormValues, sendNow: boolean) {
    setError(null);
    const input: CreateCampaignInput = {
      name: values.name,
      channel: values.channel,
      audienceType: values.audienceType,
      subject: values.subject || undefined,
      messageBody: values.messageBody,
      scheduledAt: values.scheduledAt ? new Date(values.scheduledAt).toISOString() : undefined,
      sendNow,
    };
    startTransition(async () => {
      const result = await createCampaign(input);
      if (!result.success) return setError(result.error);
      setOpen(false);
      reset();
      onCreated();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4" /> New campaign</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New campaign</DialogTitle>
          <DialogDescription>Send an email or WhatsApp message to a targeted audience.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Campaign name</Label>
              <Input {...register("name", { required: true })} placeholder="e.g. New Year renewal push" />
            </div>
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <Select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" {...register("channel")}>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="both">Both</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Audience</Label>
              <Select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" {...register("audienceType")}>
                {AUDIENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
          </div>

          {audienceSize !== null && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Approximately <strong>{audienceSize}</strong> recipient{audienceSize === 1 ? "" : "s"} match this audience.
            </p>
          )}

          {(channel === "email" || channel === "both") && (
            <div className="space-y-1.5">
              <Label>Email subject</Label>
              <Input {...register("subject")} placeholder="Only used for the email channel" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Message</Label>
            <textarea
              className="min-h-28 w-full rounded-lg border border-input bg-background p-3 text-sm"
              placeholder="Hi {{name}}, ..."
              {...register("messageBody", { required: true })}
            />
            <p className="text-xs text-muted-foreground">Use <code>{"{{name}}"}</code> to personalize with each recipient's name.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Schedule for later (optional)</Label>
            <Input type="datetime-local" {...register("scheduledAt")} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" variant="outline" loading={isPending} onClick={handleSubmit((v) => onSubmit(v, false))}>
              Save as draft
            </Button>
            <Button type="button" loading={isPending} onClick={handleSubmit((v) => onSubmit(v, true))}>
              {watch("scheduledAt") ? "Schedule" : "Send now"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
