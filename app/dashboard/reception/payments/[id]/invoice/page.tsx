import { notFound } from "next/navigation";
import { getPaymentForInvoice } from "@/lib/actions/payment.actions";
import { InvoiceView } from "@/components/features/payments/invoice-view";

export default async function ReceptionInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getPaymentForInvoice(id);
  if (!result) notFound();

  return <InvoiceView payment={result.payment} splits={result.splits} gym={result.gym} />;
}
