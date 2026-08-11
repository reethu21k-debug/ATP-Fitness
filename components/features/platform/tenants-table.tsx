"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Building2,
} from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SubscriptionStatusBadge } from "./subscription-status-badge";
import { listTenants } from "@/lib/actions/platform.actions";
import type { TenantOverviewRow } from "@/types/database";

const columnHelper = createColumnHelper<TenantOverviewRow>();

const columns = [
  columnHelper.accessor("name", {
    header: "Tenant",
    cell: (info) => {
      const row = info.row.original;
      return (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary">
            {row.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.logo_url}
                alt={row.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <Building2 className="h-4 w-4" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">{row.name}</p>
            <p className="text-xs text-muted-foreground">
              {row.owner_full_name ?? row.owner_email ?? "No owner"}
            </p>
          </div>
        </div>
      );
    },
  }),
  columnHelper.accessor("subscription_plan", {
    header: "Plan",
    cell: (info) => (
      <span className="text-sm capitalize">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor("subscription_status", {
    header: "Status",
    cell: (info) => <SubscriptionStatusBadge status={info.getValue()} />,
  }),
  columnHelper.accessor("gym_count", {
    header: "Gyms",
    cell: (info) => <span className="text-sm">{info.getValue()}</span>,
  }),
  columnHelper.accessor("member_count", {
    header: "Members",
    cell: (info) => <span className="text-sm">{info.getValue()}</span>,
  }),
  columnHelper.accessor("trial_ends_at", {
    header: "Trial ends",
    cell: (info) => {
      const val = info.getValue();
      return val ? (
        <span className="text-sm text-muted-foreground">
          {format(new Date(val), "dd MMM yyyy")}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  }),
  columnHelper.accessor("created_at", {
    header: "Joined",
    cell: (info) => (
      <span className="text-sm text-muted-foreground">
        {format(new Date(info.getValue()), "dd MMM yyyy")}
      </span>
    ),
  }),
];

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "trialing", label: "Trialing" },
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past due" },
  { value: "suspended", label: "Suspended" },
  { value: "canceled", label: "Canceled" },
];

export function TenantsTable() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);
  const pageSize = 10;

  const sortBy = sorting[0]?.id ?? "created_at";
  const sortDir = sorting[0]?.desc ? "desc" : "asc";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["platform-tenants", { page, search, status, sortBy, sortDir }],
    queryFn: () =>
      listTenants({ page, pageSize, search, status, sortBy, sortDir }),
    placeholderData: keepPreviousData,
  });

  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
  });

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((data?.total ?? 0) / pageSize)),
    [data?.total],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tenants, owners…"
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
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
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b bg-secondary/40">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-xs font-medium text-muted-foreground"
                    >
                      <button
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    Loading tenants…
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-10 text-center text-sm text-destructive"
                  >
                    Could not load tenants. Try refreshing.
                  </td>
                </tr>
              )}
              {!isLoading &&
                !isError &&
                table.getRowModel().rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                    >
                      No tenants match your filters.
                    </td>
                  </tr>
                )}
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b last:border-0 hover:bg-accent/40"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      <Link
                        href={`/dashboard/platform/tenants/${row.original.id}`}
                        className="block"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </Link>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {page} of {totalPages} · {data?.total ?? 0} tenants
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
