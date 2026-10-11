import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  titleId?: string;
  /** "card" (default): white rounded card, for forms/content.
   *  "bare": no chrome, for an image viewer over a dark backdrop. */
  variant?: "card" | "bare";
  widthClassName?: string;
}

// Shared modal shell: Escape to close, backdrop click to close, and a tab
// focus trap so keyboard users can't tab out to the page behind it.
export function Modal({
  open,
  onClose,
  children,
  titleId,
  variant = "card",
  widthClassName = "max-w-lg",
}: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const focusables = container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusables?.[0] ?? container)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !container) return;

      const list = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={
          variant === "card"
            ? `w-full ${widthClassName} max-h-[90vh] overflow-y-auto rounded-xl bg-white p-5 shadow-xl outline-none`
            : "max-h-[90vh] max-w-full outline-none"
        }
      >
        {children}
      </div>
    </div>
  );
}
