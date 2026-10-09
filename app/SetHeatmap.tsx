"use client";
import { useRef, useState, type CSSProperties } from "react";
import { HEATMAP_TIERS, HEATMAP_WINDOWS, type HeatmapCell, type HeatmapGame, type SetHeatmapPayload, type SetHeatmapRow } from "../core/domain/set-heatmap";
import type { SetDirectoryRow } from "../core/domain/sets";
import { formatGameName, formatPercent } from "../core/domain/formatters";
import { setGroupsFor } from "../core/domain/eras";
import { setFavoriteKey } from "./state/set-favorites";
import type { SetsScope } from "./state/sets-query";

type Props = {
  payload: SetHeatmapPayload | null; loading: boolean; error: boolean;
  directory: SetDirectoryRow[]; scope: SetsScope;
  onScope: (changes: Partial<SetsScope>, push?: boolean) => void;
  favorites: ReadonlySet<string>;
};
const cellReason: Record<Exclude<HeatmapCell["reason"], null>, string> = {
  "not-applicable": "No tracked cards in this tier", "no-history": "No usable price history",
  "low-coverage": "Fewer than 60% of tracked cards have usable history",
  "small-sample": "Too few cards",
};
const scale = (change: number) => `${Math.round(6 + Math.min(1, Math.abs(change) / 20) * 24)}%`;
const selectedKey = (game: string, slug: string, tier: string) => `${game}|${slug}|${tier}`;
const cardUrl = (row: SetHeatmapRow, tier: string) => {
  const query = new URLSearchParams({ mode: "singles", market: row.game, sets: row.set, rarity: tier });
  return `/?${query.toString()}`;
};

function HeatCell({ cell, row, tier, window, selected, onSelect }: {
  cell: HeatmapCell; row: SetHeatmapRow; tier: string; window: SetsScope["window"];
  selected: boolean; onSelect: () => void;
}) {
  const label = tier === "all" ? "All tracked" : HEATMAP_TIERS[row.game].find(([key]) => key === tier)?.[1] ?? tier;
  const status = cell.reason ? cellReason[cell.reason] : cell.smallSample ? "Small sample" : "";
  const value = cell.reason === "not-applicable" ? "—" : cell.change == null ? "N/A" : formatPercent(cell.change);
  const tone = cell.change == null ? "unavailable" : cell.change > 0 ? "up" : cell.change < 0 ? "down" : "flat";
  return <button type="button" className={`heatmap-cell ${tone}${selected ? " selected" : ""}`}
    style={cell.change == null ? undefined : { "--heat-strength": scale(cell.change) } as CSSProperties}
    aria-pressed={selected}
    aria-label={`${row.set}, ${label}, ${window} day median tracked-card change: ${value}; ${cell.eligible} of ${cell.total} tracked cards${status ? `; ${status}` : ""}`}
    onClick={onSelect}>
    <span>{value}</span>{cell.smallSample && cell.change != null && <small title="One or two usable cards">!</small>}
  </button>;
}

function GameMatrix({ game, rows, scope, onScope }: {
  game: HeatmapGame; rows: SetHeatmapRow[]; scope: SetsScope; onScope: Props["onScope"];
}) {
  const tiers = HEATMAP_TIERS[game].filter(([key]) => scope.tier === "all" || scope.tier === key);
  return <section className="detail-section heatmap-section" aria-label={`${formatGameName(game)} heatmap`}>
    <header><span>{formatGameName(game)}</span><h2>{formatGameName(game)} sets</h2></header>
    {rows.length === 0 ? <p className="detail-unavailable">No sets match these filters.</p> : <>
      <p className="heatmap-scroll-hint">Scroll sideways to compare rarities →</p>
      <div className="heatmap-scroll" role="region" aria-label={`Scrollable ${formatGameName(game)} heatmap`}>
        <table className="heatmap-table">
          <thead><tr><th scope="col">Set</th><th scope="col">All tracked</th>{tiers.map(([key, label]) => <th scope="col" key={key}>{label}</th>)}</tr></thead>
          <tbody>{rows.map(row => <tr key={`${row.game}|${row.set}`}>
            <th scope="row"><a href={`/sets/${row.game}/${row.slug}`}>{row.set}</a></th>
            {["all", ...tiers.map(([key]) => key)].map(tier => {
              const cell = row.cells[tier]?.[scope.window];
              return <td key={tier}>{cell && <HeatCell cell={cell} row={row} tier={tier} window={scope.window}
                selected={scope.selected === selectedKey(game, row.slug, tier)}
                onSelect={() => onScope({ selected: selectedKey(game, row.slug, tier) })} />}</td>;
            })}
          </tr>)}</tbody>
        </table>
      </div>
    </>}
  </section>;
}

