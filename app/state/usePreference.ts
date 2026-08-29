"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- preferences hydrate once from storage after mount */
import { useEffect, useState } from "react";
import type { SignalStrictness } from "../domain/types";

// One hydrate/persist implementation for device preferences (signal strictness, the
// buy-list tile size, ...). Returns [value, set, setViewOnly]: `set` persists to
// localStorage, `setViewOnly` changes only this visit — shared links can apply a
// preference without silently adopting it as the device's.
export function usePreference<T extends string>(key: string, parse: (stored: string) => T | null, initial: T) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(key); } catch { /* Storage unavailable; the default applies. */ }
    const parsed = stored == null ? null : parse(stored);
    if (parsed != null) setValue(parsed);
  }, []);
  const set = (next: T) => {
    setValue(next);
    try { localStorage.setItem(key, next); } catch { /* Storage unavailable; applies for this visit only. */ }
  };
  return [value, set, setValue] as const;
}

export const STRICTNESS_KEY = "raw-signal-strictness";
export const parseStrictness = (stored: string): SignalStrictness | null =>
  stored === "conservative" || stored === "aggressive" ? stored : null;
