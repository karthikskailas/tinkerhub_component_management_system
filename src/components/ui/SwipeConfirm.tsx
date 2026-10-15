import { useRef, useState } from "react";

interface SwipeConfirmProps {
  label: string;
  disabled?: boolean;
  /** Called once the thumb is dragged to the end (or the keyboard button is used). */
  onConfirm: () => void | Promise<void>;
  /** Shown to assistive tech while the action runs. */
  pendingLabel?: string;
}

const THUMB = 52;
const COMPLETE_AT = 0.9;

// A drag-to-confirm slider for actions that shouldn't fire from an accidental
// tap. Pointer events cover mouse, touch and pen; keyboard and screen-reader
// users get a real button that appears on focus.
export function SwipeConfirm({ label, disabled = false, onConfirm, pendingLabel = "Confirming…" }: SwipeConfirmProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const startX = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const inactive = disabled || busy;

  function maxTravel() {
    return Math.max(0, (trackRef.current?.clientWidth ?? 0) - THUMB - 8);
  }

  async function fire() {
    if (inactive) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setOffset(0);
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (inactive) return;
    startX.current = e.clientX - offset;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (startX.current === null) return;
    setOffset(Math.min(maxTravel(), Math.max(0, e.clientX - startX.current)));
  }

  function onPointerUp() {
    if (startX.current === null) return;
    startX.current = null;
    setDragging(false);
    const max = maxTravel();
    if (max > 0 && offset >= max * COMPLETE_AT) {
      setOffset(max);
      void fire();
    } else {
      setOffset(0);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={trackRef}
        className={`relative flex min-h-[60px] select-none items-center justify-center overflow-hidden rounded-full border-2 px-16 text-center text-base font-semibold ${
          inactive
            ? "border-border bg-default text-muted"
            : "border-accent/40 bg-accent/10 text-accent"
        }`}
      >
        <span aria-hidden>{busy ? pendingLabel : label}</span>
        <div
          aria-hidden
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            width: THUMB,
            height: THUMB,
            transform: `translateX(${offset}px)`,
            transition: dragging ? "none" : "transform 200ms ease",
            touchAction: "none",
          }}
          className={`absolute left-1 top-1/2 -mt-[26px] flex items-center justify-center rounded-full text-xl font-bold ${
            inactive ? "bg-muted/40 text-surface" : "cursor-grab bg-accent text-accent-foreground"
          }`}
        >
          →
        </div>
      </div>

      {/* Keyboard / screen-reader path: revealed on focus. */}
      <button
        type="button"
        disabled={inactive}
        onClick={() => void fire()}
        className="sr-only focus:not-sr-only focus:min-h-11 focus:rounded-full focus:bg-accent focus:px-4 focus:text-sm focus:font-semibold focus:text-accent-foreground"
      >
        {label}
      </button>

      <span role="status" aria-live="polite" className="sr-only">
        {busy ? pendingLabel : ""}
      </span>
    </div>
  );
}
