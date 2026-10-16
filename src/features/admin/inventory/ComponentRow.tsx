import { memo, useState } from "react";
import type { ComponentField, ComponentRow as ComponentRowData } from "./api";

// Missing or broken image link falls back to a generic chip icon.
function Thumb({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-default text-muted">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="6" width="12" height="12" rx="1.5" />
          <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
        </svg>
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      width={40}
      height={40}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-10 w-10 shrink-0 rounded-lg bg-default object-contain"
    />
  );
}

interface ComponentRowProps {
  component: ComponentRowData;
  customFields: ComponentField[];
  onEdit: (component: ComponentRowData) => void;
  onAdjust: (component: ComponentRowData) => void;
  onHistory: (component: ComponentRowData) => void;
}

function ComponentRowImpl({ component, customFields, onEdit, onAdjust, onHistory }: ComponentRowProps) {
  const outOfStock = component.available <= 0;

  return (
    <div className="flex flex-col gap-2 border-b border-border p-3 last:border-b-0 sm:grid sm:grid-cols-[1.5fr_1fr_70px_70px_70px_140px] sm:items-center sm:gap-2">
      <div className="flex items-start gap-3">
        <Thumb url={component.image_url} />
        <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{component.name}</p>
        {component.description && <p className="text-xs text-muted">{component.description}</p>}
        {customFields.some((f) => f.show_in_table && component[f.key] != null) && (
          <p className="text-xs text-muted">
            {customFields
              .filter((f) => f.show_in_table && component[f.key] != null)
              .map((f) => `${f.label}: ${f.type === "bool" ? (component[f.key] ? "Yes" : "No") : String(component[f.key])}`)
              .join(" · ")}
          </p>
        )}
        {!component.returnable && (
          <span className="mt-0.5 inline-block rounded-full bg-default px-2 py-0.5 text-[11px] font-medium text-muted">
            Non-returnable
          </span>
        )}
        </div>
      </div>

      <div className="text-sm text-muted">{component.location ?? "—"}</div>

      <div className="flex justify-between text-sm sm:block">
        <span className="text-xs text-muted sm:hidden">Count</span>
        <span className="text-foreground">{component.count}</span>
      </div>

      <div className="flex justify-between text-sm sm:block">
        <span className="text-xs text-muted sm:hidden">Reserved</span>
        <span className="text-foreground">{component.reserved}</span>
      </div>

      <div className="flex justify-between text-sm sm:block">
        <span className="text-xs text-muted sm:hidden">Available</span>
        <span className={outOfStock ? "font-medium text-danger" : "text-foreground"}>
          {component.available}
          {outOfStock && <span className="ml-1 text-xs">Out</span>}
        </span>
      </div>

      <div className="flex gap-3 pt-1 sm:justify-end sm:pt-0">
        <button type="button" onClick={() => onEdit(component)} className="text-sm font-medium text-accent hover:underline">
          Edit
        </button>
        <button type="button" onClick={() => onAdjust(component)} className="text-sm font-medium text-accent hover:underline">
          Adjust
        </button>
        <button type="button" onClick={() => onHistory(component)} className="text-sm font-medium text-accent hover:underline">
          History
        </button>
      </div>
    </div>
  );
}

export const ComponentRow = memo(ComponentRowImpl);
