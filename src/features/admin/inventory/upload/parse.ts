export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 10_000;

export class ParseError extends Error {}

export interface ParsedRow {
  rowNumber: number; // 1-based, matching the spreadsheet (row 1 = header)
  name: string;
  location: string | null;
  count: number | null; // null when the cell didn't parse as a valid count
  description: string | null;
  returnable: boolean;
  clientError: string | null; // set => never sent to the backend
}

export interface ParseResult {
  rows: ParsedRow[];
  ignoredColumns: string[];
}

const COUNT_HEADER_ALIASES = ["count", "new count", "latest count"];
const FALSY = new Set(["no", "false", "0"]);

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function parseReturnable(raw: string): boolean {
  if (!raw) return true;
  const normalized = raw.trim().toLowerCase();
  if (FALSY.has(normalized)) return false;
  return true; // unrecognized values default to true, same as blank
}

// The one client-side validation path, shared by the sheet-upload parser
// below and the "Add components" grid (Phase 4.1) — both normalize their
// own input down to this shape first, so there's only one place that knows
// the rules (name required, count a whole number >= 0, dedupe by
// case-insensitive (name, location)).
export interface RawRowInput {
  rowNumber: number;
  name: string;
  location: string;
  countRaw: string;
  description: string;
  returnable: boolean;
}

export function validateRows(rawRows: RawRowInput[]): ParsedRow[] {
  const result: ParsedRow[] = [];
  const seenKeys = new Map<string, number[]>(); // dedupe key -> row numbers

  for (const raw of rawRows) {
    const name = raw.name.trim();
    const location = raw.location.trim() || null;
    const countRaw = raw.countRaw.trim();
    const description = raw.description.trim() || null;

    let clientError: string | null = null;
    let count: number | null = null;

    if (!name) {
      clientError = "name is required";
    } else if (!/^\d+$/.test(countRaw)) {
      clientError = "count must be a whole number >= 0";
    } else {
      count = Number(countRaw);
    }

    const key = `${name.toLowerCase()}|${(location ?? "").toLowerCase()}`;
    const existing = seenKeys.get(key);
    if (existing) {
      existing.push(raw.rowNumber);
    } else {
      seenKeys.set(key, [raw.rowNumber]);
    }

    result.push({
      rowNumber: raw.rowNumber,
      name,
      location,
      count,
      description,
      returnable: raw.returnable,
      clientError,
    });
  }

  // Mark every row in a duplicate (name, location) group invalid, citing
  // the other row numbers it collides with.
  for (const rowNumbers of seenKeys.values()) {
    if (rowNumbers.length < 2) continue;
    for (const row of result) {
      if (rowNumbers.includes(row.rowNumber) && !row.clientError) {
        const others = rowNumbers.filter((n) => n !== row.rowNumber);
        row.clientError = `Duplicate of row${others.length > 1 ? "s" : ""} ${others.join(", ")}`;
      }
    }
  }

  return result;
}

function buildColumnIndex(headers: string[]): {
  name: number;
  count: number;
  location: number;
  description: number;
  returnable: number;
  ignored: string[];
} {
  const normalized = headers.map(normalizeHeader);
  const nameIdx = normalized.indexOf("name");
  const countIdx = normalized.findIndex((h) => COUNT_HEADER_ALIASES.includes(h));
  const locationIdx = normalized.indexOf("location");
  const descriptionIdx = normalized.indexOf("description");
  const returnableIdx = normalized.indexOf("returnable");

  const missing: string[] = [];
  if (nameIdx === -1) missing.push("name");
  if (countIdx === -1) missing.push("count");
  if (missing.length > 0) {
    throw new ParseError(`Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`);
  }

  const known = new Set([nameIdx, countIdx, locationIdx, descriptionIdx, returnableIdx]);
  const ignored = headers.filter((_, i) => !known.has(i));

  return {
    name: nameIdx,
    count: countIdx,
    location: locationIdx,
    description: descriptionIdx,
    returnable: returnableIdx,
    ignored,
  };
}

function rowsToParsedRows(dataRows: unknown[][], columns: ReturnType<typeof buildColumnIndex>): ParsedRow[] {
  const rawRows: RawRowInput[] = [];

  dataRows.forEach((raw, i) => {
    const rowNumber = i + 2; // header is row 1
    const isBlank = raw.every((v) => cell(v) === "");
    if (isBlank) return;

    rawRows.push({
      rowNumber,
      name: cell(raw[columns.name]),
      location: columns.location >= 0 ? cell(raw[columns.location]) : "",
      countRaw: cell(raw[columns.count]),
      description: columns.description >= 0 ? cell(raw[columns.description]) : "",
      returnable: columns.returnable >= 0 ? parseReturnable(cell(raw[columns.returnable])) : true,
    });
  });

  return validateRows(rawRows);
}

async function readXlsx(file: File): Promise<unknown[][]> {
  // read-excel-file has no bare/"." export, only subpaths — /browser is the
  // one built for File/Blob input in a browser (vs. /node's fs paths).
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  // Defaults to the first sheet.
  return (await readXlsxFile(file)) as unknown as unknown[][];
}

async function readCsv(file: File): Promise<unknown[][]> {
  const Papa = await import("papaparse");
  const text = await file.text();
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
  if (result.errors.length > 0 && result.data.length === 0) {
    throw new ParseError("Couldn't parse that CSV file.");
  }
  return result.data;
}

export function validateFileBasics(file: File): void {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".csv")) {
    throw new ParseError("Please choose a .xlsx or .csv file.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ParseError("File is too large (max 5 MB).");
  }
}

export async function parseSpreadsheetFile(file: File): Promise<ParseResult> {
  validateFileBasics(file);

  const isXlsx = file.name.toLowerCase().endsWith(".xlsx");
  const allRows = isXlsx ? await readXlsx(file) : await readCsv(file);

  if (allRows.length === 0) {
    throw new ParseError("That file has no rows.");
  }

  const [headerRow, ...dataRows] = allRows;
  const headers = headerRow.map((h) => cell(h));

  if (dataRows.length > MAX_ROWS) {
    throw new ParseError(`That file has more than ${MAX_ROWS.toLocaleString()} rows.`);
  }

  const columns = buildColumnIndex(headers);
  const rows = rowsToParsedRows(dataRows, columns);

  return { rows, ignoredColumns: columns.ignored };
}
