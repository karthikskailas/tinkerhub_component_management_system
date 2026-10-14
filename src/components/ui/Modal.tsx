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
  /** "md" (default): typical form width. "xl": wide, for data grids/tables. */
  size?: "md" | "xl";
  /** Pinned below the scrolling body (decision buttons). */
  footer?: ReactNode;
}

// Shared modal shell: Escape to close, backdrop click to close, and a tab
// focus trap so keyboard users can't tab out to the page behind it.
export function Modal({
  open,
  onClose,
  children,
  titleId,
  variant = "card",
  size = "md",
  footer,
}: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Keeps the keydown handler below reading the latest onClose without
  // needing it in the effect's dependency array — onClose is a fresh
  // function identity on every parent render, and putting it in the deps
  // would re-run the effect (and steal focus back to the first field) on
  // every keystroke anywhere in the modal.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const focusables = container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusables?.[0] ?? container)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-variant={variant}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={
          variant === "bare"
            ? "max-h-[90vh] max-w-full overflow-auto"
            : `flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-surface text-surface-foreground shadow-overlay sm:w-full sm:rounded-2xl ${
                footer ? "overflow-hidden" : "gap-4 overflow-y-auto p-5"
              } ${size === "xl" ? "sm:max-w-3xl" : "sm:max-w-lg"}`
        }
      >
        {footer ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">{children}</div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border bg-surface px-5 py-3">
              {footer}
            </div>
          </>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
