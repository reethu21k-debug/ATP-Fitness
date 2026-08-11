"use client";

import { format } from "date-fns";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PaymentsOverviewRow, PaymentSplit } from "@/types/database";

interface GymInfo { name: string; address: string | null; city: string | null; phone: string | null; email: string | null }

export function InvoiceView({ payment, splits, gym }: { payment: PaymentsOverviewRow; splits: PaymentSplit[]; gym: GymInfo | null }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex justify-end print-hide">
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      <div className="rounded-2xl border bg-card p-8">
        <div className="flex items-start justify-between border-b pb-6">
          <div>
            <h1 className="text-xl font-semibold">{gym?.name ?? "ATP Fitness"}</h1>
            {gym?.address && <p className="mt-1 text-sm text-muted-foreground">{gym.address}{gym.city ? `, ${gym.city}` : ""}</p>}
            {gym?.phone && <p className="text-sm text-muted-foreground">{gym.phone}</p>}
            {gym?.email && <p className="text-sm text-muted-foreground">{gym.email}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-lg font-semibold">Invoice</h2>
            <p className="font-mono text-sm text-muted-foreground">{payment.invoice_number}</p>
            <p className="mt-1 text-sm text-muted-foreground">{format(new Date(payment.created_at), "dd MMM yyyy")}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 border-b py-6 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Billed to</p>
            <p className="mt-1 font-medium">{payment.member_name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Receipt number</p>
            <p className="mt-1 font-mono">{payment.receipt_number}</p>
          </div>
        </div>

        <table className="w-full py-6 text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="pb-2">Description</th>
              <th className="pb-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-3">{payment.plan_name ?? "Membership payment"}</td>
              <td className="py-3 text-right">₹{payment.amount.toFixed(2)}</td>
            </tr>
            {payment.gst_amount > 0 && (
              <tr className="border-b">
                <td className="py-3">GST ({payment.gst_rate}%)</td>
                <td className="py-3 text-right">₹{payment.gst_amount.toFixed(2)}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-4 font-semibold">Total</td>
              <td className="pt-4 text-right font-semibold">₹{payment.total_amount.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="border-t pt-6 text-sm">
          <p className="text-xs text-muted-foreground">Payment method</p>
          <p className="mt-1 capitalize">{payment.method}</p>
          {payment.method === "split" && splits.length > 0 && (
            <ul className="mt-2 space-y-1 text-muted-foreground">
              {splits.map((s) => (
                <li key={s.id} className="capitalize">
                  {s.method}: ₹{s.amount.toFixed(2)} {s.transaction_reference ? `(${s.transaction_reference})` : ""}
                </li>
              ))}
            </ul>
          )}
          {payment.is_refunded && <p className="mt-2 text-destructive">This payment has been refunded.</p>}
        </div>
      </div>
    </div>
  );
}