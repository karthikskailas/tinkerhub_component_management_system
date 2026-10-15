import { useEffect } from "react";

const FIELD = /^(INPUT|TEXTAREA|SELECT)$/;
// The on-screen keyboard is considered open when the visible viewport is this
// much shorter than the tallest height seen so far.
const KEYBOARD_MIN_PX = 120;

// Phones don't resize 100dvh when the keyboard opens, so locked, one-screen
// layouts end up sitting under it. This tracks the visual viewport and:
//  - sets --app-h to the visible height while the keyboard is up (screens use
//    h-[var(--app-h,100dvh)]),
//  - sets data-kbd on <html> so screens can hide non-essential chrome,
//  - scrolls a newly focused field into view once the keyboard has settled.
export function useKeyboardAware(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    let fullHeight = window.innerHeight;
    let timer: number | undefined;

    function sync() {
      const visible = vv ? vv.height : window.innerHeight;
      fullHeight = Math.max(fullHeight, window.innerHeight);
      const open = visible < fullHeight - KEYBOARD_MIN_PX;
      if (open) {
        root.style.setProperty("--app-h", `${Math.round(visible)}px`);
        root.setAttribute("data-kbd", "");
      } else {
        root.style.removeProperty("--app-h");
        root.removeAttribute("data-kbd");
      }
    }

    function onFocusIn(e: FocusEvent) {
      const el = e.target as HTMLElement | null;
      if (!el || !FIELD.test(el.tagName)) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 320);
    }

    function onOrientation() {
      fullHeight = window.innerHeight;
      sync();
    }

    vv?.addEventListener("resize", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", onOrientation);
    document.addEventListener("focusin", onFocusIn);
    sync();
    return () => {
      vv?.removeEventListener("resize", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", onOrientation);
      document.removeEventListener("focusin", onFocusIn);
      window.clearTimeout(timer);
      root.style.removeProperty("--app-h");
      root.removeAttribute("data-kbd");
    };
  }, []);
}
