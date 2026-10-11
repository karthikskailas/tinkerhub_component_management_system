const TEMPLATE_CSV = `name,location,count,description,returnable
Arduino Uno,Shelf A1,10,Microcontroller board,true
Resistor Pack (1k),Shelf B2,500,Pack of 100,false
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

export function downloadTemplate(): void {
  downloadCsv("inventory-template.csv", TEMPLATE_CSV);
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
