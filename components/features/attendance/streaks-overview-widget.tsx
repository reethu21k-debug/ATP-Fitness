import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MemberStreakOverviewRow } from "@/types/database";
import { Flame, AlertTriangle } from "lucide-react";

function MemberRow({ row, showRisk }: { row: MemberStreakOverviewRow; showRisk?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-medium">{row.member_name}</span>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        {showRisk && (
          <span className="flex items-center gap-1 text-xs text-warning">
            <AlertTriangle className="h-3.5 w-3.5" />
            {row.days_since_checkin === 1 ? "Missed yesterday" : `${row.days_since_checkin}d since last visit`}
            {row.grace_used ? " · no grace left" : ""}
          </span>
        )}
        <span className="flex items-center gap-1 font-semibold text-orange-500">
          <Flame className="h-3.5 w-3.5" /> {row.current_streak}
        </span>
      </div>
    </div>
  );
}

export function StreaksOverviewWidget({
  topStreaks,
  atRisk,
}: {
  topStreaks: MemberStreakOverviewRow[];
  atRisk: MemberStreakOverviewRow[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Top streaks</CardTitle>
        </CardHeader>
        <CardContent>
          {topStreaks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active streaks yet.</p>
          ) : (
            <div className="divide-y">
              {topStreaks.map((row) => (
                <MemberRow key={row.member_id} row={row} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Streaks at risk</CardTitle>
        </CardHeader>
        <CardContent>
          {atRisk.length === 0 ? (
            <p className="text-sm text-muted-foreground">No streaks at risk right now.</p>
          ) : (
            <div className="divide-y">
              {atRisk.map((row) => (
                <MemberRow key={row.member_id} row={row} showRisk />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}