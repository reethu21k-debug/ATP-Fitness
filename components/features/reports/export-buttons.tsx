"use client";

import { FileDown, Sheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportReportToPdf, exportReportToExcel, type ExportColumn } from "@/lib/utils/report-export";

export function ExportButtons({
  title,
  columns,
  rows,
  filename,
}: {
  title: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  filename: string;
}) {
  const disabled = rows.length === 0;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => void exportReportToPdf(title, columns, rows, filename)}
      >
        <FileDown className="h-4 w-4" /> PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => void exportReportToExcel(columns, rows, filename)}
      >
        <Sheet className="h-4 w-4" /> Excel
      </Button>
    </div>
  );
}