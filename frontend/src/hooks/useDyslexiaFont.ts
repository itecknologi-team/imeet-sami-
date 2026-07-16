import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "imeet_dyslexia_font";

export function useDyslexiaFont() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");

  useEffect(() => {
    document.body.classList.toggle("dyslexia-font", enabled);
    localStorage.setItem(STORAGE_KEY, String(enabled));
  }, [enabled]);

  const toggle = useCallback(() => setEnabled((prev) => !prev), []);

  return { enabled, toggle };
}
