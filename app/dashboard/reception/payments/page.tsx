import { PaymentsTable } from "@/components/features/payments/payments-table";

export const metadata = { title: "Payments — ATP Fitness" };

export default function ReceptionPaymentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">Print invoices and look up past receipts.</p>
      </div>
      <PaymentsTable basePath="/dashboard/reception/payments" />
    </div>
  );
}
