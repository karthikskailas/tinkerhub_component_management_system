import type { ReactNode } from "react";
import { Modal } from "../../../components/ui/Modal";

// A modal overlay — shared by every Review/Issue/Returns/History detail
// view — instead of stacking the detail below the list, so opening one
// never grows the page or forces a scroll past the list. The body scrolls on
// its own; `footer` (the decision buttons) stays pinned so it is always in reach.
export function DetailShell({
  onClose,
  children,
  footer,
}: {
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Modal open onClose={onClose} size="xl" footer={footer}>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-full bg-default px-4 text-sm font-semibold text-foreground hover:bg-default-hover"
      >
        <span aria-hidden>←</span> Back
      </button>
      {children}
    </Modal>
  );
}

/** Who and what this request is: the name leads, then how to reach them, then the project. */
export function RequesterHeader({
  name,
  phone,
  project,
  note,
}: {
  name: string;
  phone: string;
  project: string;
  note?: string;
}) {
  return (
    <header className="flex flex-col gap-0.5">
      <h2 className="text-2xl font-bold text-foreground">{name}</h2>
      <a
        href={`tel:${phone}`}
        className="inline-flex min-h-11 items-center gap-2 self-start text-base font-semibold text-accent hover:underline"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
          strokeLinejoin="round" className="h-4 w-4" aria-hidden>
          <path d="M6.5 3h3l1.5 4-2 1.5a11 11 0 006 6L16.5 12.5l4 1.5v3a2 2 0 01-2 2A15 15 0 014.5 5a2 2 0 012-2z" />
        </svg>
        {phone}
      </a>
      <p className="text-base font-medium text-foreground">{project}</p>
      {note && <p className="text-sm text-muted">{note}</p>}
    </header>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl bg-surface p-4 shadow-surface">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A small number field with its label above it, so the number always says what it is. */
export function QtyInput({
  label,
  value,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex shrink-0 flex-col gap-1">
      <span className="text-sm font-medium text-muted">{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Math.min(Math.max(0, Math.round(Number(e.target.value)) || 0), max))}
        className="h-11 w-20 rounded-lg border border-border bg-background text-center text-base font-semibold text-field-foreground disabled:opacity-50"
      />
    </label>
  );
}
