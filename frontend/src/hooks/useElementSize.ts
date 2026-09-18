import { useCallback, useEffect, useRef, useState } from "react";

const RESIZE_THROTTLE_MS = 150;

// Shared by every layout mode that needs to react to its own container size
// (Tiled's grid math, Filmstrip/Sidebar's "how many thumbnails fit" math) —
// one ResizeObserver implementation, throttled once, instead of one per
// layout component.
//
// `ref` is a callback ref (not a plain useRef) so the observer (re)attaches
// whenever the underlying DOM node actually changes — including going from
// not-rendered to rendered, e.g. a mode that only mounts its measured div
// conditionally after the owning component's first render (auto-two only
// appears once a 2nd participant joins). A plain useRef + effect-on-mount
// would miss that: the effect's one-time check of ref.current would run
// while the node was still null and never look again.
export function useElementSize<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const throttleRef = useRef<number | null>(null);

  const ref = useCallback((el: T | null) => {
    setNode(el);
  }, []);

  useEffect(() => {
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || throttleRef.current !== null) return;
      throttleRef.current = window.setTimeout(() => {
        throttleRef.current = null;
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      }, RESIZE_THROTTLE_MS);
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
      if (throttleRef.current !== null) window.clearTimeout(throttleRef.current);
    };
  }, [node]);

  return { ref, width: size.width, height: size.height };
}
