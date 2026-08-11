"use client";

import { format } from "date-fns";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PayslipData {
  month: string;
  base_salary: number;
  commission_amount: number;
  bonus_amount: number;
  deductions_amount: number;
  present_days: number | null;
  total_working_days: number | null;
  net_pay: number;
  status: string;
  profiles: { full_name: string; role: string; email: string | null } | null;
}

export function PayslipView({ payslip, gym }: { payslip: PayslipData; gym: { name: string; address: string | null; city: string | null } | null }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex justify-end print-hide">
        <Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
      </div>

      <div className="rounded-2xl border bg-card p-8">
        <div className="flex items-start justify-between border-b pb-6">
          <div>
            <h1 className="text-xl font-semibold">{gym?.name ?? "ATP Fitness"}</h1>
            {gym?.address && <p className="mt-1 text-sm text-muted-foreground">{gym.address}{gym.city ? `, ${gym.city}` : ""}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-lg font-semibold">Payslip</h2>
            <p className="text-sm text-muted-foreground">{format(new Date(payslip.month), "MMMM yyyy")}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 border-b py-6 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Employee</p>
            <p className="mt-1 font-medium">{payslip.profiles?.full_name}</p>
            <p className="text-xs capitalize text-muted-foreground">{payslip.profiles?.role.replace("_", " ")}</p>
          </div>
          {payslip.present_days != null && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Attendance</p>
              <p className="mt-1">{payslip.present_days} / {payslip.total_working_days} days</p>
            </div>
          )}
        </div>

        <table className="w-full py-6 text-sm">
          <tbody>
            <tr className="border-b"><td className="py-2.5">Base salary</td><td className="py-2.5 text-right">₹{payslip.base_salary.toFixed(2)}</td></tr>
            <tr className="border-b"><td className="py-2.5">Commission</td><td className="py-2.5 text-right">₹{payslip.commission_amount.toFixed(2)}</td></tr>
            <tr className="border-b"><td className="py-2.5">Bonus</td><td className="py-2.5 text-right">₹{payslip.bonus_amount.toFixed(2)}</td></tr>
            <tr className="border-b"><td className="py-2.5">Deductions</td><td className="py-2.5 text-right text-destructive">−₹{payslip.deductions_amount.toFixed(2)}</td></tr>
          </tbody>
          <tfoot>
            <tr><td className="pt-4 font-semibold">Net pay</td><td className="pt-4 text-right font-semibold">₹{payslip.net_pay.toFixed(2)}</td></tr>
          </tfoot>
        </table>

        <div className="border-t pt-4 text-sm">
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="mt-1 capitalize">{payslip.status}</p>
        </div>
      </div>
    </div>
  );
}
