import { cn } from "@/lib/utils/cn";
import type { MemberStatus } from "@/types/database";

const STYLES: Record<MemberStatus, string> = {
  active: "bg-success/10 text-success",
  inactive: "bg-muted text-muted-foreground",
  expired: "bg-destructive/10 text-destructive",
  frozen: "bg-warning/10 text-warning",
  cancelled: "bg-muted text-muted-foreground",
};

export function MemberStatusBadge({ status }: { status: MemberStatus | null }) {
  const s = status ?? "inactive";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", STYLES[s])}>
      {s}
    </span>
  );
}
