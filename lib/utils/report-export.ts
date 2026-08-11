import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export interface ExportColumn {
  key: string;
  label: string;
}

/** Client-side-only PDF export using the report's own already-fetched rows — no server round trip. */
export function exportReportToPdf(
  title: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
  filename: string
) {
  const doc = new jsPDF({ orientation: columns.length > 5 ? "landscape" : "portrait" });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [columns.map((c) => c.label)],
    body: rows.map((row) => columns.map((c) => formatCell(row[c.key]))),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  doc.save(`${filename}.pdf`);
}

/** Client-side-only Excel export via SheetJS, same row/column shape as the PDF export. */
export function exportReportToExcel(
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
  filename: string,
  sheetName = "Report"
) {
  const data = rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const c of columns) out[c.label] = row[c.key];
    return out;
  });
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
