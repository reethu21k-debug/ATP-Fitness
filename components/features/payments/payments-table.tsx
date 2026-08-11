"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { listPayments } from "@/lib/actions/payment.actions";

const METHOD_FILTERS = [
  { value: "all", label: "All methods" },
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "bank", label: "Bank" },
  { value: "split", label: "Split" },
];

export function PaymentsTable({ basePath }: { basePath: string }) {
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data, isLoading } = useQuery({
    queryKey: ["payments", { page, search, method }],
    queryFn: () => listPayments({ page, pageSize, search, method }),
    placeholderData: keepPreviousData,
  });

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((data?.total ?? 0) / pageSize)),
    [data?.total],
  );
  const totalCollected = useMemo(
    () =>
      (data?.rows ?? [])
        .filter((r) => !r.is_refunded)
        .reduce((sum, r) => sum + r.total_amount, 0),
    [data?.rows],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search invoice, receipt, member…"
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            {METHOD_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          This page:{" "}
          <span className="font-medium text-foreground">
            ₹{totalCollected.toFixed(2)}
          </span>
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-secondary/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    Loading payments…
                  </td>
                </tr>
              )}
              {!isLoading && (data?.rows.length ?? 0) === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No payments found.
                  </td>
                </tr>
              )}
              {data?.rows.map((p) => (
                <tr
                  key={p.id}
                  className="border-b last:border-0 hover:bg-accent/40"
                >
                  <td className="px-4 py-3">
                    {format(new Date(p.created_at), "dd MMM yyyy")}
                  </td>
                  <td className="px-4 py-3 font-medium">{p.member_name}</td>
                  <td className="px-4 py-3">{p.plan_name ?? "—"}</td>
                  <td className="px-4 py-3 capitalize">{p.method}</td>
                  <td className="px-4 py-3">₹{p.total_amount}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {p.invoice_number}
                  </td>
                  <td className="px-4 py-3">
                    {p.is_refunded ? "Refunded" : "Paid"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`${basePath}/${p.id}/invoice`}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <Receipt className="h-3.5 w-3.5" /> Invoice
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {page} of {totalPages} · {data?.total ?? 0} payments
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
