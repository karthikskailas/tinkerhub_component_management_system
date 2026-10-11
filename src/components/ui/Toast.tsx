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

const VARIANT_CLASSES: Record<ToastItem["variant"], string> = {
  error: "bg-red-600 text-white",
  success: "bg-emerald-600 text-white",
  info: "bg-slate-800 text-white",
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

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end">
      {list.map((item) => (
        <div
          key={item.id}
          role="status"
          className={`w-full max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg ${VARIANT_CLASSES[item.variant]}`}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
