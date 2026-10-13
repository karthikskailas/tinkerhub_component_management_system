import { memo } from "react";
import type { ComponentRow as ComponentRowData } from "./api";

interface ComponentRowProps {
  component: ComponentRowData;
  onAdjust: (component: ComponentRowData) => void;
  onHistory: (component: ComponentRowData) => void;
}

function ComponentRowImpl({ component, onAdjust, onHistory }: ComponentRowProps) {
  const outOfStock = component.available <= 0;

  return (
    <div className="flex flex-col gap-2 border-b border-border p-3 last:border-b-0 sm:grid sm:grid-cols-[1.5fr_1fr_70px_70px_70px_90px] sm:items-center sm:gap-2">
      <div>
        <p className="text-sm font-medium text-foreground">{component.name}</p>
        {component.description && <p className="text-xs text-muted">{component.description}</p>}
        {!component.returnable && (
          <span className="mt-0.5 inline-block rounded-full bg-default px-2 py-0.5 text-[11px] font-medium text-muted">
            Non-returnable
          </span>
        )}
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
