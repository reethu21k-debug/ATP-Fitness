"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MemberStatusBadge } from "./status-badge";
import { RenewOrPayDialog } from "./renew-or-pay-dialog";
import { deactivateMember, deleteMember } from "@/lib/actions/member.actions";
import { sendManualRenewalReminder } from "@/lib/actions/renewal.actions";
import type { MembersOverviewRow, PaymentsOverviewRow } from "@/types/database";
import {
  Mail,
  Phone,
  Calendar,
  UserX,
  Trash2,
  Receipt,
  BellRing,
} from "lucide-react";

const TABS = ["Overview", "Membership", "Medical", "Documents"] as const;
type Tab = (typeof TABS)[number];

interface PlanOption {
  id: string;
  name: string;
  duration_days: number;
  price: number;
}
interface TrainerOption {
  id: string;
  full_name: string;
}

export function MemberProfileView({
  member,
  basePath,
  canDelete,
  plans,
  trainers,
  paymentHistory,
}: {
  member: MembersOverviewRow;
  basePath: string;
  canDelete: boolean;
  plans: PlanOption[];
  trainers: TrainerOption[];
  paymentHistory: PaymentsOverviewRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Overview");
  const [isPending, startTransition] = useTransition();
  const [reminderStatus, setReminderStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isSendingReminder, startReminderTransition] = useTransition();

  function handleDeactivate() {
    if (!confirm(`Deactivate ${member.full_name}'s membership?`)) return;
    startTransition(async () => {
      await deactivateMember(member.profile_id);
      router.refresh();
    });
  }

  function handleDelete() {
    if (
      !confirm(`Permanently delete ${member.full_name}? This cannot be undone.`)
    )
      return;
    startTransition(async () => {
      const result = await deleteMember(member.profile_id);
      if (result.success) router.push(basePath);
    });
  }

  function handleSendReminder() {
    if (!member.membership_id) return;
    setReminderStatus(null);
    startReminderTransition(async () => {
      const result = await sendManualRenewalReminder(member.membership_id!);
      setReminderStatus(
        result.success
          ? { type: "success", message: "Reminder email sent." }
          : { type: "error", message: result.error },
      );
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xl font-medium text-primary">
            {member.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={member.avatar_url}
                alt={member.full_name}
                className="h-full w-full object-cover"
              />
            ) : (
              member.full_name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {member.full_name}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <MemberStatusBadge status={member.status} />
              {member.plan_name && (
                <span className="text-sm text-muted-foreground">
                  {member.plan_name}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <RenewOrPayDialog
            memberId={member.profile_id}
            currentMembershipId={member.membership_id}
            plans={plans}
            trainers={trainers}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeactivate}
            loading={isPending}
          >
            <UserX className="h-4 w-4" /> Deactivate
          </Button>
          {canDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              loading={isPending}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? "bg-background shadow-soft" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <Card>
          <CardContent className="grid gap-6 p-6 sm:grid-cols-2">
            <InfoRow icon={Mail} label="Email" value={member.email} />
            <InfoRow icon={Phone} label="Phone" value={member.phone} />
            <InfoRow
              icon={Calendar}
              label="Joined"
              value={
                member.joining_date
                  ? format(new Date(member.joining_date), "dd MMM yyyy")
                  : null
              }
            />
            <InfoRow
              icon={Calendar}
              label="Date of birth"
              value={
                member.date_of_birth
                  ? format(new Date(member.date_of_birth), "dd MMM yyyy")
                  : null
              }
            />
            <InfoRow label="Gender" value={member.gender} />
            <InfoRow
              label="Trainer"
              value={member.trainer_name ?? "Unassigned"}
            />
          </CardContent>
        </Card>
      )}

      {tab === "Membership" && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <InfoRow label="Plan" value={member.plan_name} />
                <InfoRow label="Payment status" value={member.payment_status} />
                <InfoRow
                  label="Start date"
                  value={
                    member.start_date
                      ? format(new Date(member.start_date), "dd MMM yyyy")
                      : null
                  }
                />
                <InfoRow
                  label="End date"
                  value={
                    member.end_date
                      ? format(new Date(member.end_date), "dd MMM yyyy")
                      : null
                  }
                />
                <InfoRow
                  label="Amount"
                  value={member.amount ? `₹${member.amount}` : null}
                />
                <InfoRow
                  label="Amount paid"
                  value={member.amount_paid ? `₹${member.amount_paid}` : null}
                />
              </div>
              {member.membership_id && (
                <div className="mt-6 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Send a renewal reminder email now — works any time,
                    including after expiry.
                  </p>
                  <div className="flex items-center gap-3">
                    {reminderStatus && (
                      <span
                        className={`text-xs ${reminderStatus.type === "success" ? "text-success" : "text-destructive"}`}
                      >
                        {reminderStatus.message}
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSendReminder}
                      loading={isSendingReminder}
                    >
                      <BellRing className="h-4 w-4" /> Send reminder
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Receipt className="h-4 w-4" /> Payment history
            </h3>
            {paymentHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No payments recorded yet.
              </p>
            ) : (
              <div className="overflow-hidden rounded-2xl border bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b bg-secondary/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Invoice</th>
                        <th className="px-4 py-2.5">Method</th>
                        <th className="px-4 py-2.5">Amount</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {paymentHistory.map((p) => (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="px-4 py-2.5">
                            {format(new Date(p.created_at), "dd MMM yyyy")}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs">
                            {p.invoice_number}
                          </td>
                          <td className="px-4 py-2.5 capitalize">{p.method}</td>
                          <td className="px-4 py-2.5">₹{p.total_amount}</td>
                          <td className="px-4 py-2.5">
                            {p.is_refunded ? "Refunded" : "Paid"}
                          </td>
                          <td className="px-4 py-2.5">
                            <Link
                              href={`${basePath.split("/members")[0]}/payments/${p.id}/invoice`}
                              className="text-primary hover:underline"
                            >
                              View invoice
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "Medical" && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Medical details (blood group, conditions, emergency contact) are
            stored on this member's record. Full inline editing arrives in the
            Trainer module pass — for now this data is visible to trainers and
            gym owners via the database directly.
          </CardContent>
        </Card>
      )}

      {tab === "Documents" && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Certificates, transformation photos, and medical documents uploaded
            for this member will appear here. Upload UI ships with the Trainer
            module.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </p>
      <p className="mt-1 text-sm font-medium capitalize">{value || "—"}</p>
    </div>
  );
}
