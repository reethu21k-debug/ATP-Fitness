"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { listExpiringMembers } from "@/lib/actions/member.actions";
import { sendManualRenewalReminder } from "@/lib/actions/renewal.actions";
import type { MembersOverviewRow } from "@/types/database";

const PAGE_SIZE = 10;
const EXPIRING_WINDOW_DAYS = 10;

function CountdownBadge({ daysUntilExpiry }: { daysUntilExpiry: number | null }) {
  if (daysUntilExpiry === null) return <span className="text-muted-foreground">—</span>;

  if (daysUntilExpiry < 0) {
    const overdue = Math.abs(daysUntilExpiry);
    return <Badge variant="destructive">{overdue === 1 ? "1 day overdue" : `${overdue} days overdue`}</Badge>;
  }
  if (daysUntilExpiry === 0) return <Badge variant="destructive">Expires today</Badge>;
  if (daysUntilExpiry === 1) return <Badge variant="warning">1 day left</Badge>;
  return <Badge variant={daysUntilExpiry <= 3 ? "warning" : "secondary"}>{daysUntilExpiry} days left</Badge>;
}

function MemberRow({
  member,
  memberDetailPath,
  canRemind,
}: {
  member: MembersOverviewRow;
  memberDetailPath: string;
  canRemind: boolean;
}) {
  const [sending, setSending] = useState(false);
  const [sentJustNow, setSentJustNow] = useState(false);

  async function handleRemind() {
    if (!member.membership_id) return;
    setSending(true);
    const result = await sendManualRenewalReminder(member.membership_id);
    setSending(false);
    if (result.success) setSentJustNow(true);
  }

  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3">
        <Link href={`${memberDetailPath}/${member.profile_id}`} className="flex items-center gap-3 hover:underline">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-medium text-primary">
            {member.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={member.avatar_url} alt={member.full_name} className="h-full w-full object-cover" />
            ) : (
              member.full_name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p className="text-sm font-medium">{member.full_name}</p>
            <p className="text-xs text-muted-foreground">{member.email}</p>
          </div>
        </Link>
      </td>
      <td className="px-4 py-3 text-sm">{member.plan_name ?? <span className="text-muted-foreground">No active plan</span>}</td>
      <td className="px-4 py-3 text-sm">{member.end_date ? format(new Date(member.end_date), "dd MMM yyyy") : "—"}</td>
      <td className="px-4 py-3">
        <CountdownBadge daysUntilExpiry={member.days_until_expiry} />
      </td>
      <td className="px-4 py-3 text-sm">{member.trainer_name ?? <span className="text-muted-foreground">Unassigned</span>}</td>
      {canRemind && (
        <td className="px-4 py-3 text-right">
          <Button size="sm" variant="outline" disabled={sending || sentJustNow} onClick={handleRemind}>
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : sentJustNow ? (
              "Sent"
            ) : (
              <>
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Remind
              </>
            )}
          </Button>
        </td>
      )}
    </tr>
  );
}

function RenewalsList({
  window,
  memberDetailPath,
  canRemind,
}: {
  window: "expiring_soon" | "expired";
  memberDetailPath: string;
  canRemind: boolean;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["expiring-members", window, { page, search }],
    queryFn: () => listExpiringMembers({ window, page, pageSize: PAGE_SIZE, search, withinDays: EXPIRING_WINDOW_DAYS }),
    placeholderData: keepPreviousData,
  });

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
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

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b bg-secondary/40">
              <tr>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Member</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Plan</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                  {window === "expiring_soon" ? "Expires on" : "Expired on"}
                </th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                  {window === "expiring_soon" ? "Countdown" : "Overdue by"}
                </th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Trainer</th>
                {canRemind && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={canRemind ? 6 : 5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={canRemind ? 6 : 5} className="px-4 py-10 text-center text-sm text-destructive">
                    Couldn&apos;t load members. Try again.
                  </td>
                </tr>
              ) : data?.rows.length === 0 ? (
                <tr>
                  <td colSpan={canRemind ? 6 : 5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    {window === "expiring_soon"
                      ? `No memberships expiring in the next ${EXPIRING_WINDOW_DAYS} days.`
                      : "No expired memberships — nice and current."}
                  </td>
                </tr>
              ) : (
                data?.rows.map((m) => (
                  <MemberRow key={m.profile_id} member={m} memberDetailPath={memberDetailPath} canRemind={canRemind} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(data?.total ?? 0) > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages} · {data?.total} members
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function RenewalsPanel({
  memberDetailPath,
  canRemind,
}: {
  /** e.g. "/dashboard/owner/members" or "/dashboard/trainer/clients" */
  memberDetailPath: string;
  /** Whether to show the "Remind" button — hide it for roles without
   *  members:update permission so they don't hit a guaranteed-to-fail action. */
  canRemind: boolean;
}) {
  return (
    <Tabs defaultValue="expiring_soon">
      <TabsList>
        <TabsTrigger value="expiring_soon">Expiring soon ({EXPIRING_WINDOW_DAYS}d)</TabsTrigger>
        <TabsTrigger value="expired">Already expired</TabsTrigger>
      </TabsList>
      <TabsContent value="expiring_soon" className="mt-4">
        <RenewalsList window="expiring_soon" memberDetailPath={memberDetailPath} canRemind={canRemind} />
      </TabsContent>
      <TabsContent value="expired" className="mt-4">
        <RenewalsList window="expired" memberDetailPath={memberDetailPath} canRemind={canRemind} />
      </TabsContent>
    </Tabs>
  );
}