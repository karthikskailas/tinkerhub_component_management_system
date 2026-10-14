import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CatalogRow } from "./useCatalog";

export interface CartLine {
  id: string;
  name: string;
  qty: number;
  available: number;
}

const MAX_LINES = 50;
const ROW_HEIGHT = 88;

interface ComponentPickerProps {
  items: CatalogRow[];
  cart: Record<string, CartLine>;
  onChange: (cart: Record<string, CartLine>) => void;
}

function Svg({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"
      strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}

const SEARCH = "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4";
const FILTER = "M4 6h16M7 12h10M10 18h4";
const PLUS = "M12 5v14M5 12h14";
const CHECK = "M5 13l4 4L19 7";

// Photos are optional: with no link, or a link that fails to load, a neutral
// chip tile stands in so rows keep the same shape.
function Photo({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <span
        aria-hidden
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-default text-muted"
      >
        <Svg d="M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4M8 7h8a1 1 0 011 1v8a1 1 0 01-1 1H8a1 1 0 01-1-1V8a1 1 0 011-1z" className="h-7 w-7" />
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      width={56}
      height={56}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="h-14 w-14 shrink-0 rounded-lg bg-default object-contain"
    />
  );
}

export function ComponentPicker({ items, cart, onChange }: ComponentPickerProps) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"all" | "list">("all");
  const [inStockOnly, setInStockOnly] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  // Rows scroll with the page (no scroller inside a scroller on phones), so the
  // virtualizer needs to know where the list starts on the page.
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    const top = (listRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
    if (Math.abs(top - scrollMargin) > 1) setScrollMargin(top);
  });

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const scoped = view === "list" ? items.filter((item) => cart[item.id]) : items;
    const stocked = inStockOnly ? scoped.filter((item) => item.available > 0) : scoped;
    const matched = needle
      ? stocked.filter((item) => item.name.toLowerCase().includes(needle))
      : stocked;
    // In-stock parts first so out-of-stock rows never bury what you can request.
    // Array.prototype.sort is stable, so the catalog's name order is kept within each group.
    return [...matched].sort((a, b) => Number(b.available > 0) - Number(a.available > 0));
  }, [items, search, view, inStockOnly, cart]);

  const virtualizer = useWindowVirtualizer({
    count: filtered.length,
    scrollMargin,
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
            className={`min-h-11 flex-1 rounded-full px-4 text-sm font-semibold transition-colors ${
              view === key ? "bg-accent text-accent-foreground" : "bg-default text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <label className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-xl border-2 border-border bg-surface px-3 focus-within:border-accent">
          <span className="text-muted"><Svg d={SEARCH} /></span>
          <input
            type="search"
            inputMode="search"
            aria-label="Search components"
            placeholder="Search components..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none"
          />
        </label>
        <button
          type="button"
          aria-pressed={inStockOnly}
          aria-label="Show only parts in stock"
          onClick={() => setInStockOnly((v) => !v)}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 ${
            inStockOnly ? "border-accent bg-accent text-accent-foreground" : "border-border bg-surface text-foreground"
          }`}
        >
          <Svg d={FILTER} />
        </button>
      </div>

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
              : inStockOnly
                ? "Nothing is in stock right now. Turn off the stock filter to see everything."
                : "No components are available right now."}
        </p>
      )}

      <div ref={listRef} className="rounded-xl bg-surface shadow-surface">
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
                  transform: `translateY(${virtualRow.start - scrollMargin}px)`,
                }}
                className="flex items-center gap-2 border-b border-border px-3"
              >
                <button
                  type="button"
                  aria-pressed={!!selected}
                  aria-label={`${item.name}, ${
                    outOfStock ? "out of stock" : `${item.available} in stock`
                  }`}
                  disabled={outOfStock || (atLimit && !selected)}
                  onClick={() => (selected ? deselect(item.id) : select(item))}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md py-1.5 text-left disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span
                    aria-hidden
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                      selected ? "border-accent bg-accent text-accent-foreground" : "border-muted"
                    }`}
                  >
                    {selected && <Svg d={CHECK} className="h-4 w-4" />}
                  </span>
                  <Photo url={item.imageUrl} />
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                    <span className="w-full truncate text-base font-semibold text-foreground">{item.name}</span>
                    {item.description && (
                      <span className="w-full truncate text-sm text-muted">{item.description}</span>
                    )}
                    {outOfStock ? (
                      <span className="sticker sticker-muted">Out of stock</span>
                    ) : item.available <= 3 ? (
                      <span className="sticker sticker-yellow">Only {item.available} left</span>
                    ) : (
                      <span className="sticker sticker-lime">{item.available} in stock</span>
                    )}
                  </span>
                </button>

                {selected ? (
                  <QtyStepper
                    name={item.name}
                    qty={selected.qty}
                    max={selected.available}
                    onChange={(qty) => setQty(item.id, qty)}
                  />
                ) : (
                  !outOfStock && (
                    <button
                      type="button"
                      aria-label={`Add ${item.name}`}
                      disabled={atLimit}
                      onClick={() => select(item)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center text-accent disabled:opacity-50"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
                        <Svg d={PLUS} />
                      </span>
                    </button>
                  )
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
    <div className="flex shrink-0 items-center">
      <button
        type="button"
        aria-label={`Decrease quantity of ${name}`}
        onClick={() => onChange(qty - 1)}
        className="flex h-11 w-9 items-center justify-center rounded-md bg-default text-foreground"
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
        className="h-11 w-10 bg-transparent text-center text-base font-semibold text-foreground"
      />
      <button
        type="button"
        aria-label={`Increase quantity of ${name}`}
        onClick={() => onChange(qty + 1)}
        className="flex h-11 w-9 items-center justify-center rounded-md bg-default text-foreground"
      >
        +
      </button>
    </div>
  );
}
