"use client";
import {useEffect,useMemo,useState} from "react";
import {BUYLIST_KEY,FAVORITES_KEY,addFavorites,parseBuyStates,parseFavorites,toggleFavorite,type BuyState,type FavoriteEntry} from "./favorites";

// One in-memory store per tab so every star, filter chip, and the buy list stay in sync
// without prop drilling; a storage event syncs other tabs.
let entries: FavoriteEntry[] | null = null;
let buyStates: Record<string, BuyState> | null = null;
const listeners = new Set<() => void>();

const read = () => {
  if (entries === null) {
    try { entries = parseFavorites(localStorage.getItem(FAVORITES_KEY)); } catch { entries = []; }
    try { buyStates = parseBuyStates(localStorage.getItem(BUYLIST_KEY)); } catch { buyStates = {}; }
  }
  return { entries: entries!, buyStates: buyStates! };
};
const write = (nextEntries: FavoriteEntry[], nextStates: Record<string, BuyState>) => {
  entries = nextEntries;
  buyStates = nextStates;
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(nextEntries));
    localStorage.setItem(BUYLIST_KEY, JSON.stringify(nextStates));
  } catch { /* Storage unavailable; state stays tab-local. */ }
  listeners.forEach(listener => listener());
};

// The Favorites slider entry scopes both leaderboards the same way: device-local
// favorite ids for the kind narrow the catalog before querying.
export function useFavoriteScope<T extends { productId: number }>(kind: "single" | "sealed", items: T[], favoritesOnly: boolean) {
  const favorites = useFavorites();
  const favoriteIds = useMemo(
    () => new Set(favorites.entries.filter(entry => entry.kind === kind).map(entry => entry.productId)),
    [favorites.entries, kind],
  );
  const scoped = useMemo(
    () => (favoritesOnly ? items.filter(item => favoriteIds.has(item.productId)) : items),
    [items, favoritesOnly, favoriteIds],
  );
  return { favorites, scoped };
}

export function useFavorites() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const listener = () => setVersion(value => value + 1);
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === FAVORITES_KEY || event.key === BUYLIST_KEY) { entries = null; buyStates = null; listener(); }
    };
    window.addEventListener("storage", onStorage);
    listener();
    return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
  }, []);
  const state = typeof window === "undefined" ? { entries: [] as FavoriteEntry[], buyStates: {} as Record<string, BuyState> } : read();
  return {
    version,
    entries: state.entries,
    buyStates: state.buyStates,
    has: (key: string) => state.entries.some(entry => entry.key === key),
    toggle: (entry: FavoriteEntry) => { const current = read(); write(toggleFavorite(current.entries, entry), current.buyStates); },
    addMany: (additions: FavoriteEntry[]) => { const current = read(); write(addFavorites(current.entries, additions), current.buyStates); },
    remove: (key: string) => { const current = read(); const rest = { ...current.buyStates }; delete rest[key]; write(current.entries.filter(entry => entry.key !== key), rest); },
    setBuyState: (key: string, next: BuyState) => { const current = read(); write(current.entries, { ...current.buyStates, [key]: next }); },
  };
}
