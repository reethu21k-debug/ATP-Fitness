import Link from "next/link";
import { format } from "date-fns";
import { Wallet, Download, FileText } from "lucide-react";
import { getCurrentProfile } from "@/lib/utils/permissions";
import { createClient } from "@/lib/supabase/server";
import { buildInvoiceDownloadUrl } from "@/lib/services/invoice-links";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MemberStatusBadge } from "@/components/features/members/status-badge";

export const metadata = { title: "Membership — ATP Fitness" };

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return format(new Date(dateStr), "dd MMM yyyy");
}

export default async function MemberMembershipPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const [{ data: membership }, { data: payments }] = await Promise.all([
    supabase.from("members_overview").select("*").eq("profile_id", profile.id).single(),
    supabase
      .from("payments_overview")
      .select("*")
      .eq("member_id", profile.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Membership</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your plan, renewal date, and payment history.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Plan" value={membership?.plan_name ?? "No active plan"} icon={Wallet} />
        <StatCard
          label="Expires"
          value={membership?.end_date ? formatDate(membership.end_date) : "—"}
          icon={Wallet}
          tone="warning"
        />
        <StatCard
          label="Days left"
          value={membership?.days_until_expiry != null ? String(membership.days_until_expiry) : "—"}
          icon={Wallet}
          tone={membership?.days_until_expiry != null && membership.days_until_expiry <= 7 ? "warning" : "success"}
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current plan</p>
            <p className="mt-1 font-medium">{membership?.plan_name ?? "No active plan"}</p>
            {membership?.start_date && membership?.end_date && (
              <p className="mt-1 text-sm text-muted-foreground">
                {formatDate(membership.start_date)} – {formatDate(membership.end_date)}
              </p>
            )}
          </div>
          {membership?.status && <MemberStatusBadge status={membership.status} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-medium">Payment history</h2>
        </CardHeader>
        <CardContent className="p-0">
          {!payments || payments.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {payments.map((payment) => (
                <div key={payment.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{payment.plan_name ?? "Payment"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(payment.created_at)} · {payment.invoice_number} · {payment.method.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pl-12 sm:pl-0">
                    <span className="text-sm font-medium">₹{payment.total_amount.toFixed(2)}</span>
                    <Button asChild variant="outline" size="sm">
                      <Link href={buildInvoiceDownloadUrl(payment.invoice_number)}>
                        <Download className="h-3.5 w-3.5" />
                        Invoice
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}