import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import {
  commitInventoryChunk,
  createComponentField,
  fetchComponentFields,
  previewInventoryChunk,
} from "../api";
import type { CommitRpcResult, ComponentField, UploadRowInput } from "../api";
import { FIELDS_QUERY_KEY } from "../useComponents";
import { ParseError, parseSpreadsheetFile } from "./parse";
import type { ParsedRow } from "./parse";
import { matchKey, mergePreviewResults, toPayload } from "./previewMerge";
import type { UploadPreviewRow } from "./previewMerge";

export type { UploadDiff, UploadPreviewRow } from "./previewMerge";

const CHUNK_SIZE = 500;
const STALE_PREVIEW_MS = 5 * 60 * 1000;

export type UploadStep = "choose" | "previewing" | "preview" | "committing" | "done";

interface Progress {
  done: number;
  total: number;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export function useUploadFlow(fields: ComponentField[]) {
  const queryClient = useQueryClient();
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const fileRef = useRef<File | null>(null);
  const blankZeroRef = useRef(false);
  const [blankCountAsZero, setBlankCountAsZeroState] = useState(false);
  const [step, setStep] = useState<UploadStep>("choose");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [ignoredColumns, setIgnoredColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<UploadPreviewRow[]>([]);
  const [previewProgress, setPreviewProgress] = useState<Progress>({ done: 0, total: 0 });
  const [commitProgress, setCommitProgress] = useState<Progress>({ done: 0, total: 0 });
  const [commitError, setCommitError] = useState<{ chunkIndex: number; message: string } | null>(
    null,
  );
  const [commitResult, setCommitResult] = useState<CommitRpcResult | null>(null);

  const validRowsRef = useRef<ParsedRow[]>([]);
  const clientInvalidRowsRef = useRef<UploadPreviewRow[]>([]);
  const previewedAtRef = useRef<number | null>(null);
  const pendingCommitChunksRef = useRef<UploadRowInput[][]>([]);
  const commitReasonRef = useRef<string>("");

  const runPreview = useCallback(
    async (clientInvalidRows: UploadPreviewRow[], validRows: ParsedRow[]) => {
      setStep("previewing");
      const chunks = chunk(validRows, CHUNK_SIZE);
      setPreviewProgress({ done: 0, total: chunks.length });

      const byKey = new Map<string, UploadPreviewRow>();

      for (const [index, group] of chunks.entries()) {
        const payloads = group.map(toPayload);
        const results = await previewInventoryChunk(payloads);

        for (const row of mergePreviewResults(group, results)) {
          byKey.set(matchKey(row.name, row.location), row);
        }
        setPreviewProgress({ done: index + 1, total: chunks.length });
      }

      const merged = [...clientInvalidRows, ...byKey.values()].sort(
        (a, b) => a.rowNumber - b.rowNumber,
      );
      setRows(merged);
      previewedAtRef.current = Date.now();
      setStep("preview");
      return merged;
    },
    [],
  );

  const chooseFile = useCallback(
    async (file: File, fieldsOverride?: ComponentField[]) => {
      setParseError(null);
      setFileName(file.name);
      fileRef.current = file;
      try {
        const parsed = await parseSpreadsheetFile(file, fieldsOverride ?? fieldsRef.current, {
          blankCountAsZero: blankZeroRef.current,
        });
        setIgnoredColumns(parsed.ignoredColumns);

        const clientInvalidRows: UploadPreviewRow[] = parsed.rows
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

        const validRows = parsed.rows.filter((r) => !r.clientError);
        validRowsRef.current = validRows;
        clientInvalidRowsRef.current = clientInvalidRows;

        if (validRows.length === 0) {
          setRows(clientInvalidRows.sort((a, b) => a.rowNumber - b.rowNumber));
          previewedAtRef.current = Date.now();
          setStep("preview");
          return;
        }

        await runPreview(clientInvalidRows, validRows);
      } catch (err) {
        if (!(err instanceof ParseError)) console.error("inventory upload failed", err);
        setParseError(err instanceof ParseError ? err.message : "Couldn't read that file.");
        setStep("choose");
      }
    },
    [runPreview],
  );

  // Re-reads the current file with the "empty count = 0" option flipped.
  const setBlankCountAsZero = useCallback(
    async (value: boolean) => {
      blankZeroRef.current = value;
      setBlankCountAsZeroState(value);
      if (fileRef.current) await chooseFile(fileRef.current);
    },
    [chooseFile],
  );

  // Turns the chosen unrecognised headers into text fields (admin only on the
  // backend), then re-reads the same file so those columns are imported.
  const addIgnoredAsFields = useCallback(async (headers: string[]) => {
    const file = fileRef.current;
    if (!file || headers.length === 0) return;
    const failures: string[] = [];
    for (const header of headers) {
      try {
        await createComponentField({ label: header, type: "text" });
      } catch (err) {
        failures.push(err instanceof Error ? err.message : header);
      }
    }
    const fresh = await fetchComponentFields();
    void queryClient.invalidateQueries({ queryKey: [FIELDS_QUERY_KEY] });
    await chooseFile(file, fresh);
    if (failures.length > 0) setParseError(`Some columns couldn't be added: ${failures[0]}`);
  }, [chooseFile, queryClient]);

  // Returns the fresh rows when a re-preview actually ran, or null when the
  // existing preview was still within the freshness window (caller should
  // keep using whatever rows it already has in that case).
  const refreshPreviewIfStale = useCallback(async (): Promise<UploadPreviewRow[] | null> => {
    const age = previewedAtRef.current ? Date.now() - previewedAtRef.current : Infinity;
    if (age <= STALE_PREVIEW_MS) return null;
    return runPreview(clientInvalidRowsRef.current, validRowsRef.current);
  }, [runPreview]);

  // Accumulates across retries too: a retry only re-sends the chunk that
  // failed onward, so totals from chunks that already succeeded before the
  // failure must carry forward rather than reset to zero.
  const totalsRef = useRef<CommitRpcResult>({ inserted: 0, updated: 0, unchanged: 0, invalid: 0 });

  const runCommitChunks = useCallback(async (chunks: UploadRowInput[][], startIndex: number) => {
    for (let i = startIndex; i < chunks.length; i++) {
      try {
        const result = await commitInventoryChunk(chunks[i], commitReasonRef.current);
        totalsRef.current = {
          inserted: totalsRef.current.inserted + result.inserted,
          updated: totalsRef.current.updated + result.updated,
          unchanged: totalsRef.current.unchanged + result.unchanged,
          invalid: totalsRef.current.invalid + result.invalid,
        };
        setCommitProgress({ done: i + 1, total: chunks.length });
      } catch (err) {
        pendingCommitChunksRef.current = chunks;
        setCommitError({
          chunkIndex: i,
          message: err instanceof Error ? err.message : "Commit failed.",
        });
        return null;
      }
    }
    return totalsRef.current;
  }, []);

  const commit = useCallback(
    async (reason: string) => {
      const freshRows = (await refreshPreviewIfStale()) ?? rows;

      commitReasonRef.current = reason;
      setCommitError(null);
      totalsRef.current = { inserted: 0, updated: 0, unchanged: 0, invalid: 0 };
      setStep("committing");

      const sendable = freshRows
        .filter((r) => (r.diff === "new" || r.diff === "changed") && r.payload)
        .map((r) => r.payload as UploadRowInput);
      const chunks = chunk(sendable, CHUNK_SIZE);
      setCommitProgress({ done: 0, total: chunks.length });

      const totals = await runCommitChunks(chunks, 0);
      if (totals) {
        setCommitResult(totals);
        setStep("done");
      } else {
        setStep("preview");
      }
    },
    [rows, refreshPreviewIfStale, runCommitChunks],
  );

  const retryCommit = useCallback(async () => {
    if (!commitError) return;
    setStep("committing");
    const chunks = pendingCommitChunksRef.current;
    const totals = await runCommitChunks(chunks, commitError.chunkIndex);
    setCommitError(null);
    if (totals) {
      setCommitResult(totals);
      setStep("done");
    } else {
      setStep("preview");
    }
  }, [commitError, runCommitChunks]);

  const reset = useCallback(() => {
    setStep("choose");
    setFileName(null);
    setParseError(null);
    setIgnoredColumns([]);
    setRows([]);
    setPreviewProgress({ done: 0, total: 0 });
    setCommitProgress({ done: 0, total: 0 });
    setCommitError(null);
    setCommitResult(null);
    validRowsRef.current = [];
    clientInvalidRowsRef.current = [];
    previewedAtRef.current = null;
    pendingCommitChunksRef.current = [];
    totalsRef.current = { inserted: 0, updated: 0, unchanged: 0, invalid: 0 };
  }, []);

  const sendableCount = rows.filter((r) => r.diff === "new" || r.diff === "changed").length;

  return {
    step,
    fileName,
    parseError,
    ignoredColumns,
    rows,
    previewProgress,
    commitProgress,
    commitError,
    commitResult,
    sendableCount,
    chooseFile,
    addIgnoredAsFields,
    blankCountAsZero,
    setBlankCountAsZero,
    commit,
    retryCommit,
    reset,
    isCommitting: step === "committing",
  };
}
