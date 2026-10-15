import { useCallback, useMemo, useState } from "react";
import { commitInventoryChunk, previewInventoryChunk } from "../api";
import type { CommitRpcResult, ComponentField, UploadRowInput } from "../api";
import { parseReturnable, validateRows } from "./parse";
import type { RawRowInput } from "./parse";
import { mergePreviewResults, toPayload } from "./previewMerge";
import type { UploadPreviewRow } from "./previewMerge";

export const MAX_GRID_ROWS = 100;
const EMPTY_ROW_COUNT = 3;

export interface GridRow {
  id: string;
  name: string;
  location: string;
  count: string;
  description: string;
  returnable: boolean;
  attrs: Record<string, string>;
}

function emptyRow(): GridRow {
  return {
    id: crypto.randomUUID(),
    name: "",
    location: "",
    count: "",
    description: "",
    returnable: true,
    attrs: {},
  };
}

function isBlank(row: GridRow): boolean {
  return (
    !row.name.trim() &&
    !row.location.trim() &&
    !row.count.trim() &&
    !row.description.trim() &&
    Object.values(row.attrs).every((v) => !v.trim())
  );
}

function toRawRowInput(row: GridRow, rowNumber: number): RawRowInput {
  return {
    rowNumber,
    name: row.name,
    location: row.location,
    countRaw: row.count,
    description: row.description,
    returnable: row.returnable,
    attributes: Object.fromEntries(
      Object.entries(row.attrs).filter(([, v]) => v.trim() !== ""),
    ),
  };
}

export type AddComponentsStep = "grid" | "reviewing" | "review" | "committing" | "done";

export function useAddComponentsFlow(customFields: ComponentField[] = []) {
  const [step, setStep] = useState<AddComponentsStep>("grid");
  const [gridRows, setGridRows] = useState<GridRow[]>(() =>
    Array.from({ length: EMPTY_ROW_COUNT }, emptyRow),
  );
  const [reviewRows, setReviewRows] = useState<UploadPreviewRow[]>([]);
  const [commitResult, setCommitResult] = useState<CommitRpcResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Live client-side validation of the grid as typed — every row gets a
  // 1-based "row number" matching its position for consistency with the
  // sheet-upload flow's row numbering, blank rows skipped per spec.
  const clientValidated = useMemo(() => {
    const raw: RawRowInput[] = [];
    gridRows.forEach((row, i) => {
      if (isBlank(row)) return;
      raw.push(toRawRowInput(row, i + 1));
    });
    return validateRows(raw);
  }, [gridRows]);

  const clientErrorsByRowId = useMemo(() => {
    const byRowNumber = new Map(clientValidated.map((r) => [r.rowNumber, r.clientError]));
    const map = new Map<string, string | null>();
    let rowNumber = 0;
    for (const row of gridRows) {
      if (isBlank(row)) continue;
      rowNumber += 1;
      map.set(row.id, byRowNumber.get(rowNumber) ?? null);
    }
    return map;
  }, [gridRows, clientValidated]);

  const hasContent = gridRows.some((r) => !isBlank(r));

  const setRow = useCallback((id: string, patch: Partial<GridRow>) => {
    setGridRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const addRow = useCallback(() => {
    setGridRows((prev) => (prev.length >= MAX_GRID_ROWS ? prev : [...prev, emptyRow()]));
  }, []);

  const removeRow = useCallback((id: string) => {
    setGridRows((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.id !== id)));
  }, []);

  // Fills the grid from pasted tab-separated text (name, count, location,
  // description, returnable), dropping a "name" header row if present.
  // Returns how many data rows were filled, for the caller to toast.
  const fillFromPaste = useCallback((text: string): number => {
    const lines = text.split(/\r\n|\r|\n/).filter((line) => line.replace(/\t/g, "").trim() !== "");
    if (lines.length === 0) return 0;

    let dataLines = lines;
    const firstCell = lines[0].split("\t")[0]?.trim().toLowerCase();
    if (firstCell === "name") dataLines = lines.slice(1);

    const parsedRows: GridRow[] = dataLines.slice(0, MAX_GRID_ROWS).map((line) => {
      const cells = line.split("\t");
      const [name = "", count = "", location = "", description = "", returnableRaw = ""] = cells;
      return {
        id: crypto.randomUUID(),
        name,
        location,
        count,
        description,
        returnable: parseReturnable(returnableRaw),
        // Custom fields follow returnable, in field order.
        attrs: Object.fromEntries(customFields.map((f, i) => [f.key, cells[5 + i] ?? ""])),
      };
    });

    if (parsedRows.length === 0) return 0;
    setGridRows(parsedRows);
    return parsedRows.length;
  }, [customFields]);

  const review = useCallback(async () => {
    setError(null);
    const clientInvalid: UploadPreviewRow[] = clientValidated
      .filter((r) => r.clientError)
      .map((r) => ({
        rowNumber: r.rowNumber,
        name: r.name,
        location: r.location,
        diff: "invalid" as const,
        oldCount: null,
        newCount: r.count,
        reason: r.clientError,
        payload: null,
      }));

    const validRows = clientValidated.filter((r) => !r.clientError);

    if (validRows.length === 0) {
      setReviewRows(clientInvalid.sort((a, b) => a.rowNumber - b.rowNumber));
      setStep("review");
      return;
    }

    setStep("reviewing");
    try {
      const results = await previewInventoryChunk(validRows.map(toPayload));
      const merged = mergePreviewResults(validRows, results);
      setReviewRows(
        [...clientInvalid, ...merged].sort((a, b) => a.rowNumber - b.rowNumber),
      );
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't check these rows.");
      setStep("grid");
    }
  }, [clientValidated]);

  const sendableCount = reviewRows.filter((r) => r.diff === "new" || r.diff === "changed").length;

  const commit = useCallback(
    async (reason: string) => {
      setError(null);
      setStep("committing");
      const payloads = reviewRows
        .filter((r) => (r.diff === "new" || r.diff === "changed") && r.payload)
        .map((r) => r.payload as UploadRowInput);

      try {
        const result = await commitInventoryChunk(payloads, reason);
        setCommitResult(result);
        setStep("done");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Commit failed.");
        setStep("review");
      }
    },
    [reviewRows],
  );

  const backToGrid = useCallback(() => setStep("grid"), []);

  const reset = useCallback(() => {
    setStep("grid");
    setGridRows(Array.from({ length: EMPTY_ROW_COUNT }, emptyRow));
    setReviewRows([]);
    setCommitResult(null);
    setError(null);
  }, []);

  return {
    step,
    gridRows,
    clientErrorsByRowId,
    hasContent,
    reviewRows,
    sendableCount,
    commitResult,
    error,
    setRow,
    addRow,
    removeRow,
    fillFromPaste,
    review,
    commit,
    backToGrid,
    reset,
  };
}
