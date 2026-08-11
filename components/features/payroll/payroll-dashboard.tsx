"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SalaryConfigDialog } from "./salary-config-dialog";
import { GeneratePayslipDialog } from "./generate-payslip-dialog";
import { Settings, FileText, Receipt } from "lucide-react";

interface StaffRow {
  id: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
  salaryConfig: { base_salary: number; commission_rate: number } | null;
}
interface PayslipRow {
  id: string;
  month: string;
  net_pay: number;
  status: string;
  profiles: { full_name: string; role: string } | null;
}

export function PayrollDashboard({
  staff,
  payslips,
}: {
  staff: StaffRow[];
  payslips: PayslipRow[];
}) {
  const [salaryDialogFor, setSalaryDialogFor] = useState<StaffRow | null>(null);
  const [payslipDialogFor, setPayslipDialogFor] = useState<StaffRow | null>(
    null,
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-3 text-sm font-semibold">Staff</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {s.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.avatar_url}
                        alt={s.full_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      s.full_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{s.full_name}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {s.role.replace("_", " ")}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Base: ₹{s.salaryConfig?.base_salary ?? 0}/mo · Commission:{" "}
                  {s.salaryConfig?.commission_rate ?? 0}%
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSalaryDialogFor(s)}
                  >
                    <Settings className="h-3.5 w-3.5" /> Salary
                  </Button>
                  <Button size="sm" onClick={() => setPayslipDialogFor(s)}>
                    <FileText className="h-3.5 w-3.5" /> Generate payslip
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">Payslip history</h2>
        {payslips.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No payslips generated yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-secondary/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5">Staff</th>
                    <th className="px-4 py-2.5">Month</th>
                    <th className="px-4 py-2.5">Net pay</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-medium">
                        {p.profiles?.full_name}
                      </td>
                      <td className="px-4 py-2.5">
                        {format(new Date(p.month), "MMMM yyyy")}
                      </td>
                      <td className="px-4 py-2.5">₹{p.net_pay}</td>
                      <td className="px-4 py-2.5 capitalize">{p.status}</td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/dashboard/owner/payroll/${p.id}/payslip`}
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <Receipt className="h-3.5 w-3.5" /> View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {salaryDialogFor && (
        <SalaryConfigDialog
          staffId={salaryDialogFor.id}
          staffName={salaryDialogFor.full_name}
          initialBase={salaryDialogFor.salaryConfig?.base_salary ?? 0}
          initialCommission={salaryDialogFor.salaryConfig?.commission_rate ?? 0}
          open={!!salaryDialogFor}
          onOpenChange={(open) => !open && setSalaryDialogFor(null)}
        />
      )}
      {payslipDialogFor && (
        <GeneratePayslipDialog
          staffId={payslipDialogFor.id}
          staffName={payslipDialogFor.full_name}
          open={!!payslipDialogFor}
          onOpenChange={(open) => !open && setPayslipDialogFor(null)}
        />
      )}
    </div>
  );
}
