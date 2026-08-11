import { cn } from "@/lib/utils/cn";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-warning/10 text-warning",
  in_progress: "bg-primary/10 text-primary",
  resolved: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
};

export function TicketStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", STATUS_STYLES[status] ?? "bg-muted")}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-primary/10 text-primary",
  high: "bg-warning/10 text-warning",
  urgent: "bg-destructive/10 text-destructive",
};

export function TicketPriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", PRIORITY_STYLES[priority] ?? "bg-muted")}>
      {priority}
    </span>
  );
}
