import { useCallback, useState } from "react";

// ─── useLocalStorage ──────────────────────────────────────────────────────────
// Generic hook — reads from localStorage on mount, syncs on every write.
// Falls back to initialValue when the key is absent or the stored JSON is corrupt.
export function useLocalStorage(key, initialValue) {
  const [state, setStateRaw] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setState = useCallback((valueOrUpdater) => {
    setStateRaw(prev => {
      const next = typeof valueOrUpdater === "function" ? valueOrUpdater(prev) : valueOrUpdater;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* quota exceeded — fail silently */ }
      return next;
    });
  }, [key]);

  return [state, setState];
}
