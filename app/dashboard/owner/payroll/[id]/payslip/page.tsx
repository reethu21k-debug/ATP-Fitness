import { notFound } from "next/navigation";
import { getPayslipDetail } from "@/lib/actions/payroll.actions";
import { PayslipView } from "@/components/features/payroll/payslip-view";

export default async function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { payslip, gym } = await getPayslipDetail(id);
  if (!payslip) notFound();

  return <PayslipView payslip={payslip} gym={gym} />;
}