type FilterDraft = Pick<SetsScope, "query" | "group" | "tier" | "favoritesOnly">;
const filtersOf = (scope: SetsScope): FilterDraft => ({
  query: scope.query, group: scope.group, tier: scope.tier, favoritesOnly: scope.favoritesOnly,
});
function HeatmapFilters({ scope, onScope, games }: { scope: SetsScope; onScope: Props["onScope"]; games: HeatmapGame[] }) {
  const [draft, setDraft] = useState<FilterDraft>(() => filtersOf(scope));
  const details = useRef<HTMLDetailsElement>(null);
  const groupOptions = games.flatMap(game => setGroupsFor(game).map(group => ({ value: `${game}|${group.key}`, label: `${formatGameName(game)} · ${group.label}` })));
  const tiers = games.length === 1 ? HEATMAP_TIERS[games[0]] : [];
  const active = Number(Boolean(scope.query)) + Number(Boolean(scope.group)) + Number(scope.tier !== "all") + Number(scope.favoritesOnly);
  const close = () => { if (details.current) details.current.open = false; };
  return <details ref={details} className="heatmap-filters">
    <summary>Filters{active ? ` · ${active} active` : ""}</summary>
    <form onSubmit={event => { event.preventDefault(); onScope({ ...draft, selected: "" }); close(); }}>
      <label>Search sets<input type="search" value={draft.query} onChange={event => setDraft({ ...draft, query: event.target.value })}/></label>
      <label>Group<select value={draft.group} onChange={event => setDraft({ ...draft, group: event.target.value })}><option value="">All groups</option>{groupOptions.map(group => <option key={group.value} value={group.value}>{group.label}</option>)}</select></label>
      {tiers.length > 0 && <label>Tier<select value={tiers.some(([key]) => key === draft.tier) ? draft.tier : "all"} onChange={event => setDraft({ ...draft, tier: event.target.value })}><option value="all">All tiers</option>{tiers.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
      <label className="heatmap-favorites"><input type="checkbox" checked={draft.favoritesOnly} onChange={event => setDraft({ ...draft, favoritesOnly: event.target.checked })}/> Favorites only</label>
      <div className="heatmap-filter-actions">
        <button type="button" onClick={() => { setDraft(filtersOf(scope)); close(); }}>Cancel</button>
        <button type="button" onClick={() => setDraft({ query: "", group: "", tier: "all", favoritesOnly: false })}>Clear all</button>
        <button type="submit">Apply filters</button>
      </div>
    </form>
  </details>;
}

export default function SetHeatmap({ payload, loading, error, directory, scope, onScope, favorites }: Props) {
  const games: HeatmapGame[] = scope.market === "all" ? ["pokemon", "riftbound"]
    : scope.market === "onepiece" ? [] : [scope.market];
  const directoryBy = new Map(directory.map(row => [`${row.game}|${row.set}`, row]));
  const selected = payload?.rows.find(row => {
    const [game, slug] = scope.selected.split("|");
    return row.game === game && row.slug === slug;
  });
  const selectedTier = scope.selected.split("|")[2] ?? "all";
  const selectedCell = selected?.cells[selectedTier]?.[scope.window];
  const selectedLabel = selectedTier === "all" ? "All tracked" : (selected ? HEATMAP_TIERS[selected.game].find(([key]) => key === selectedTier)?.[1] : null) ?? selectedTier;
  return <div className="sets-heatmap">
    <p className="detail-note">Median tracked-card price change by set and catalog tier. Each printing counts once; this is not sealed value or a complete set checklist. Snapshot source date: {payload?.asOfDate ?? "N/A"}.</p>
    <div className="heatmap-controls">
      <div role="group" aria-label="Heatmap window" className="heatmap-windows">{HEATMAP_WINDOWS.map(window => <button key={window} type="button" aria-pressed={scope.window === window} onClick={() => onScope({ window, selected: "" })}>{window}D</button>)}</div>
      <label>Sort<select value={scope.sort} onChange={event => onScope({ sort: event.target.value as SetsScope["sort"], selected: "" })}><option value="newest">Newest first</option><option value="change">Strongest change</option></select></label>
      <HeatmapFilters key={`${scope.market}|${scope.query}|${scope.group}|${scope.tier}|${scope.favoritesOnly}`} scope={scope} onScope={onScope} games={games}/>
    </div>
    <p className="detail-note heatmap-legend"><span className="heatmap-swatch down"/> Falling <span className="heatmap-swatch flat"/> Flat <span className="heatmap-swatch up"/> Rising · intensity reaches full color at ±20%; displayed percentages are never capped. ! marks 1–2 usable cards; N/A means unavailable; — means no tracked cards in that tier.</p>
    {loading && <p className="detail-unavailable" role="status">Loading tracked-card changes…</p>}
    {error && <p className="detail-unavailable" role="status">Heatmap is unavailable right now.</p>}
    {!loading && !error && games.length === 0 && <p className="detail-unavailable">One Piece does not yet have tracked singles for this heatmap.</p>}
    {payload && games.map(game => {
      const rows = payload.rows.filter(row => row.game === game && row.set.toLowerCase().includes(scope.query.toLowerCase())
        && (!scope.group || scope.group === `${game}|${directoryBy.get(`${game}|${row.set}`)?.group}`)
        && (!scope.favoritesOnly || favorites.has(setFavoriteKey(game, row.set))));
      rows.sort((a, b) => {
        const aDir = directoryBy.get(`${game}|${a.set}`), bDir = directoryBy.get(`${game}|${b.set}`);
        if (scope.sort === "change") {
          const aChange = a.cells[scope.tier]?.[scope.window]?.change ?? null;
          const bChange = b.cells[scope.tier]?.[scope.window]?.change ?? null;
          if (aChange == null && bChange != null) return 1;
          if (bChange == null && aChange != null) return -1;
          if (aChange != null && bChange != null && aChange !== bChange) return bChange - aChange;
        }
        const aDate = aDir?.releaseDate ?? String(aDir?.releaseYear ?? "");
        const bDate = bDir?.releaseDate ?? String(bDir?.releaseYear ?? "");
        return bDate.localeCompare(aDate) || a.set.localeCompare(b.set);
      });
      return <GameMatrix key={game} game={game} rows={rows} scope={scope} onScope={onScope}/>;
    })}
    {selected && selectedCell && <section className="detail-section heatmap-selection" aria-live="polite">
      <header><span>Selected cell</span><h2>{selected.set} · {selectedLabel}</h2></header>
      <p><b>{selectedCell.change == null ? "N/A" : formatPercent(selectedCell.change)}</b> median tracked-card change over {scope.window} days.</p>
      <p className="detail-note">{selectedCell.eligible} of {selectedCell.total} tracked printings have usable history ({Math.round(selectedCell.coverage * 100)}% coverage). {selectedCell.reason ? cellReason[selectedCell.reason] : selectedCell.smallSample ? "Small sample: one or two cards." : "At least 60% coverage."} Source snapshot: {payload?.asOfDate}; cutoff uses the nearest dated price at or before the target, with a three-day maximum gap.</p>
      <div className="heatmap-selection-links"><a href={cardUrl(selected, selectedTier)}>View matching cards</a><a href={`/sets/${selected.game}/${selected.slug}`}>View set</a><button type="button" onClick={() => onScope({ selected: "" })}>Clear selection</button></div>
    </section>}
  </div>;
}
