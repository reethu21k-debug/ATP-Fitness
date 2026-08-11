import { cn } from "@/lib/utils/cn";
import type { InvoiceStatus } from "@/types/database";

const STYLES: Record<InvoiceStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-warning/10 text-warning",
  paid: "bg-success/10 text-success",
  void: "bg-muted text-muted-foreground",
  uncollectible: "bg-destructive/10 text-destructive",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", STYLES[status])}>
      {status}
    </span>
  );
}
