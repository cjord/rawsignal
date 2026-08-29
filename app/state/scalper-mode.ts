"use client";
import { useSyncExternalStore } from "react";

// Scalper mode is a device preference shared by every page (the ⚙ toggle), stored
// outside React — same pattern as hover-previews — so flipping it on /metrics also
// updates an already-mounted leaderboard tab.
export type ScalperMode = "regular" | "scalper";
const KEY = "raw-signal-scalper-mode";
const listeners = new Set<() => void>();
const toggleListeners = new Set<(next: ScalperMode) => void>();
let hydrated = false, storageBound = false, mode: ScalperMode = "regular";

function readStored(): ScalperMode {
  try { return localStorage.getItem(KEY) === "scalper" ? "scalper" : "regular"; } catch { return "regular"; }
}
function snapshot() {
  if (!hydrated && typeof window !== "undefined") { mode = readStored(); hydrated = true; }
  return mode;
}
const serverSnapshot = (): ScalperMode => "regular";
function subscribe(listener: () => void) {
  if (!storageBound && typeof window !== "undefined") {
    storageBound = true;
    // Another tab's ⚙ toggle carries full toggle semantics here too (minus the
    // persistence that tab already did): pages migrate markets and reset scenarios the
    // same way a local toggle would, so state and URL never disagree.
    window.addEventListener("storage", (event) => {
      if (event.key !== KEY) return;
      const next: ScalperMode = event.newValue === "scalper" ? "scalper" : "regular";
      const changed = snapshot() !== next;
      applyScalperMode(next);
      if (changed) for (const listener of toggleListeners) listener(next);
    });
  }
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// The persisted ⚙ preference, ignoring any view-only apply currently showing.
export function storedScalperMode(): ScalperMode { return readStored(); }

// View-only apply (URL restores, hydration, cross-tab sync): updates every subscriber
// without adopting the value as the device preference and without firing toggle
// listeners — a shared scalping link shows the mode, it doesn't set or reset anything.
export function applyScalperMode(next: ScalperMode) {
  mode = next; hydrated = true;
  for (const listener of listeners) listener();
}

// A REAL ⚙ toggle: persists, and invokes toggle listeners synchronously in the same
// event so pages can reset dependent state in the same React commit the new mode
// renders with (no intermediate URL writes, no hydration misfires).
export function onScalperToggle(listener: (next: ScalperMode) => void) {
  toggleListeners.add(listener);
  return () => { toggleListeners.delete(listener); };
}

export function setScalperMode(next: ScalperMode) {
  const changed = snapshot() !== next;
  applyScalperMode(next);
  try { localStorage.setItem(KEY, next); } catch { /* Storage unavailable; applies for this visit only. */ }
  if (changed) for (const listener of toggleListeners) listener(next);
}

export function useScalperMode() { return useSyncExternalStore(subscribe, snapshot, serverSnapshot); }
