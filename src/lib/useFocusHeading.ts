import { useEffect, useRef } from "react";

/** Moves focus to the returned heading ref on mount and whenever `key` changes,
 *  so keyboard and screen-reader users land at the top of the new screen. */
export function useFocusHeading(key?: unknown) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [key]);
  return ref;
}
