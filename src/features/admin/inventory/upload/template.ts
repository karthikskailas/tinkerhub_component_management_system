const TEMPLATE_CSV = `name,count,location,description,returnable
Arduino Uno,10,Shelf A1,Microcontroller board,yes
Resistor Pack (1k),500,Shelf B2,Pack of 100,no
`;

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadTemplate(customLabels: string[] = []): void {
  if (customLabels.length === 0) {
    downloadCsv("inventory-template.csv", TEMPLATE_CSV);
    return;
  }
  const [header, ...lines] = TEMPLATE_CSV.trimEnd().split("\n");
  const extra = customLabels.map(csvEscape);
  const csv = [
    [header, ...extra].join(","),
    ...lines.map((l) => [l, ...extra.map(() => "")].join(",")),
  ].join("\n");
  downloadCsv("inventory-template.csv", csv + "\n");
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function downloadInvalidRows(
  rows: { rowNumber: number; name: string; location: string | null; reason: string | null }[],
): void {
  const header = "row,name,location,reason";
  const lines = rows.map((r) =>
    [String(r.rowNumber), r.name, r.location ?? "", r.reason ?? ""].map(csvEscape).join(","),
  );
  downloadCsv("invalid-rows.csv", [header, ...lines].join("\n"));
}
