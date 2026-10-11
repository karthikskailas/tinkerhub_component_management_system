import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import type { UploadPreviewRow } from "./useUploadFlow";

const ROW_HEIGHT = 56;

export function PreviewTable({ rows }: { rows: UploadPreviewRow[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">No rows in this category.</p>;
  }

  return (
    <div ref={scrollRef} className="h-80 overflow-y-auto rounded-lg border border-slate-200">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <div
              key={`${row.rowNumber}-${row.name}`}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="flex items-center gap-3 border-b border-slate-100 px-3 text-sm"
            >
              <span className="w-10 shrink-0 text-xs text-slate-400">#{row.rowNumber}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">{row.name}</p>
                {row.location && <p className="truncate text-xs text-slate-500">{row.location}</p>}
              </div>
              {row.diff === "changed" || row.diff === "unchanged" || row.diff === "new" ? (
                <span className="shrink-0 text-right text-slate-600">
                  {row.diff === "new" ? (
                    row.newCount
                  ) : (
                    <>
                      <span className="text-slate-400">{row.oldCount}</span> →{" "}
                      <span className="font-medium">{row.newCount}</span>
                    </>
                  )}
                </span>
              ) : (
                <span className="max-w-[50%] shrink-0 truncate text-right text-xs text-red-600">
                  {row.reason}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
