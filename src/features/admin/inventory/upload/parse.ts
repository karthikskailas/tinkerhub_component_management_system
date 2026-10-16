export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 10_000;

export class ParseError extends Error {}

// The slice of a field definition the parser needs.
export interface UploadField {
  key: string;
  label: string;
  is_core: boolean;
}

export interface ParsedRow {
  rowNumber: number; // 1-based, matching the spreadsheet (row 1 = header)
  name: string;
  location: string | null;
  count: number | null; // null when the cell didn't parse as a valid count
  description: string | null;
  returnable: boolean | null; // null = blank/absent: keep the stored value
  attributes: Record<string, string>; // custom field key -> raw cell text
  clientError: string | null; // set => never sent to the backend
}

export interface ParseResult {
  rows: ParsedRow[];
  ignoredColumns: string[];
}

const FALSY = new Set(["no", "false", "0"]);

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[_\s]+/g, " ");
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
  returnable: boolean | null;
  attributes?: Record<string, string>;
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
      clientError = countRaw ? "count must be a whole number >= 0" : "count required";
    } else if (raw.attributes?.image_url && !/^https?:\/\//i.test(raw.attributes.image_url)) {
      clientError = "image_url must be an http(s) link";
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
      attributes: raw.attributes ?? {},
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

const BUILTIN_HEADERS: Record<string, string> = {
  name: "name",
  count: "count",
  "new count": "new_count",
  "latest count": "new_count",
  location: "location",
  description: "description",
  returnable: "returnable",
  "image url": "image_url",
  image: "image_url",
  "image link": "image_url",
};

// Headers resolve by built-in alias first, then by an admin-defined field's
// label or key (so a renamed core label or a custom field both match).
function buildColumnIndex(headers: string[], fields: UploadField[]) {
  const byLabelOrKey = new Map<string, string>();
  for (const f of fields) {
    byLabelOrKey.set(normalizeHeader(f.key), f.key);
    byLabelOrKey.set(normalizeHeader(f.label), f.key);
  }

  const resolved = headers.map((h) => {
    const n = normalizeHeader(h);
    return BUILTIN_HEADERS[n] ?? byLabelOrKey.get(n) ?? null;
  });
  const first = (key: string) => resolved.indexOf(key);

  const nameIdx = first("name");
  const countIdx = first("count");
  const newCountIdx = first("new_count");
  const locationIdx = first("location");
  const descriptionIdx = first("description");
  const returnableIdx = first("returnable");
  const imageIdx = first("image_url");

  const missing: string[] = [];
  if (nameIdx === -1) missing.push("name");
  if (countIdx === -1 && newCountIdx === -1) missing.push("count");
  if (missing.length > 0) {
    throw new ParseError(`Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`);
  }

  const customKeys = new Set(fields.filter((f) => !f.is_core).map((f) => f.key));
  const custom: { key: string; index: number }[] = [];
  const ignored: string[] = [];
  const known = new Set([nameIdx, countIdx, newCountIdx, locationIdx, descriptionIdx, returnableIdx, imageIdx]);
  headers.forEach((h, i) => {
    const key = resolved[i];
    if (key && customKeys.has(key) && !custom.some((c) => c.key === key)) {
      custom.push({ key, index: i });
    } else if (!known.has(i) && h.trim() !== "") {
      ignored.push(h);
    }
  });

  return {
    name: nameIdx,
    count: countIdx,
    newCount: newCountIdx,
    location: locationIdx,
    description: descriptionIdx,
    returnable: returnableIdx,
    image: imageIdx,
    custom,
    ignored,
  };
}

function rowsToParsedRows(
  dataRows: unknown[][],
  columns: ReturnType<typeof buildColumnIndex>,
  blankCountAsZero: boolean,
): ParsedRow[] {
  const rawRows: RawRowInput[] = [];

  dataRows.forEach((raw, i) => {
    const rowNumber = i + 2; // header is row 1
    const isBlank = raw.every((v) => cell(v) === "");
    if (isBlank) return;

    rawRows.push({
      rowNumber,
      name: cell(raw[columns.name]),
      location: columns.location >= 0 ? cell(raw[columns.location]) : "",
      countRaw:
        (columns.newCount >= 0 ? cell(raw[columns.newCount]) : "") ||
        (columns.count >= 0 ? cell(raw[columns.count]) : "") ||
        (blankCountAsZero ? "0" : ""),
      description: columns.description >= 0 ? cell(raw[columns.description]) : "",
      returnable:
        columns.returnable >= 0 && cell(raw[columns.returnable]) !== ""
          ? parseReturnable(cell(raw[columns.returnable]))
          : null,
      // image_url rides along in attributes: the RPCs read it from the row's top level.
      attributes: Object.fromEntries(
        [
          ...columns.custom.map((c) => [c.key, cell(raw[c.index])] as const),
          ...(columns.image >= 0 ? [["image_url", cell(raw[columns.image])] as const] : []),
        ].filter(([, v]) => v !== ""),
      ),
    });
  });

  return validateRows(rawRows);
}

async function readXlsx(file: File): Promise<unknown[][]> {
  // read-excel-file has no bare/"." export, only subpaths — /browser is the
  // one built for File/Blob input in a browser (vs. /node's fs paths).
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const result = (await readXlsxFile(file)) as unknown;
  // v9 returns one { sheet, data } per sheet; older versions return the
  // first sheet's rows directly. Use the first sheet either way.
  if (Array.isArray(result) && result[0] && !Array.isArray(result[0]) && "data" in result[0]) {
    return (result[0] as { data: unknown[][] }).data;
  }
  return result as unknown[][];
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

export async function parseSpreadsheetFile(
  file: File,
  fields: UploadField[] = [],
  options: { blankCountAsZero?: boolean } = {},
): Promise<ParseResult> {
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

  const columns = buildColumnIndex(headers, fields);
  const rows = rowsToParsedRows(dataRows, columns, options.blankCountAsZero ?? false);

  return { rows, ignoredColumns: columns.ignored };
}
