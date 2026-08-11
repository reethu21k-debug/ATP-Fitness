import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

export function StatCard({
  label, value, icon: Icon, tone = "default",
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warning" | "destructive" | "success";
}) {
  const toneClass = {
    default: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
    success: "bg-success/10 text-success",
  }[tone];

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
