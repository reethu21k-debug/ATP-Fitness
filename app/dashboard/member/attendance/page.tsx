import { getMyAttendanceStatus, getMyAttendanceHistory, getMyStreak } from "@/lib/actions/attendance.actions";
import { MemberAttendanceView } from "@/components/features/attendance/member-attendance-view";
import { StreakCard } from "@/components/features/attendance/streak-card";

export const metadata = { title: "Attendance — ATP Fitness" };

export default async function MemberAttendancePage() {
  const [{ checkedIn, session }, history, streak] = await Promise.all([
    getMyAttendanceStatus(),
    getMyAttendanceHistory(),
    getMyStreak(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
        <p className="mt-1 text-sm text-muted-foreground">Scan the front-desk QR code to check in.</p>
      </div>
      <StreakCard streak={streak} />
      <MemberAttendanceView checkedIn={checkedIn} session={session} history={history} />
    </div>
  );
}