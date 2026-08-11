"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { LifeBuoy, Plus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { TicketStatusBadge, TicketPriorityBadge } from "@/components/features/platform/ticket-badges";
import { createSupportTicket, listMyTenantTickets, replyToMyTicket, getMyTicketWithMessages } from "@/lib/actions/platform.actions";

export function SupportTicketsPanel() {
  const queryClient = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-tenant-tickets"],
    queryFn: () => listMyTenantTickets(),
  });

  const tickets = data?.success ? data.data ?? [] : [];

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["my-tenant-tickets"] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <LifeBuoy className="h-4 w-4" /> Support
          </CardTitle>
          <CardDescription>Raise a ticket with the ATP Fitness platform team and track replies here.</CardDescription>
        </div>
        <NewTicketDialog open={newOpen} onOpenChange={setNewOpen} onCreated={refresh} />
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading tickets…</p>
        ) : tickets.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No support tickets yet.</p>
        ) : (
          <ul className="space-y-2">
            {tickets.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setActiveTicketId(t.id)}
                  className="flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors hover:bg-accent/40"
                >
                  <div>
                    <p className="text-sm font-medium">{t.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(t.created_at), "dd MMM yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <TicketPriorityBadge priority={t.priority} />
                    <TicketStatusBadge status={t.status} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {activeTicketId && (
        <TicketDetailDialog
          ticketId={activeTicketId}
          onClose={() => setActiveTicketId(null)}
          onReplied={refresh}
        />
      )}
    </Card>
  );
}

function NewTicketDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await createSupportTicket({ subject, description, priority: priority as "low" | "normal" | "high" | "urgent" });
      if (!result.success) return setError(result.error);
      setSubject("");
      setDescription("");
      setPriority("normal");
      onOpenChange(false);
      onCreated();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> New ticket
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contact ATP Fitness support</DialogTitle>
          <DialogDescription>A member of the platform team will reply here.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="What's going on?"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={isPending} onClick={onSubmit}>
            Submit ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TicketDetailDialog({
  ticketId, onClose, onReplied,
}: { ticketId: string; onClose: () => void; onReplied: () => void }) {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["my-ticket", ticketId],
    queryFn: () => getMyTicketWithMessages(ticketId),
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onReply() {
    setError(null);
    if (!message.trim()) return setError("Write a message first.");
    startTransition(async () => {
      const result = await replyToMyTicket(ticketId, message);
      if (!result.success) return setError(result.error);
      setMessage("");
      onReplied();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {isLoading || !data?.success || !data.data ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{data.data.ticket.subject}</DialogTitle>
              <DialogDescription className="flex items-center gap-2">
                <TicketStatusBadge status={data.data.ticket.status} />
                <TicketPriorityBadge priority={data.data.ticket.priority} />
              </DialogDescription>
            </DialogHeader>
            <p className="whitespace-pre-wrap rounded-xl bg-secondary/40 p-3 text-sm">{data.data.ticket.description}</p>

            <ul className="space-y-2">
              {data.data.messages.map((m) => (
                <li key={m.id} className="rounded-xl border bg-secondary/20 p-3 text-sm">
                  <p className="whitespace-pre-wrap">{m.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(new Date(m.created_at), "dd MMM yyyy, HH:mm")}
                  </p>
                </li>
              ))}
            </ul>

            <div className="space-y-2 border-t pt-3">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Reply…"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end">
                <Button size="sm" loading={isPending} onClick={onReply}>
                  Send
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
