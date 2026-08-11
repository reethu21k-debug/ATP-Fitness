import { AttendanceDashboard } from "@/components/features/attendance/attendance-dashboard";

export const metadata = { title: "Attendance — ATP Fitness" };

export default function OwnerAttendancePage() {
  return <AttendanceDashboard kioskPath="/dashboard/owner/attendance/kiosk" />;
}
