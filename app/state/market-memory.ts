// The selected market persists across the leaderboards, sealed, and metrics pages
// (visual pass rework 2026-08-28). Device preference in localStorage; an explicit
// market in the URL always wins. "scalping" is a mode artifact, never remembered.

export type StoredMarket = "all" | "pokemon" | "riftbound" | "onepiece";

const KEY = "raw-signal-market";
const VALUES: readonly StoredMarket[] = ["all", "pokemon", "riftbound", "onepiece"];

export function readStoredMarket(): StoredMarket | null {
  try {
    const value = localStorage.getItem(KEY);
    return (VALUES as readonly string[]).includes(value ?? "") ? value as StoredMarket : null;
  } catch { return null; }
}

export function storeMarket(value: string) {
  if (!(VALUES as readonly string[]).includes(value)) return;
  try { localStorage.setItem(KEY, value); } catch { /* Private mode; selection is page-local. */ }
}
