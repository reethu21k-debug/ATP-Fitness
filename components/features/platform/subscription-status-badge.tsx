import { cn } from "@/lib/utils/cn";
import type { SubscriptionStatus } from "@/types/database";

const STYLES: Record<SubscriptionStatus, string> = {
  trialing: "bg-primary/10 text-primary",
  active: "bg-success/10 text-success",
  past_due: "bg-warning/10 text-warning",
  canceled: "bg-muted text-muted-foreground",
  suspended: "bg-destructive/10 text-destructive",
};

const LABELS: Record<SubscriptionStatus, string> = {
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  suspended: "Suspended",
};

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", STYLES[status])}>
      {LABELS[status]}
    </span>
  );
}
