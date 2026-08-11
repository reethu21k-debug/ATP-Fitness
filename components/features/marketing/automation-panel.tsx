"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { Cake, PartyPopper, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getBirthdayConfig,
  updateBirthdayConfig,
  listFestivalOffers,
  createFestivalOffer,
  toggleFestivalOffer,
  deleteFestivalOffer,
  type UpdateBirthdayConfigInput,
  type CreateFestivalOfferInput,
} from "@/lib/actions/marketing.actions";
import type {
  BirthdayCampaignConfig,
  FestivalOffer,
  CampaignChannel,
} from "@/types/database";

interface BirthdayFormValues {
  isEnabled: boolean;
  channel: CampaignChannel;
  messageTemplate: string;
}

function BirthdaySettings({ canManage }: { canManage: boolean }) {
  const [config, setConfig] = useState<BirthdayCampaignConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset } = useForm<BirthdayFormValues>({
    defaultValues: {
      isEnabled: true,
      channel: "both",
      messageTemplate:
        "Happy Birthday, {{name}}! 🎉 Wishing you strength and health this year. Team {{gym_name}}",
    },
  });

  useEffect(() => {
    getBirthdayConfig().then((data) => {
      setConfig(data);
      if (data) {
        reset({
          isEnabled: data.is_enabled,
          channel: data.channel,
          messageTemplate: data.message_template,
        });
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(values: BirthdayFormValues) {
    setSaved(false);
    const input: UpdateBirthdayConfigInput = {
      isEnabled: values.isEnabled,
      channel: values.channel,
      messageTemplate: values.messageTemplate,
    };
    startTransition(async () => {
      const result = await updateBirthdayConfig(input);
      if (result.success) setSaved(true);
    });
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <Cake className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Birthday wishes</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Sent automatically every day to any active member whose birthday it
          is.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-input"
              {...register("isEnabled")}
              disabled={!canManage}
            />
            Enabled
          </label>
          <div className="space-y-1.5">
            <Label>Channel</Label>
            <Select
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              {...register("channel")}
              disabled={!canManage}
            >
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="both">Both</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Message template</Label>
            <textarea
              className="min-h-20 w-full rounded-lg border border-input bg-background p-3 text-sm"
              {...register("messageTemplate")}
              disabled={!canManage}
            />
            <p className="text-xs text-muted-foreground">
              Variables: <code>{"{{name}}"}</code>,{" "}
              <code>{"{{gym_name}}"}</code>, <code>{"{{coupon_code}}"}</code>
            </p>
          </div>
          {canManage && (
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" loading={isPending}>
                Save
              </Button>
              {saved && <span className="text-xs text-success">Saved.</span>}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

interface FestivalFormValues {
  name: string;
  occursOn: string;
  channel: CampaignChannel;
  messageTemplate: string;
}

function NewFestivalOfferDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit, reset } = useForm<FestivalFormValues>({
    defaultValues: { channel: "both" },
  });

  function onSubmit(values: FestivalFormValues) {
    setError(null);
    const input: CreateFestivalOfferInput = {
      name: values.name,
      occursOn: values.occursOn,
      channel: values.channel,
      messageTemplate: values.messageTemplate,
    };
    startTransition(async () => {
      const result = await createFestivalOffer(input);
      if (!result.success) return setError(result.error);
      setOpen(false);
      reset();
      onCreated();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> New festival offer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New festival offer</DialogTitle>
          <DialogDescription>
            Sends automatically every year on this date, to every active member.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              {...register("name", { required: true })}
              placeholder="e.g. Diwali Special"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date (month/day repeats yearly)</Label>
              <Input
                type="date"
                {...register("occursOn", { required: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <Select
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                {...register("channel")}
              >
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="both">Both</option>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Message template</Label>
            <textarea
              className="min-h-20 w-full rounded-lg border border-input bg-background p-3 text-sm"
              {...register("messageTemplate", { required: true })}
              placeholder="Celebrate with us! {{name}}, enjoy a special offer this {{gym_name}} festival season."
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FestivalOffers({ canManage }: { canManage: boolean }) {
  const [offers, setOffers] = useState<FestivalOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const data = await listFestivalOffers();
    setOffers(data as FestivalOffer[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleToggle(id: string, current: boolean) {
    setBusyId(id);
    await toggleFestivalOffer(id, !current);
    await load();
    setBusyId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this festival offer?")) return;
    setBusyId(id);
    await deleteFestivalOffer(id);
    await load();
    setBusyId(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PartyPopper className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Festival offers</h3>
        </div>
        {canManage && <NewFestivalOfferDialog onCreated={load} />}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-secondary/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Channel</th>
                <th className="px-4 py-2.5">Last sent</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && offers.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No festival offers yet.
                  </td>
                </tr>
              )}
              {offers.map((o) => (
                <tr key={o.id} className="border-b last:border-0">
                  <td className="px-4 py-2.5 font-medium">{o.name}</td>
                  <td className="px-4 py-2.5">
                    {format(new Date(o.occurs_on), "dd MMMM")}
                  </td>
                  <td className="px-4 py-2.5 capitalize">{o.channel}</td>
                  <td className="px-4 py-2.5">{o.last_sent_year ?? "Never"}</td>
                  <td className="px-4 py-2.5">
                    {o.is_active ? (
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {canManage && (
                      <div className="flex items-center gap-3 text-xs">
                        <button
                          className="text-primary hover:underline disabled:opacity-50"
                          disabled={busyId === o.id}
                          onClick={() => handleToggle(o.id, o.is_active)}
                        >
                          {o.is_active ? "Disable" : "Enable"}
                        </button>
                        <button
                          className="text-destructive hover:underline disabled:opacity-50"
                          disabled={busyId === o.id}
                          onClick={() => handleDelete(o.id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AutomationPanel({ canManage }: { canManage: boolean }) {
  return (
    <div className="space-y-6">
      <BirthdaySettings canManage={canManage} />
      <FestivalOffers canManage={canManage} />
    </div>
  );
}
