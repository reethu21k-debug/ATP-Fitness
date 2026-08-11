import { AttendanceDashboard } from "@/components/features/attendance/attendance-dashboard";

export const metadata = { title: "Attendance — ATP Fitness" };

export default function ReceptionAttendancePage() {
  return <AttendanceDashboard kioskPath="/dashboard/reception/attendance/kiosk" />;
}
