"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Lock, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { TicketStatusBadge, TicketPriorityBadge } from "./ticket-badges";
import { replyToTicket, updateTicketStatus } from "@/lib/actions/platform.actions";
import type { SupportTicket, SupportTicketMessage } from "@/types/database";

const STATUS_OPTIONS = ["open", "in_progress", "resolved", "closed"];
const PRIORITY_OPTIONS = ["low", "normal", "high", "urgent"];

export function TicketThread({
  ticket, messages,
}: { ticket: SupportTicket; messages: SupportTicketMessage[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [statusPending, startStatusTransition] = useTransition();

  function onReply() {
    setError(null);
    if (!message.trim()) return setError("Write a message first.");
    startTransition(async () => {
      const result = await replyToTicket(ticket.id, message, isInternalNote);
      if (!result.success) return setError(result.error);
      setMessage("");
      setIsInternalNote(false);
      router.refresh();
    });
  }

  function onStatusChange(status: string) {
    startStatusTransition(async () => {
      await updateTicketStatus(ticket.id, { status });
      router.refresh();
    });
  }

  function onPriorityChange(priority: string) {
    startStatusTransition(async () => {
      await updateTicketStatus(ticket.id, { priority });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{ticket.subject}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Opened {format(new Date(ticket.created_at), "dd MMM yyyy, HH:mm")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Status</span>
          <Select
            value={ticket.status}
            onChange={(e) => onStatusChange(e.target.value)}
            disabled={statusPending}
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm capitalize"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Priority</span>
          <Select
            value={ticket.priority}
            onChange={(e) => onPriorityChange(e.target.value)}
            disabled={statusPending}
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm capitalize"
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
        <TicketStatusBadge status={ticket.status} />
        <TicketPriorityBadge priority={ticket.priority} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Original request</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
          <CardDescription>Internal notes are only visible to super admins, never to the tenant.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No replies yet.</p>
          ) : (
            <ul className="space-y-3">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={`rounded-xl border p-3 text-sm ${
                    m.is_internal_note ? "border-warning/30 bg-warning/5" : "bg-secondary/30"
                  }`}
                >
                  {m.is_internal_note && (
                    <p className="mb-1 flex items-center gap-1 text-xs font-medium text-warning">
                      <Lock className="h-3 w-3" /> Internal note
                    </p>
                  )}
                  <p className="whitespace-pre-wrap">{m.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(new Date(m.created_at), "dd MMM yyyy, HH:mm")}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2 border-t pt-4">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Write a reply…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={isInternalNote}
                  onChange={(e) => setIsInternalNote(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Internal note (not visible to the tenant)
              </label>
              <Button size="sm" loading={isPending} onClick={onReply}>
                <Send className="h-4 w-4" /> Send
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
