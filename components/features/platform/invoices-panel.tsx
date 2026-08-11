"use client";

import { useState } from "react";
import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { InvoiceDialog } from "./invoice-dialog";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import {
  listPlatformInvoices,
  listTenants,
  listSubscriptionPlans,
  markInvoicePaid,
  voidInvoice,
} from "@/lib/actions/platform.actions";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
  { value: "uncollectible", label: "Uncollectible" },
];

export function InvoicesPanel() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const invoicesQuery = useQuery({
    queryKey: ["platform-invoices", { page, status }],
    queryFn: () => listPlatformInvoices({ page, pageSize, status }),
    placeholderData: keepPreviousData,
  });

  const tenantsQuery = useQuery({
    queryKey: ["platform-tenants-for-invoice"],
    queryFn: () =>
      listTenants({ page: 1, pageSize: 200, sortBy: "name", sortDir: "asc" }),
  });

  const plansQuery = useQuery({
    queryKey: ["platform-plans-for-invoice"],
    queryFn: () => listSubscriptionPlans(),
  });

  const invoices = invoicesQuery.data?.rows ?? [];
  const total = invoicesQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const tenants = tenantsQuery.data?.rows ?? [];
  const plans = plansQuery.data?.success ? (plansQuery.data.data ?? []) : [];

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["platform-invoices"] });
  }

  async function onMarkPaid(id: string) {
    await markInvoicePaid(id);
    refresh();
  }

  async function onVoid(id: string) {
    await voidInvoice(id);
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <InvoiceDialog tenants={tenants} plans={plans} onSaved={refresh} />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b bg-secondary/40">
              <tr>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                  Invoice #
                </th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                  Tenant
                </th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                  Period
                </th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                  Amount
                </th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                  Due
                </th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {invoicesQuery.isLoading && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    Loading invoices…
                  </td>
                </tr>
              )}
              {!invoicesQuery.isLoading && invoices.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No invoices yet.
                  </td>
                </tr>
              )}
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b last:border-0">
                  <td className="px-4 py-3 text-sm font-medium">
                    {inv.invoice_number}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {inv.tenants?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {format(new Date(inv.billing_period_start), "dd MMM")} –{" "}
                    {format(new Date(inv.billing_period_end), "dd MMM yyyy")}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    ₹{inv.amount.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {inv.due_at
                      ? format(new Date(inv.due_at), "dd MMM yyyy")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {inv.status === "open" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onMarkPaid(inv.id)}
                        >
                          Mark paid
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onVoid(inv.id)}
                        >
                          Void
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {page} of {totalPages} · {total} invoices
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
