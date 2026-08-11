"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { TicketStatusBadge, TicketPriorityBadge } from "./ticket-badges";
import { listSupportTickets } from "@/lib/actions/platform.actions";

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_FILTERS = [
  { value: "all", label: "All priorities" },
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function TicketsTable() {
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data, isLoading } = useQuery({
    queryKey: ["platform-tickets", { page, status, priority }],
    queryFn: () => listSupportTickets({ page, pageSize, status, priority }),
    placeholderData: keepPreviousData,
  });

  const tickets = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
        <Select
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          {PRIORITY_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b bg-secondary/40">
              <tr>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                  Subject
                </th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                  Tenant
                </th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                  Priority
                </th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                  Opened
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    Loading tickets…
                  </td>
                </tr>
              )}
              {!isLoading && tickets.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No tickets match your filters.
                  </td>
                </tr>
              )}
              {tickets.map((t) => (
                <tr
                  key={t.id}
                  className="border-b last:border-0 hover:bg-accent/40"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/platform/tickets/${t.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {t.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {t.tenants?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <TicketPriorityBadge priority={t.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <TicketStatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {format(new Date(t.created_at), "dd MMM yyyy")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {page} of {totalPages} · {total} tickets
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
