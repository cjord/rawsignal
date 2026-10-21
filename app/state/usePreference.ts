"use client";
import {getSavedItem,setSavedItem} from '../account/storage.ts';
/* eslint-disable react-hooks/exhaustive-deps -- preferences hydrate from the current owner after mount; view-only URL overrides remain local. */
import { useEffect, useRef, useState } from "react";
import type { SignalStrictness } from "../../core/domain/types";
import {useAccount} from '../account/context.ts';

// One hydrate/persist implementation for device preferences (signal strictness, the
// buy-list tile size, ...). Returns [value, set, setViewOnly]: `set` persists to
// localStorage, `setViewOnly` changes only this visit — shared links can apply a
// preference without silently adopting it as the device's.
export function usePreference<T extends string>(key: string, parse: (stored: string) => T | null, initial: T, accountOnly=false) {
  const {user}=useAccount();
  const [value, setValue] = useState<T>(initial),viewOnly=useRef(false);
  useEffect(() => {
    if(viewOnly.current||accountOnly&&!user)return;
    let stored: string | null = null;
    try { stored = getSavedItem(key); } catch { /* Storage unavailable; the default applies. */ }
    const parsed = stored == null ? null : parse(stored);
    setValue(parsed??initial);
  }, [user?.id]);
  const set = (next: T) => {
    viewOnly.current=false;setValue(next);
    try { if(!accountOnly||user)setSavedItem(key, next); } catch { /* Storage unavailable; applies for this visit only. */ }
  };
  const setViewOnly=(next:T)=>{viewOnly.current=true;setValue(next)};
  return [value, set, setViewOnly] as const;
}

export const STRICTNESS_KEY = "raw-signal-strictness";
export const parseStrictness = (stored: string): SignalStrictness | null =>
  stored === "conservative" || stored === "aggressive" ? stored : null;
