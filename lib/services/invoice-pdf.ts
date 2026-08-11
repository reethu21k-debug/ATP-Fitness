import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface InvoicePdfGym {
  name: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface InvoicePdfLineItem {
  description: string;
  amount: number;
}

export interface InvoicePdfSplit {
  method: string;
  amount: number;
  transactionReference?: string | null;
}

export interface InvoicePdfInput {
  gym: InvoicePdfGym;
  invoiceNumber: string;
  receiptNumber: string;
  issuedAt: Date | string;
  billedToName: string;
  lineItems: InvoicePdfLineItem[];
  gstRate?: number;
  gstAmount?: number;
  totalAmount: number;
  method: string;
  splits?: InvoicePdfSplit[];
  isRefunded?: boolean;
}

function formatDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(n: number) {
  return `Rs. ${n.toFixed(2)}`;
}

/**
 * Renders an invoice as a one-page PDF and returns it as a Buffer, ready to
 * hand to uploadBufferToCloudinary (see lib/services/cloudinary.ts) or to
 * attach directly to an email.
 */
export function generateInvoicePdfBuffer(input: InvoicePdfInput): Buffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 40;
  let cursorY = 50;

  // --- Header: gym details (left) / invoice meta (right) -------------------
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(input.gym.name, marginX, cursorY);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90);
  let gymLineY = cursorY + 16;
  const addressLine = [input.gym.address, input.gym.city].filter(Boolean).join(", ");
  if (addressLine) {
    doc.text(addressLine, marginX, gymLineY);
    gymLineY += 13;
  }
  if (input.gym.phone) {
    doc.text(input.gym.phone, marginX, gymLineY);
    gymLineY += 13;
  }
  if (input.gym.email) {
    doc.text(input.gym.email, marginX, gymLineY);
    gymLineY += 13;
  }

  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Invoice", 555, cursorY, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90);
  doc.text(input.invoiceNumber, 555, cursorY + 16, { align: "right" });
  doc.text(formatDate(input.issuedAt), 555, cursorY + 29, { align: "right" });

  cursorY = Math.max(gymLineY, cursorY + 45) + 20;
  doc.setDrawColor(220);
  doc.line(marginX, cursorY, 555, cursorY);
  cursorY += 24;

  // --- Billed to / receipt number -------------------------------------------
  doc.setTextColor(0);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("BILLED TO", marginX, cursorY);
  doc.text("RECEIPT NUMBER", 555, cursorY, { align: "right" });

  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(input.billedToName, marginX, cursorY + 16);
  doc.setFont("helvetica", "normal");
  doc.text(input.receiptNumber, 555, cursorY + 16, { align: "right" });

  cursorY += 40;

  // --- Line items table ------------------------------------------------------
  const rows: (string | number)[][] = input.lineItems.map((item) => [item.description, formatCurrency(item.amount)]);
  if (input.gstAmount && input.gstAmount > 0) {
    rows.push([`GST (${input.gstRate ?? 0}%)`, formatCurrency(input.gstAmount)]);
  }

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: 40 },
    head: [["Description", "Amount"]],
    body: rows,
    foot: [["Total", formatCurrency(input.totalAmount)]],
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 8 },
    headStyles: { textColor: 120, fontStyle: "normal", lineWidth: { bottom: 1 }, lineColor: 220 },
    footStyles: { textColor: 0, fontStyle: "bold", lineWidth: { top: 1 }, lineColor: 220, fillColor: false },
    columnStyles: { 1: { halign: "right" } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cursorY = (doc as any).lastAutoTable.finalY + 30;

  // --- Payment method / splits ------------------------------------------------
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("PAYMENT METHOD", marginX, cursorY);
  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.text(input.method.toUpperCase(), marginX, cursorY + 15);
  cursorY += 15;

  if (input.method === "split" && input.splits?.length) {
    for (const split of input.splits) {
      cursorY += 15;
      const ref = split.transactionReference ? ` (${split.transactionReference})` : "";
      doc.text(`${split.method.toUpperCase()}: ${formatCurrency(split.amount)}${ref}`, marginX, cursorY);
    }
  }

  if (input.isRefunded) {
    cursorY += 24;
    doc.setTextColor(200, 40, 40);
    doc.setFont("helvetica", "bold");
    doc.text("This payment has been refunded.", marginX, cursorY);
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}