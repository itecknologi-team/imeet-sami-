import { useEffect, useRef, useState } from "react";

const RESIZE_THROTTLE_MS = 150;

// Shared by every layout mode that needs to react to its own container size
// (Tiled's grid math, Filmstrip/Sidebar's "how many thumbnails fit" math) —
// one ResizeObserver implementation, throttled once, instead of one per
// layout component.
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const throttleRef = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || throttleRef.current !== null) return;
      throttleRef.current = window.setTimeout(() => {
        throttleRef.current = null;
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      }, RESIZE_THROTTLE_MS);
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      if (throttleRef.current !== null) window.clearTimeout(throttleRef.current);
    };
  }, []);

  return { ref, width: size.width, height: size.height };
}
