import crypto from "crypto";

/**
 * Builds the signed /api/invoices/download URL for a given invoice number.
 * Mirrors the exact public_id shape used when the invoice PDF was uploaded
 * (see uploadBufferToCloudinary(pdfBuffer, "invoices", `invoice-${invoiceNumber}`)
 * in member.actions.ts) and the HMAC scheme the download route itself
 * validates against (app/api/invoices/download/route.ts).
 */
export function buildInvoiceDownloadUrl(invoiceNumber: string) {
  const publicId = `invoices/invoice-${invoiceNumber}.pdf`;
  const token = crypto
    .createHmac("sha256", process.env.INVOICE_DOWNLOAD_SECRET!)
    .update(publicId)
    .digest("hex");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${appUrl}/api/invoices/download?id=${encodeURIComponent(publicId)}&token=${token}`;
}