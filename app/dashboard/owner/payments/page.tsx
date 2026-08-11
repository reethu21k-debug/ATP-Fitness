import { PaymentsTable } from "@/components/features/payments/payments-table";

export const metadata = { title: "Payments — ATP Fitness" };

export default function OwnerPaymentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every invoice and receipt, searchable in one place.</p>
      </div>
      <PaymentsTable basePath="/dashboard/owner/payments" />
    </div>
  );
}
