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
    return <p className="rounded-xl bg-background p-4 text-center text-sm text-muted">No rows in this category.</p>;
  }

  return (
    <div ref={scrollRef} className="h-[min(40vh,320px)] overflow-y-auto rounded-xl bg-background">
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
              className="flex items-center gap-3 border-b border-border px-3"
            >
              <span className="text-xs text-muted">#{row.rowNumber}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                {row.location && <p className="truncate text-xs text-muted">{row.location}</p>}
              </div>
              {row.diff === "changed" || row.diff === "unchanged" || row.diff === "new" ? (
                <span className="shrink-0 text-sm text-foreground">
                  {row.diff === "new" ? (
                    row.newCount
                  ) : (
                    <>
                      <span className="text-muted">{row.oldCount}</span> →{" "}
                      <span>{row.newCount}</span>
                    </>
                  )}
                </span>
              ) : (
                <span className="shrink-0 text-xs text-danger">{row.reason}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
