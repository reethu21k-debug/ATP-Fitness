import Link from "next/link";
import { format } from "date-fns";
import { Users, Clock, Timer, Monitor } from "lucide-react";
import {
  getTodayAttendance,
  getAttendanceStats,
  getGymStreaksOverview,
} from "@/lib/actions/attendance.actions";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { PeakHoursChart } from "@/components/features/attendance/peak-hours-chart";
import { StreaksOverviewWidget } from "@/components/features/attendance/streaks-overview-widget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export async function AttendanceDashboard({
  kioskPath,
}: {
  kioskPath: string;
}) {
  const [today, stats, streaks] = await Promise.all([
    getTodayAttendance(),
    getAttendanceStats(),
    getGymStreaksOverview(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live check-ins, peak hours, and today's visits.
          </p>
        </div>
        <Button asChild variant="outline" className="sm:shrink-0">
          <Link href={kioskPath}>
            <Monitor className="h-4 w-4" /> Open check-in kiosk
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Checked in today"
          value={stats.todayCount}
          icon={Users}
        />
        <StatCard
          label="Avg. workout duration"
          value={`${stats.avgDurationMinutes} min`}
          icon={Timer}
          tone="success"
        />
        <StatCard
          label="Currently in gym"
          value={today.filter((t) => !t.check_out_at).length}
          icon={Clock}
          tone="warning"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Peak hours (last 30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <PeakHoursChart data={stats.peakHours} />
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-3 text-sm font-semibold">Check-in streaks</h3>
        <StreaksOverviewWidget topStreaks={streaks.topStreaks} atRisk={streaks.atRisk} />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">Today's members</h3>
        {today.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No check-ins yet today.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-secondary/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5">Member</th>
                    <th className="px-4 py-2.5">Check in</th>
                    <th className="px-4 py-2.5">Check out</th>
                    <th className="px-4 py-2.5">Duration</th>
                    <th className="px-4 py-2.5">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {today.map((t) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-medium">
                        {t.member_name}
                      </td>
                      <td className="px-4 py-2.5">
                        {format(new Date(t.check_in_at), "h:mm a")}
                      </td>
                      <td className="px-4 py-2.5">
                        {t.check_out_at ? (
                          format(new Date(t.check_out_at), "h:mm a")
                        ) : (
                          <span className="text-success">In gym</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {t.duration_minutes != null
                          ? `${t.duration_minutes} min`
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 capitalize">
                        {t.method}
                        {t.gps_verified ? " · GPS" : ""}
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
  );
}