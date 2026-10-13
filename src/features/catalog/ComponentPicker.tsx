import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef, useState } from "react";
import type { CatalogRow } from "./useCatalog";

export interface CartLine {
  id: string;
  name: string;
  qty: number;
  available: number;
}

const MAX_LINES = 50;
const ROW_HEIGHT = 64;

interface ComponentPickerProps {
  items: CatalogRow[];
  cart: Record<string, CartLine>;
  onChange: (cart: Record<string, CartLine>) => void;
}

export function ComponentPicker({ items, cart, onChange }: ComponentPickerProps) {
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => item.name.toLowerCase().includes(needle));
  }, [items, search]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const cartCount = Object.keys(cart).length;
  const atLimit = cartCount >= MAX_LINES;

  function select(item: CatalogRow) {
    if (cart[item.id] || item.available <= 0 || atLimit) return;
    onChange({
      ...cart,
      [item.id]: { id: item.id, name: item.name, qty: 1, available: item.available },
    });
  }

  function deselect(id: string) {
    const next = { ...cart };
    delete next[id];
    onChange(next);
  }

  function setQty(id: string, qty: number) {
    const line = cart[id];
    if (!line) return;
    const clamped = Math.min(Math.max(1, Math.round(qty) || 1), line.available);
    onChange({ ...cart, [id]: { ...line, qty: clamped } });
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        inputMode="search"
        placeholder="Search components..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="min-h-11 w-full rounded-lg border border-field-border bg-field px-3 text-base text-field-foreground outline-none focus:border-field-border-focus"
      />

      {atLimit && (
        <p className="text-sm text-warning">
          You've reached the 50-component limit for a single request.
        </p>
      )}

      <div ref={scrollRef} className="h-[min(60vh,480px)] overflow-y-auto rounded-xl bg-surface shadow-surface">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = filtered[virtualRow.index];
            const selected = cart[item.id];
            const outOfStock = item.available <= 0;

            return (
              <div
                key={item.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="flex items-center gap-2 border-b border-border px-3"
              >
                <button
                  type="button"
                  disabled={outOfStock || (atLimit && !selected)}
                  onClick={() => (selected ? deselect(item.id) : select(item))}
                  className="flex min-h-11 flex-1 items-center justify-between gap-2 rounded-md py-1.5 text-left disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
                    {item.description && (
                      <span className="truncate text-xs text-muted">{item.description}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs font-medium text-muted">
                    {outOfStock ? "Out of stock" : `${item.available} available`}
                  </span>
                </button>

                {selected && (
                  <QtyStepper
                    qty={selected.qty}
                    max={selected.available}
                    onChange={(qty) => setQty(item.id, qty)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function QtyStepper({
  qty,
  max,
  onChange,
}: {
  qty: number;
  max: number;
  onChange: (qty: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(qty - 1)}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-default text-foreground"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        value={qty}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-12 rounded-md border border-field-border bg-field text-center text-sm text-field-foreground"
      />
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(qty + 1)}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-default text-foreground"
      >
        +
      </button>
    </div>
  );
}
