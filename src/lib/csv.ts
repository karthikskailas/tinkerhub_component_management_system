const FORMULA_PREFIX = /^[=+\-@]/;

// Spreadsheet formula injection guard: a cell starting with =, +, - or @
// gets interpreted as a formula by Excel/Sheets unless neutralized.
// Numeric columns never need this (a bare number can't start with one of
// those and still parse as the number it is).
export function csvCell(value: string, isNumeric = false): string {
  const safe = !isNumeric && FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildCsv(header: string, rows: string[][]): string {
  const lines = rows.map((cells) => cells.join(","));
  // UTF-8 BOM so Excel detects the encoding and renders non-ASCII correctly.
  return "﻿" + [header, ...lines].join("\n");
}

function localTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`
  );
}

export function downloadCsv(filenamePrefix: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filenamePrefix}-${localTimestamp()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
