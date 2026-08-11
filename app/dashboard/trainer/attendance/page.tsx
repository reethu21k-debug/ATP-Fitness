import { AttendanceDashboard } from "@/components/features/attendance/attendance-dashboard";

export const metadata = { title: "Attendance — ATP Fitness" };

export default function TrainerAttendancePage() {
  return <AttendanceDashboard kioskPath="/dashboard/trainer/attendance/kiosk" />;
}