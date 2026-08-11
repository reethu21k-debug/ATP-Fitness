import { Card, CardContent } from "@/components/ui/card";
import type { MemberStreak } from "@/types/database";
import { Flame, Trophy } from "lucide-react";

export function StreakCard({ streak }: { streak: MemberStreak | null }) {
  const current = streak?.current_streak ?? 0;
  const longest = streak?.longest_streak ?? 0;
  const graceAvailable = streak != null && current > 0 && !streak.grace_used;

  return (
    <Card className={current > 0 ? "border-orange-500/30 bg-orange-500/5" : ""}>
      <CardContent className="flex items-center gap-4 p-6">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
          <Flame className="h-7 w-7" />
        </div>
        <div className="flex-1">
          <p className="text-2xl font-bold leading-none">
            {current} {current === 1 ? "day" : "days"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {current > 0 ? "Current check-in streak" : "No active streak — check in to start one"}
          </p>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Trophy className="h-3.5 w-3.5" /> Best: {longest} {longest === 1 ? "day" : "days"}
            </span>
            {current > 0 && (
              <span>
                {graceAvailable ? "1 grace day available this week" : "Grace day used this week"}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}