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
  Plus,
  ArrowUpDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { MemberStatusBadge } from "./status-badge";
import { listMembers } from "@/lib/actions/member.actions";
import type { MembersOverviewRow } from "@/types/database";
import { format } from "date-fns";

const columnHelper = createColumnHelper<MembersOverviewRow>();

const columns = [
  columnHelper.accessor("full_name", {
    header: "Member",
    cell: (info) => {
      const row = info.row.original;
      return (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-medium text-primary">
            {row.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.avatar_url}
                alt={row.full_name}
                className="h-full w-full object-cover"
              />
            ) : (
              row.full_name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p className="text-sm font-medium">{row.full_name}</p>
            <p className="text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
      );
    },
  }),
  columnHelper.accessor("plan_name", {
    header: "Plan",
    cell: (info) =>
      info.getValue() ?? (
        <span className="text-muted-foreground">No active plan</span>
      ),
  }),
  columnHelper.accessor("end_date", {
    header: "Expires",
    cell: (info) => {
      const val = info.getValue();
      const daysLeft = info.row.original.days_until_expiry;
      if (!val) return <span className="text-muted-foreground">—</span>;
      return (
        <div>
          <p className="text-sm">{format(new Date(val), "dd MMM yyyy")}</p>
          {daysLeft !== null && (
            <p
              className={`text-xs ${daysLeft <= 7 ? "text-destructive" : "text-muted-foreground"}`}
            >
              {daysLeft >= 0
                ? `${daysLeft} days left`
                : `Expired ${Math.abs(daysLeft)}d ago`}
            </p>
          )}
        </div>
      );
    },
  }),
  columnHelper.accessor("trainer_name", {
    header: "Trainer",
    cell: (info) =>
      info.getValue() ?? (
        <span className="text-muted-foreground">Unassigned</span>
      ),
  }),
  columnHelper.accessor("payment_status", {
    header: "Payment",
    cell: (info) => (
      <span className="text-sm capitalize">{info.getValue() ?? "—"}</span>
    ),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => <MemberStatusBadge status={info.getValue()} />,
  }),
];

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "frozen", label: "Frozen" },
  { value: "cancelled", label: "Cancelled" },
];

export function MembersTable({ basePath }: { basePath: string }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "full_name", desc: false },
  ]);
  const pageSize = 10;

  const sortBy = sorting[0]?.id ?? "full_name";
  const sortDir = sorting[0]?.desc ? "desc" : "asc";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["members", { page, search, status, sortBy, sortDir }],
    queryFn: () =>
      listMembers({ page, pageSize, search, status, sortBy, sortDir }),
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
              placeholder="Search members…"
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
        <Button asChild>
          <Link href={`${basePath}/new`}>
            <Plus className="h-4 w-4" /> Add member
          </Link>
        </Button>
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
                    Loading members…
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-10 text-center text-sm text-destructive"
                  >
                    Could not load members. Try refreshing.
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
                      No members match your filters.
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
                        href={`${basePath}/${row.original.profile_id}`}
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
          Page {page} of {totalPages} · {data?.total ?? 0} members
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
