"use client";
import type { CollectrImportPayload } from "../api/collectr/route";

// The last Collectr import lives on the device (device-preference rule): navigating
// away and back restores the page without re-fetching, and re-importing the same
// handle diffs against the previous card list.
const KEY = "raw-signal-collectr-import";
const VERSION = 1;

export type StoredCollectrImport = {
  version: number;
  payload: CollectrImportPayload;
  previousIds: number[] | null;
};

export function readStoredImport(): StoredCollectrImport | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null") as StoredCollectrImport | null;
    return parsed && parsed.version === VERSION && parsed.payload?.cards ? parsed : null;
  } catch { return null; }
}

export function storeImport(payload: CollectrImportPayload): StoredCollectrImport {
  const previous = readStoredImport();
  const previousIds = previous && previous.payload.profile.handle === payload.profile.handle
    ? previous.payload.cards.map(card => card.productId)
    : null;
  const stored: StoredCollectrImport = { version: VERSION, payload, previousIds };
  try { localStorage.setItem(KEY, JSON.stringify(stored)); } catch { /* Oversized collection or private mode: the page still works for this visit. */ }
  return stored;
}

export function importDiff(stored: StoredCollectrImport): { added: number; removed: number } | null {
  if (!stored.previousIds) return null;
  const previous = new Set(stored.previousIds);
  const current = new Set(stored.payload.cards.map(card => card.productId));
  let added = 0, removed = 0;
  for (const id of current) if (!previous.has(id)) added += 1;
  for (const id of previous) if (!current.has(id)) removed += 1;
  return added || removed ? { added, removed } : null;
}
