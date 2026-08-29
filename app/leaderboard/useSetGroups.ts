"use client";
import {useMemo} from "react";
import {formatGameName} from "../../core/domain/formatters";

// Set → market map for grouped filter options; headings only surface on the multi-game
// scopes (a single market yields one group, which renders flat).
export function useSetGroups(items: readonly {set: string; game: string}[]) {
  return useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of items) map[item.set] = formatGameName(item.game);
    return map;
  }, [items]);
}
