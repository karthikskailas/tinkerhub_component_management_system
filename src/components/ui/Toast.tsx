import { useEffect, useState } from "react";

interface ToastItem {
  id: number;
  message: string;
  variant: "error" | "success" | "info";
}

type Listener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
let nextId = 0;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(items);
}

function push(message: string, variant: ToastItem["variant"]) {
  const id = nextId++;
  items = [...items, { id, message, variant }];
  emit();
  window.setTimeout(() => {
    items = items.filter((item) => item.id !== id);
    emit();
  }, 4000);
}

export const toast = {
  error: (message: string) => push(message, "error"),
  success: (message: string) => push(message, "success"),
  info: (message: string) => push(message, "info"),
};

export function Toaster() {
  const [list, setList] = useState<ToastItem[]>(items);

  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);

  if (list.length === 0) return null;

  const colorByVariant: Record<ToastItem["variant"], string> = {
    error: "bg-danger text-danger-foreground",
    success: "bg-success text-success-foreground",
    info: "bg-surface text-surface-foreground border border-border",
  };

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto">
      {list.map((item) => (
        <div
          key={item.id}
          role="status"
          className={`w-full max-w-sm rounded-xl px-4 py-3 text-sm shadow-overlay sm:w-auto ${colorByVariant[item.variant]}`}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
