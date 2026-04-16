"use client";

import ExcelJS from "exceljs";
import { formatMoney } from "@/lib/currency";

/**
 * Export an array of objects to CSV and trigger download
 */
export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string
) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          // Escape values with commas or quotes
          const str = val === null || val === undefined ? "" : String(val);
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(",")
    ),
  ];

  const blob = new Blob(["\uFEFF" + csvRows.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  triggerDownload(blob, `${filename}.csv`);
}

/**
 * Export data to XLSX with optional multi-sheet support
 */
export async function exportToXLSX(
  sheets: {
    name: string;
    data: Record<string, unknown>[];
    columns?: { header: string; key: string; width?: number }[];
  }[],
  filename: string
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ProjectBill";
  workbook.created = new Date();

  for (const sheet of sheets) {
    if (sheet.data.length === 0) continue;

    const ws = workbook.addWorksheet(sheet.name);

    // Configure columns
    const keys = Object.keys(sheet.data[0]);
    ws.columns = sheet.columns || keys.map((key) => ({
      header: key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (s) => s.toUpperCase())
        .trim(),
      key,
      width: 18,
    }));

    // Style header row
    ws.addRows(sheet.data);
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, size: 11 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F2937" },
    };
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 28;

    // Add borders + alternating row colors
    for (let i = 2; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      if (i % 2 === 0) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" },
        };
      }
      row.alignment = { vertical: "middle" };
    }

    // Auto-filter
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: ws.columns.length },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, `${filename}.xlsx`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Format number as Indonesian Rupiah
 * @deprecated Use formatMoney(amount, "IDR") from @/lib/currency instead
 */
export function formatIDR(amount: number): string {
  return formatMoney(amount, "IDR");
}
