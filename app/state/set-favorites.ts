"use client";
import { useSyncExternalStore } from "react";

// Starred sets (sets view 2026-08-29): a device preference like scalper mode — a flat
// list of "game|set" keys outside React so every mounted surface stays in sync. This
// deliberately starts minimal (star + pinned group on /sets); refinement is queued.
const KEY = "raw-signal-set-favorites";
const listeners = new Set<() => void>();
let hydrated = false, storageBound = false, cached: ReadonlySet<string> = new Set();

export const setFavoriteKey = (game: string, set: string) => `${game}|${set}`;

function readStored(): ReadonlySet<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter(value => typeof value === "string") : []);
  } catch { return new Set(); }
}
function snapshot() {
  if (!hydrated && typeof window !== "undefined") { cached = readStored(); hydrated = true; }
  return cached;
}
const EMPTY: ReadonlySet<string> = new Set();
const serverSnapshot = () => EMPTY;
function subscribe(listener: () => void) {
  if (!storageBound && typeof window !== "undefined") {
    storageBound = true;
    window.addEventListener("storage", (event) => {
      if (event.key !== KEY) return;
      cached = readStored();
      for (const item of listeners) item();
    });
  }
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useSetFavorites(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

export function toggleSetFavorite(game: string, set: string) {
  const key = setFavoriteKey(game, set);
  const next = new Set(snapshot());
  if (next.has(key)) next.delete(key); else next.add(key);
  cached = next;
  try { localStorage.setItem(KEY, JSON.stringify([...next])); } catch { /* Device-only preference; losing it is acceptable. */ }
  for (const item of listeners) item();
}
