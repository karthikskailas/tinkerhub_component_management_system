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
const ROW_HEIGHT = 72;

interface ComponentPickerProps {
  items: CatalogRow[];
  cart: Record<string, CartLine>;
  onChange: (cart: Record<string, CartLine>) => void;
}

export function ComponentPicker({ items, cart, onChange }: ComponentPickerProps) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"all" | "list">("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const scoped = view === "list" ? items.filter((item) => cart[item.id]) : items;
    const matched = needle
      ? scoped.filter((item) => item.name.toLowerCase().includes(needle))
      : scoped;
    // In-stock parts first so out-of-stock rows never bury what you can request.
    // Array.prototype.sort is stable, so the catalog's name order is kept within each group.
    return [...matched].sort((a, b) => Number(b.available > 0) - Number(a.available > 0));
  }, [items, search, view, cart]);

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
      <div className="flex gap-2" role="group" aria-label="Show components">
        {(
          [
            ["all", "All components"],
            ["list", `Your list (${cartCount})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            onClick={() => setView(key)}
            className={`min-h-11 flex-1 rounded-full px-4 text-sm font-medium transition-colors ${
              view === key ? "bg-accent text-accent-foreground" : "bg-default text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <input
        type="search"
        inputMode="search"
        aria-label="Search components"
        placeholder="Search components..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="min-h-11 w-full rounded-lg border border-field-border bg-field px-3 text-base text-field-foreground outline-none focus:border-field-border-focus"
      />

      {atLimit && (
        <p role="status" className="text-sm text-warning">
          You've reached the 50-component limit for a single request.
        </p>
      )}

      {filtered.length === 0 && (
        <p role="status" className="text-sm text-muted">
          {search.trim()
            ? `No components match "${search.trim()}". Try a shorter name.`
            : view === "list"
              ? "You haven't picked anything yet. Switch to All components and tap a part to add it."
              : "No components are available right now."}
        </p>
      )}

      <div ref={scrollRef} className="h-[min(60dvh,480px)] min-h-48 overflow-y-auto rounded-xl bg-surface shadow-surface">
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
                  aria-pressed={!!selected}
                  disabled={outOfStock || (atLimit && !selected)}
                  onClick={() => (selected ? deselect(item.id) : select(item))}
                  className="flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-md py-1.5 text-left disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
                  <span className="flex min-w-0 items-center gap-2 text-sm text-muted">
                    {outOfStock ? (
                      <span className="sticker sticker-muted">Out of stock</span>
                    ) : item.available <= 3 ? (
                      <span className="sticker sticker-yellow">Only {item.available} left</span>
                    ) : (
                      <span className="sticker sticker-lime">{item.available} in stock</span>
                    )}
                    {item.description && <span className="truncate">{item.description}</span>}
                  </span>
                </button>

                {selected && (
                  <QtyStepper
                    name={item.name}
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
  name,
  qty,
  max,
  onChange,
}: {
  name: string;
  qty: number;
  max: number;
  onChange: (qty: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        aria-label={`Decrease quantity of ${name}`}
        onClick={() => onChange(qty - 1)}
        className="flex h-11 w-11 items-center justify-center rounded-md bg-default text-foreground"
      >
        −
      </button>
      <input
        type="number"
        aria-label={`Quantity of ${name}`}
        inputMode="numeric"
        min={1}
        max={max}
        value={qty}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-12 rounded-md border border-field-border bg-field text-center text-sm text-field-foreground"
      />
      <button
        type="button"
        aria-label={`Increase quantity of ${name}`}
        onClick={() => onChange(qty + 1)}
        className="flex h-11 w-11 items-center justify-center rounded-md bg-default text-foreground"
      >
        +
      </button>
    </div>
  );
}
