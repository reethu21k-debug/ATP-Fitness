import { getStaffList, listPayslips } from "@/lib/actions/payroll.actions";
import { PayrollDashboard } from "@/components/features/payroll/payroll-dashboard";

export const metadata = { title: "Payroll — ATP Fitness" };

export default async function OwnerPayrollPage() {
  const [staff, payslips] = await Promise.all([getStaffList(), listPayslips()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
        <p className="mt-1 text-sm text-muted-foreground">Salary, commission, bonuses, and payslips for your staff.</p>
      </div>
      <PayrollDashboard staff={staff} payslips={payslips} />
    </div>
  );
}
