import { memo } from "react";
import type { ComponentRow as ComponentRowData } from "./api";

const GRID_COLS = "sm:grid-cols-[1.5fr_1fr_70px_70px_70px_90px]";

interface ComponentRowProps {
  component: ComponentRowData;
  onAdjust: (component: ComponentRowData) => void;
  onHistory: (component: ComponentRowData) => void;
}

function ComponentRowImpl({ component, onAdjust, onHistory }: ComponentRowProps) {
  const outOfStock = component.available <= 0;

  return (
    <div
      className={`grid grid-cols-1 gap-1 border-b border-slate-100 p-3 text-sm sm:items-center sm:gap-2 ${GRID_COLS}`}
    >
      <div>
        <p className="font-medium text-slate-900">{component.name}</p>
        {component.description && (
          <p className="text-xs text-slate-500 sm:hidden">{component.description}</p>
        )}
        {!component.returnable && (
          <span className="mt-0.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            Non-returnable
          </span>
        )}
      </div>

      <div className="text-slate-600">{component.location ?? "—"}</div>

      <div className="flex justify-between sm:block sm:text-right">
        <span className="text-xs text-slate-400 sm:hidden">Count</span>
        {component.count}
      </div>

      <div className="flex justify-between sm:block sm:text-right">
        <span className="text-xs text-slate-400 sm:hidden">Reserved</span>
        <span className="text-slate-400">{component.reserved}</span>
      </div>

      <div className="flex items-center justify-between gap-2 sm:block sm:text-right">
        <span className="text-xs text-slate-400 sm:hidden">Available</span>
        <span className={outOfStock ? "font-medium text-red-600" : ""}>
          {component.available}
          {outOfStock && (
            <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-xs">Out</span>
          )}
        </span>
      </div>

      <div className="flex gap-2 sm:justify-end">
        <button
          type="button"
          onClick={() => onAdjust(component)}
          className="min-h-11 rounded-md px-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
        >
          Adjust
        </button>
        <button
          type="button"
          onClick={() => onHistory(component)}
          className="min-h-11 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          History
        </button>
      </div>
    </div>
  );
}

export const ComponentRow = memo(ComponentRowImpl);
export { GRID_COLS };
