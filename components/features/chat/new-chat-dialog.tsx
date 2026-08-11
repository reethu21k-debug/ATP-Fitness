"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Plus, Megaphone, MessageCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { listChatableContacts, startDirectChat, createBroadcast } from "@/lib/actions/chat.actions";
import type { CreateBroadcastInput } from "@/lib/validations/chat";
import type { ChatParticipant } from "@/types/database";

export function NewChatDialog({
  canBroadcast,
  onStarted,
}: {
  canBroadcast: boolean;
  onStarted: (channelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"direct" | "broadcast">("direct");
  const [contacts, setContacts] = useState<ChatParticipant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit, reset } = useForm<CreateBroadcastInput>({
    defaultValues: { audience: "all_members" },
  });

  useEffect(() => {
    if (open) listChatableContacts().then((res) => res.success && setContacts(res.data ?? []));
  }, [open]);

  function handleStartDirect(profileId: string) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await startDirectChat(profileId);
        if (!result.success) {
          setError(result.error);
          return;
        }
        setOpen(false);
        onStarted(result.data!.channelId);
      } catch (e) {
        console.error("handleStartDirect failed:", e);
        setError("Something went wrong. Please try again.");
      }
    });
  }

  function onBroadcastSubmit(values: CreateBroadcastInput) {
    setError(null);
    startTransition(async () => {
      const result = await createBroadcast(values);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      reset();
      onStarted(result.data!.channelId);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> New
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Start a conversation</DialogTitle>
          <DialogDescription>Message someone directly, or send an announcement to everyone.</DialogDescription>
        </DialogHeader>

        {canBroadcast && (
          <div className="inline-flex gap-1 rounded-lg bg-secondary/60 p-1">
            <button
              onClick={() => setTab("direct")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                tab === "direct" ? "bg-background shadow-soft" : "text-muted-foreground"
              }`}
            >
              <MessageCircle className="h-3.5 w-3.5" /> Direct
            </button>
            <button
              onClick={() => setTab("broadcast")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                tab === "broadcast" ? "bg-background shadow-soft" : "text-muted-foreground"
              }`}
            >
              <Megaphone className="h-3.5 w-3.5" /> Broadcast
            </button>
          </div>
        )}

        {tab === "direct" ? (
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {contacts.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No contacts available yet.</p>
            )}
            {contacts.map((c) => (
              <button
                key={c.id}
                disabled={isPending}
                onClick={() => handleStartDirect(c.id)}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-accent disabled:opacity-50"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {c.full_name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{c.full_name}</p>
                  <p className="text-xs capitalize text-muted-foreground">{c.role.replace("_", " ")}</p>
                </div>
              </button>
            ))}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        ) : (
          <form onSubmit={handleSubmit(onBroadcastSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Broadcast name</Label>
              <Input id="name" {...register("name", { required: true })} placeholder="Holiday hours update" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audience">Send to</Label>
              <Select
                id="audience"
                {...register("audience")}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="all_members">All members</option>
                <option value="all_staff">All staff</option>
                <option value="all_trainers">All trainers</option>
                <option value="all_receptionists">All receptionists</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="firstMessage">Message</Label>
              <textarea
                id="firstMessage"
                {...register("firstMessage", { required: true })}
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="We'll be closed on…"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Sending…" : "Send broadcast"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}