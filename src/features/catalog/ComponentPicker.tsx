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
    <div>
      <input
        type="search"
        inputMode="search"
        placeholder="Search components..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-3 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {atLimit && (
        <p className="mb-2 text-xs text-amber-600">
          You've reached the 50-component limit for a single request.
        </p>
      )}

      <div ref={scrollRef} className="h-96 overflow-y-auto rounded-lg border border-slate-200">
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
                className="flex items-center gap-3 border-b border-slate-100 px-3"
              >
                <button
                  type="button"
                  disabled={outOfStock || (atLimit && !selected)}
                  onClick={() => (selected ? deselect(item.id) : select(item))}
                  className={`flex min-h-11 flex-1 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected ? "bg-indigo-50" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {item.name}
                    </span>
                    {item.description && (
                      <span className="block truncate text-xs text-slate-500">
                        {item.description}
                      </span>
                    )}
                  </span>
                  <span
                    className={`shrink-0 text-xs font-medium ${
                      outOfStock ? "text-red-500" : "text-slate-500"
                    }`}
                  >
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
        className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-lg"
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
        className="h-9 w-12 rounded-md border border-slate-300 text-center text-sm"
      />
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(qty + 1)}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-lg"
      >
        +
      </button>
    </div>
  );
}
