"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- keyed effects synchronize remote data and theme */
import { useEffect, useMemo, useRef, useState } from "react";
import index from "../tcg-index.json";
import SealedView from "./SealedView";
import {
  SegmentedView,
  SortableHeader,
  SortToolbar,
  type Direction,
} from "./MarketUI";
import HistoryPanel, { movementTone, type HistoryMetric } from "./HistoryPanel";
import { normalized } from "./market-utils";
import CardFilters, { type MovementFilters } from "./CardFilters";
import TopBar from "./TopBar";
import { SignalBadge, SignalTabs } from "./SignalControls";
import {
  marketSignal,
  type SignalSide,
  type SignalStrictness,
} from "./signal-utils";
import MultiSelectField from "./MultiSelectField";
import { parseCards } from "./domain/contracts";
import { formatGameName, formatPercent, formatRarity, formatUsd } from "./domain/formatters";
import type {
  Card,
  PriceHistory,
  SealedGame,
  SinglesGame,
  SinglesView,
} from "./domain/types";
import {
  defaultRarities,
  parseMarketQuery,
  type MarketQueryState,
  type SealedQueryState,
} from "./state/market-query";
import { useMarketQueryState } from "./state/useMarketQueryState";
import { useCatalogPage } from "./data/useCatalogPage";
import { useFreshness } from "./data/useFreshness";
import InfoHint from "./InfoHint";
import { cardFavorite, favoriteKey } from "./state/favorites";
import { useFavorites } from "./state/useFavorites";
import {
  HOT_BOARD_LIMIT,
  filterSinglesCandidates,
  querySinglesCatalog,
} from "./data/catalog-query";
import {
  usePriceHistoryBatch,
  usePriceHistoryPrefetch,
} from "./data/usePriceHistoryBatch";
import { usePersistedSignals } from "./data/usePersistedSignals";
import {
  SIGNAL_FALLBACK_LIMIT,
  selectSignalCandidates,
} from "./data/signal-coverage";
import MarketLeaderboard from "./leaderboard/MarketLeaderboard";
import LeaderboardHeader from "./leaderboard/LeaderboardHeader";
import LeaderboardControls from "./leaderboard/LeaderboardControls";
import ActiveFilterSummary from "./leaderboard/ActiveFilterSummary";
import { resultState, type LeaderboardModeModel } from "./leaderboard/types";
import MarketRow from "./leaderboard/MarketRow";
import ProductIdentity from "./leaderboard/ProductIdentity";
import HistoryPopover from "./leaderboard/HistoryPopover";
import FullMarketCard from "./leaderboard/FullMarketCard";
import {
  buildCatalogDerived,
  nextSortDirection,
  signalAwareSorts,
} from "./leaderboard/mode-adapter";

type Game = SinglesGame;
type View = SinglesView;
type SortKey =
  | "name"
  | "signal"
  | "set"
  | "market"
  | "low"
  | "high"
  | "change7"
  | "change30";
type ScalperMode = "regular" | "scalper";
type History = PriceHistory;
const displayLabel = formatRarity;
const usd = (value: number | null) => formatUsd(value);
const pct = (value: number | null) => formatPercent(value);
const cardMeta = (card: Card) => {
  const cleanName = normalized(card.name),
    cleanNumber = normalized(card.number);
  return cleanNumber && cleanName.endsWith(cleanNumber)
    ? `${displayLabel(card.rarity)} · ${card.printing}`
    : `${card.number} · ${displayLabel(card.rarity)} · ${card.printing}`;
};
const cardKey = (card: Card) => card.productId;

const updatedLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const singlesModel: LeaderboardModeModel<View, SortKey> = {
  views: [
    { key: "large", label: "Large", icon: "▦" },
    { key: "medium", label: "Medium", icon: "▤" },
    { key: "text", label: "Text", icon: "☷" },
    { key: "full", label: "Full", icon: "▥" },
  ],
  sorts: [
    { label: "Card", key: "name" },
    { label: "Set", key: "set" },
    { label: "Market", key: "market" },
    { label: "30D Low", key: "low" },
    { label: "30D High", key: "high" },
    { label: "7D", key: "change7" },
    { label: "30D", key: "change30" },
  ],
  viewLabel: "Card view",
  paginationLabel: "Leaderboard pages",
};
const productViews: {
  key: "singles" | "sealed";
  label: string;
  icon: string;
}[] = [
  { key: "singles", label: "Singles", icon: "◫" },
  { key: "sealed", label: "Sealed", icon: "▣" },
];
const signalSort = { label: "Signal", key: "signal" as SortKey };
const ascendingSinglesSorts = new Set<SortKey>(["name", "set"]);
const cardHistoryMetrics = (card: Card, history?: History): HistoryMetric[] => {
  const movement = (
    label: string,
    value: number | null | undefined,
  ): HistoryMetric => ({
    label,
    value: value === undefined ? "…" : pct(value ?? null),
    tone: movementTone(value),
  });
  return [
    { label: "Market", value: usd(card.marketPrice) },
    { label: "30D low", value: usd(history?.low30 ?? null) },
    { label: "30D high", value: usd(history?.high30 ?? null) },
    { label: "Hist low", value: usd(history?.historyLow ?? null) },
    movement("7 day", history?.change7),
    movement("30 day", history?.change30),
    movement("90 day", history?.change90),
  ];
};
function FullCard({
  card,
  history,
  rank,
}: {
  card: Card;
  history?: History;
  rank: number;
}) {
  const values = [
    { label: "Market", value: usd(card.marketPrice) },
    { label: "30D low", value: usd(history?.low30 ?? null) },
    { label: "30D high", value: usd(history?.high30 ?? null) },
    { label: "Hist low", value: usd(history?.historyLow ?? null) },
    { label: "History high", value: usd(history?.historyHigh ?? null) },
    { label: "Median", value: usd(card.midPrice) },
    {
      label: "7 day",
      value: pct(history?.change7 ?? null),
      tone: movementTone(history?.change7),
    },
    {
      label: "30 day",
      value: pct(history?.change30 ?? null),
      tone: movementTone(history?.change30),
    },
    {
      label: "90 day",
      value: pct(history?.change90 ?? null),
      tone: movementTone(history?.change90),
    },
  ];
  return (
    <FullMarketCard
      className="leader-row full-card"
      artClassName="full-art"
      dataClassName="full-data"
      titleClassName="full-title"
      image={card.image}
      alt={`${card.name} card`}
      title={card.name}
      meta={cardMeta(card)}
      secondary={
        <em>
          {card.set} · {card.year}
        </em>
      }
      rank={rank}
      content={
        <span className="full-prices">
          {values.map((item) => (
            <span key={item.label}>
              <small>{item.label}</small>
              <b className={item.tone}>{item.value}</b>
            </span>
          ))}
        </span>
      }
      history={
        <HistoryPanel
          title="Near Mint market history"
          subtitle={history?.variant ?? card.printing}
          points={history?.points ?? []}
          metrics={[]}
          large
        />
      }
      historyClassName="full-history"
    />
  );
}
function HoverCard({
  card,
  history,
  signal,
}: {
  card: Card;
  history?: History;
  signal?: ReturnType<typeof marketSignal>;
}) {
  return (
    <HistoryPopover
      className="hover-card"
      identityClassName="hover-card-art"
      image={card.image}
      alt={`${card.name} card`}
      badge={signal && <SignalBadge signal={signal} />}
      favorite={cardFavorite(card)}
      label={`${card.name} price history`}
    >
      <HistoryPanel
        title="Near Mint market history"
        subtitle={history?.variant ?? card.printing}
        points={history?.points ?? []}
        metrics={cardHistoryMetrics(card, history)}
      />
    </HistoryPopover>
  );
}

export default function Home() {
  const [game, setGame] = useState<Game>("pokemon"),
    [selectedRarities, setSelectedRarities] = useState<string[]>(
      defaultRarities.pokemon,
    ),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState<SortKey>("market"),
    [direction, setDirection] = useState<Direction>("desc"),
    [view, setView] = useState<View>("medium"),
    [perPage, setPerPage] = useState(20),
    [page, setPage] = useState(1);
  const [mode, setMode] = useState<"singles" | "sealed">("singles"),
    [scalperMode, setScalperMode] = useState<ScalperMode>("regular"),
    [sealedState, setSealedState] = useState<SealedQueryState>(
      () => parseMarketQuery("?mode=sealed") as SealedQueryState,
    ),
    [sealedRevision, setSealedRevision] = useState(0);
  const lastRegularSealedMarket = useRef<SealedGame>("pokemon");
  const [signalView, setSignalView] = useState<SignalSide>("leaderboard"),
    [strictness, setStrictness] = useState<SignalStrictness>("balanced");
  const freshIso = useFreshness(index.sourceUpdatedAt);
  const favorites = useFavorites();
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [minPrice, setMinPrice] = useState(""),
    [maxPrice, setMaxPrice] = useState(""),
    [selectedSets, setSelectedSets] = useState<string[]>([]),
    [movement, setMovement] = useState<MovementFilters>({
      up7: false,
      down7: false,
      up30: false,
      down30: false,
    });
  const restoreQuery = (state: MarketQueryState) => {
    setMode(state.mode);
    setSignalView(state.signal);
    if (state.mode === "sealed") {
      if (state.market === "scalping") setScalperMode("scalper");
      else lastRegularSealedMarket.current = state.market;
      setSealedState(state);
      setSealedRevision((value) => value + 1);
      return;
    }
    setGame(state.market);
    setSelectedRarities(state.rarities);
    setView(state.view);
    setSort(state.sort);
    setDirection(state.direction);
    setPage(state.page);
    setPerPage(state.perPage);
    setQuery(state.query);
    setMinPrice(state.minPrice);
    setMaxPrice(state.maxPrice);
    setSelectedSets(state.sets);
    setMovement({
      up7: state.up7,
      down7: state.down7,
      up30: state.up30,
      down30: state.down30,
    });
  };
  const { urlReady, writeUrl } = useMarketQueryState(restoreQuery);
  // The generated index only knows sections its sync has produced; staged sections
  // (Japanese promos, audit Phase E) inject here until the next feed regeneration.
  const rarityOptions = [
      ...index.rarities[game],
      ...(game === "pokemon" && !index.rarities.pokemon.some((option) => option.key === "japanese-promos")
        ? [{ key: "japanese-promos", label: "Japanese Promos" }]
        : []),
    ].filter((option) => option.key !== "all"),
    allRarities =
      !selectedRarities.length ||
      selectedRarities.length === rarityOptions.length,
    selectedRarityNames = selectedRarities.map((key) =>
      displayLabel(
        rarityOptions.find((option) => option.key === key)?.label ?? key,
      ),
    ),
    rarityLabel = allRarities
      ? "All"
      : selectedRarityNames.length <= 2
        ? selectedRarityNames.join(" & ")
        : `${selectedRarityNames.slice(0, 2).join(", ")} & ${selectedRarityNames.length - 2} More`;
  const catalogSources = urlReady
    ? (selectedRarities.length
        ? selectedRarities
        : rarityOptions.map((option) => option.key)
      ).map((key) => `/data/${key}.json`)
    : [];
  const {
    items: cards,
    status: catalogStatus,
    reload: reloadCatalog,
  } = useCatalogPage({
    enabled: urlReady,
    sources: catalogSources,
    parse: parseCards,
    keyOf: cardKey,
  });
  const {
    history,
    status: historyStatus,
    request: requestHistory,
  } = usePriceHistoryBatch();
  const persistedSignals = usePersistedSignals({
    kind: "single",
    market: game,
    side: signalView,
    strictness,
  });
  useEffect(() => {
    if (!urlReady) return;
    if (mode === "sealed") {
      writeUrl({ ...sealedState, signal: signalView, strictness });
      return;
    }
    writeUrl({
      mode: "singles",
      market: game,
      rarities: selectedRarities,
      view,
      sort,
      direction,
      page,
      perPage,
      signal: signalView,
      strictness,
      query,
      minPrice,
      maxPrice,
      sets: selectedSets,
      up7: movement.up7,
      down7: movement.down7,
      up30: movement.up30,
      down30: movement.down30,
    });
  }, [
    urlReady,
    game,
    selectedRarities,
    view,
    sort,
    direction,
    page,
    perPage,
    mode,
    signalView,
    strictness,
    query,
    minPrice,
    maxPrice,
    selectedSets,
    movement,
    sealedState,
    writeUrl,
  ]);
  const signalFor = (card: Card) =>
    signalView === "leaderboard"
      ? null
      : persistedSignals.ready
        ? (persistedSignals.derived[card.productId]?.signal ?? null)
        : marketSignal(
            history[card.productId]?.points ?? [],
            signalView,
            strictness,
            card.marketPrice,
          );
  const derived = useMemo(
    () => buildCatalogDerived(cards, history, persistedSignals, signalFor),
    [cards, history, signalView, strictness, persistedSignals],
  );
  const favoriteSingleIds = useMemo(
    () => new Set(favorites.entries.filter((entry) => entry.kind === "single").map((entry) => entry.productId)),
    [favorites.entries],
  );
  const scopedCards = useMemo(
    () => (favoritesOnly ? cards.filter((card) => favoriteSingleIds.has(card.productId)) : cards),
    [cards, favoritesOnly, favoriteSingleIds],
  );
  const eligible = useMemo(
    () =>
      filterSinglesCandidates(scopedCards, {
        market: game,
        sections: selectedRarities,
        query,
        sets: selectedSets,
        minPrice,
        maxPrice,
      }),
    [scopedCards, game, selectedRarities, query, selectedSets, minPrice, maxPrice],
  );
  const catalogResult = useMemo(
    () =>
      querySinglesCatalog(
        scopedCards,
        {
          market: game,
          sections: selectedRarities,
          query,
          sets: selectedSets,
          minPrice,
          maxPrice,
          up7: movement.up7,
          down7: movement.down7,
          up30: movement.up30,
          down30: movement.down30,
          signal: signalView,
          strictness,
          sort,
          direction,
          page,
          perPage,
        },
        derived,
      ),
    [
      scopedCards,
      game,
      selectedRarities,
      query,
      selectedSets,
      minPrice,
      maxPrice,
      movement,
      signalView,
      strictness,
      sort,
      direction,
      page,
      perPage,
      derived,
    ],
  );
  const availableSets = catalogResult.facets.sets,
    total = catalogResult.total,
    pages = catalogResult.pages,
    visible = catalogResult.items;
  const fallbackCandidates = useMemo(
    () =>
      selectSignalCandidates(
        eligible,
        SIGNAL_FALLBACK_LIMIT,
        (card) => card.section,
      ),
    [eligible],
  );
  const signalCoverage =
    signalView === "leaderboard"
      ? null
      : persistedSignals.ready
        ? "full persisted coverage"
        : `${fallbackCandidates.length.toLocaleString()}/${eligible.length.toLocaleString()} stratified candidates evaluated`;
  const broadHistory =
    Object.values(movement).some(Boolean) || signalView !== "leaderboard";
  const historyCards = persistedSignals.ready
    ? visible
    : broadHistory
      ? fallbackCandidates
      : visible;
  usePriceHistoryPrefetch(
    historyCards.map((card) => ({
      productId: card.productId,
      printing: card.printing,
    })),
    signalView === "leaderboard" || persistedSignals.resolved,
    requestHistory,
  );
  const switchGame = (next: Game) => {
    setGame(next);
    setSelectedRarities(defaultRarities[next]);
    setSelectedSets([]);
    setQuery("");
    setSort("market");
    setDirection("desc");
    setPage(1);
  };
  const changeSort = (next: SortKey) => {
    setDirection((current) =>
      nextSortDirection(sort, current, next, ascendingSinglesSorts),
    );
    setSort(next);
    setPage(1);
  };
  useEffect(() => {
    document.documentElement.dataset.appReady = "true";
    return () => {
      delete document.documentElement.dataset.appReady;
    };
  }, []);
  useEffect(() => {
    const saved = localStorage.getItem("raw-signal-strictness");
    if (saved === "conservative" || saved === "aggressive") setStrictness(saved);
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(location.search),
      urlScalping =
        params.get("mode") === "sealed" && params.get("market") === "scalping",
      saved: ScalperMode =
        urlScalping ||
        localStorage.getItem("raw-signal-scalper-mode") === "scalper"
          ? "scalper"
          : "regular";
    setScalperMode(saved);
    if (saved === "scalper") {
      setSealedState((current) => ({
        ...current,
        market: "scalping",
        productTypes: [],
        sets: [],
        page: 1,
      }));
      setSealedRevision((value) => value + 1);
    }
  }, []);
  const changeStrictness = (value: SignalStrictness) => {
    setStrictness(value);
    localStorage.setItem("raw-signal-strictness", value);
    setPage(1);
  };
  const changeScalperMode = (next: ScalperMode) => {
    setScalperMode(next);
    localStorage.setItem("raw-signal-scalper-mode", next);
    setSealedState((current) =>
      next === "scalper"
        ? {
            ...current,
            market: "scalping",
            productTypes: [],
            sets: [],
            page: 1,
          }
        : {
            ...current,
            market:
              current.market === "scalping"
                ? lastRegularSealedMarket.current
                : current.market,
            productTypes: [],
            sets: [],
            keepPct: 100,
            taxOn: false,
            taxRate: 8,
            shipping: 0,
            profitableOnly: false,
            page: 1,
          },
    );
    setSealedRevision((value) => value + 1);
  };
  const updateSealedState = (next: SealedQueryState) => {
    if (next.market !== "scalping")
      lastRegularSealedMarket.current = next.market;
    setSealedState(next);
  };
  const changeSignalView = (value: SignalSide) => {
    setSignalView(value);
    if (mode === "singles") {
      setSort(value === "leaderboard" ? "market" : "signal");
      setDirection("desc");
      setPage(1);
    }
  };
  const changeMode = (value: "singles" | "sealed") => {
    if (value === "singles") {
      setSort(signalView === "leaderboard" ? "market" : "signal");
      setDirection("desc");
      setPage(1);
    } else
      setSealedState((current) => ({
        ...current,
        ...(scalperMode === "scalper"
          ? { market: "scalping" as const, productTypes: [], sets: [] }
          : {}),
        signal: signalView,
        strictness,
        // Market action is the default lens (audit C5): profit-vs-MSRP only covers the
        // small MSRP-verified slice, so it is an opt-in sort, not the landing order.
        sort: signalView === "leaderboard" ? "market" : "signal",
        direction: "desc",
        page: 1,
      }));
    setMode(value);
  };
  const activeSorts = signalAwareSorts(
    singlesModel.sorts,
    signalSort,
    signalView,
  );
  const filterSummary = [
    query
      ? { key: "query", label: `Search: ${query}`, clear: () => setQuery("") }
      : null,
    minPrice || maxPrice
      ? {
          key: "price",
          label: `Price: ${minPrice ? `$${minPrice}` : "Any"}–${maxPrice ? `$${maxPrice}` : "Any"}`,
          clear: () => {
            setMinPrice("");
            setMaxPrice("");
          },
        }
      : null,
    ...selectedSets.map((set) => ({
      key: `set:${set}`,
      label: set,
      clear: () => setSelectedSets(selectedSets.filter((value) => value !== set)),
    })),
    movement.up7
      ? {
          key: "up7",
          label: "7D Increase",
          clear: () => setMovement((value) => ({ ...value, up7: false })),
        }
      : null,
    movement.down7
      ? {
          key: "down7",
          label: "7D Decrease",
          clear: () => setMovement((value) => ({ ...value, down7: false })),
        }
      : null,
    movement.up30
      ? {
          key: "up30",
          label: "30D Increase",
          clear: () => setMovement((value) => ({ ...value, up30: false })),
        }
      : null,
    movement.down30
      ? {
          key: "down30",
          label: "30D Decrease",
          clear: () => setMovement((value) => ({ ...value, down30: false })),
        }
      : null,
  ].filter((item): item is { key: string; label: string; clear: () => void } =>
    Boolean(item),
  );
  return (
    <main>
      <TopBar
        active={mode === "sealed" ? "sealed" : game}
        strictness={strictness}
        onStrictness={changeStrictness}
        settingsExtra={
          <>
            <span className="settings-section-title">Sealed analysis</span>
            <div
              className={`scalper-mode-toggle is-${scalperMode}`}
              role="group"
              aria-label="Sealed analysis mode"
            >
              <i aria-hidden="true" />
              <button
                className={scalperMode === "regular" ? "active" : ""}
                aria-pressed={scalperMode === "regular"}
                onClick={() => changeScalperMode("regular")}
              >
                Regular
              </button>
              <button
                className={scalperMode === "scalper" ? "active" : ""}
                aria-pressed={scalperMode === "scalper"}
                onClick={() => changeScalperMode("scalper")}
              >
                Scalper
              </button>
            </div>
            <small className="scalper-mode-help">
              Adds an in-print sealed market and optional sale assumptions.
            </small>
          </>
        }
      />
      <header className="masthead" id="top">
        <p className="kicker">Daily TCG market intelligence</p>
        <h1>
          The card market, <span>without the noise.</span>
        </h1>
      </header>
      <div className="product-navigation">
        <SegmentedView
          value={mode}
          options={productViews}
          label="Product type"
          className="product-toggle"
          onChange={changeMode}
        />
      </div>
      <div className="signal-navigation">
        <SignalTabs value={signalView} onChange={changeSignalView} />
        {mode === "singles" && (
          <button
            type="button"
            className={`hot-add-button favorites-toggle ${favoritesOnly ? "active" : ""}`}
            aria-pressed={favoritesOnly}
            onClick={() => { setFavoritesOnly((value) => !value); setPage(1); }}
          >
            {favoritesOnly ? "★" : "☆"} Favorites{favoriteSingleIds.size ? ` (${favoriteSingleIds.size})` : ""}
          </button>
        )}
        {mode === "singles" && signalView !== "leaderboard" && (
          <button
            type="button"
            className="hot-add-button"
            onClick={() => {
              const scored = [...catalogResult.allItems]
                .sort((a, b) => (derived[b.productId]?.signal?.score ?? 0) - (derived[a.productId]?.signal?.score ?? 0))
                .slice(0, 10);
              favorites.addMany(scored.map((card) => ({
                key: favoriteKey("single", card.productId),
                kind: "single" as const,
                game: card.game,
                productId: card.productId,
                name: card.name,
                set: card.set,
                number: card.number,
                section: card.section,
                image: card.image || null,
                price: card.marketPrice,
                addedAt: new Date().toISOString(),
              })));
            }}
          >
            ☆ Top 10 → Buy List
          </button>
        )}
      </div>
      {mode === "singles" ? (
        <MarketLeaderboard
          className="leaderboard"
          id="leaderboard"
          historyStatus={historyStatus}
          marketStripPlacement="before"
          marketStrip={
            <section className="market-strip">
              <label>
                <span>Market</span>
                <select
                  aria-label="Singles market"
                  value={game}
                  onChange={(e) => switchGame(e.target.value as Game)}
                >
                  <option value="pokemon">Pokémon</option>
                  <option value="riftbound">Riftbound</option>
                </select>
              </label>
              <MultiSelectField
                label="Rarity"
                options={rarityOptions.map((option) => ({
                  key: option.key,
                  label: displayLabel(option.label),
                }))}
                selected={selectedRarities}
                onChange={(values) => {
                  setSelectedRarities(values);
                  setPage(1);
                }}
                allLabel="All rarities"
                searchable={false}
              />
              <div className="ranked-stat">
                <span>Cards ranked</span>
                <strong>{index.totals[game].toLocaleString()}</strong>
                <small>total in {formatGameName(game)}</small>
              </div>
              <label>
                <span>Cards per page</span>
                <select
                  aria-label="Cards per page"
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  <option>20</option>
                  <option>30</option>
                  <option>40</option>
                  <option>50</option>
                </select>
              </label>
            </section>
          }
          header={
            <LeaderboardHeader
              className="section-heading is-filtered"
              kicker={`${formatGameName(game)} market ranking`}
              title={`${rarityLabel} ${signalView === "leaderboard" ? (selectedRarities.length > 1 && !allRarities ? "Leaderboards" : "Leaderboard") : signalView === "buy" ? "Hot Buys" : "Hot Sells"}`}
              summary={
                <ActiveFilterSummary
                  items={filterSummary}
                  matches={total}
                  label="Active leaderboard filters"
                  signalLabel={
                    signalView !== "leaderboard"
                      ? `${strictness[0].toUpperCase() + strictness.slice(1)} Signals`
                      : undefined
                  }
                  onRemove={() => setPage(1)}
                />
              }
              aside={
                <span>
                  {signalView === "leaderboard"
                    ? `${total.toLocaleString()} cards · updated ${updatedLabel(freshIso)}`
                    : `Top ${total.toLocaleString()} by signal score · ${strictness[0].toUpperCase() + strictness.slice(1)} strictness (change in ⚙) · updated ${updatedLabel(freshIso)}`}
                  {signalCoverage && ` · ${signalCoverage}`}
                  {signalView !== "leaderboard" && (
                    <InfoHint label="How signals work">
                      Signals score proximity to a 30/90-day price extreme, the size of the
                      swing it would retrace, and history depth. Buys additionally require
                      the price to have bounced off its low and to not be falling this week.
                      The board is the top {HOT_BOARD_LIMIT} by score.
                    </InfoHint>
                  )}
                </span>
              }
            />
          }
          controls={
            <LeaderboardControls className="controls">
              <label>
                <span>⌕</span>
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search card, set, or number"
                />
              </label>
              <CardFilters
                sets={availableSets}
                selectedSets={selectedSets}
                onSets={(value) => {
                  setSelectedSets(value);
                  setPage(1);
                }}
                minPrice={minPrice}
                maxPrice={maxPrice}
                onMinPrice={(value) => {
                  setMinPrice(value);
                  setPage(1);
                }}
                onMaxPrice={(value) => {
                  setMaxPrice(value);
                  setPage(1);
                }}
                movement={movement}
                onMovement={(value) => {
                  setMovement(value);
                  setPage(1);
                }}
                onReset={() => {
                  setMinPrice("");
                  setMaxPrice("");
                  setSelectedSets([]);
                  setMovement({
                    up7: false,
                    down7: false,
                    up30: false,
                    down30: false,
                  });
                  setPage(1);
                }}
              />
              <SegmentedView
                value={view}
                options={singlesModel.views}
                label={singlesModel.viewLabel}
                onChange={(next) => {
                  setView(next);
                  setPage(1);
                }}
              />
            </LeaderboardControls>
          }
          sortSurface={
            view === "large" || view === "full" ? (
              <SortToolbar
                items={activeSorts}
                sort={sort}
                direction={direction}
                onSort={changeSort}
                label={`${view} card sorting`}
              />
            ) : (
              <div
                className={`table-head ${view} ${signalView !== "leaderboard" ? "has-signal" : ""}`}
                role="row"
              >
                <span role="columnheader">Rank</span>
                {activeSorts.map((item) => (
                  <SortableHeader
                    key={item.key}
                    label={item.label}
                    column={item.key}
                    sort={sort}
                    direction={direction}
                    onSort={changeSort}
                  />
                ))}
                <span aria-hidden="true" />
              </div>
            )
          }
          rowsClassName={`rows view-${view}`}
          rowsRole="rowgroup"
          state={resultState(catalogStatus, !visible.length)}
          loadingLabel={`Loading ${rarityLabel} data`}
          skeletonCount={Math.min(8, perPage)}
          errorMessage="Card data is temporarily unavailable."
          emptyMessage="No cards match the current selection."
          onRetry={reloadCatalog}
          rows={visible.map((c, i) => {
            const h = history[c.productId],
              rank = (page - 1) * perPage + i + 1,
              signal = signalFor(c),
              columnSignal = signal && (view === "medium" || view === "text");
            if (view === "full")
              return (
                <span className="signal-card-wrap" key={c.productId}>
                  {signal && <SignalBadge signal={signal} />}
                  <a className="detail-link-card" href={`/cards/${c.productId}`} aria-label={`View ${c.name} details`}>
                    <FullCard card={c} history={h} rank={rank} />
                  </a>
                </span>
              );
            return (
              <MarketRow
                className={`leader-row ${columnSignal ? "has-signal" : ""}`}
                key={c.productId}
                href={`/cards/${c.productId}`}
                label={`View ${c.name} details`}
                popover={
                  <HoverCard
                    card={c}
                    history={h}
                    signal={signal ?? undefined}
                  />
                }
              >
                <span className="position">
                  {String(rank).padStart(2, "0")}
                </span>
                <ProductIdentity
                  className="identity"
                  image={c.image}
                  alt=""
                  title={c.name}
                  meta={cardMeta(c)}
                  badge={
                    signal &&
                    view === "large" && <SignalBadge signal={signal} />
                  }
                />
                {columnSignal && (
                  <span className="signal-cell">
                    <SignalBadge signal={signal} />
                  </span>
                )}
                <span className="set-name">
                  {c.set}
                  <small>{c.year}</small>
                </span>
                <span className="market-price">
                  {usd(c.marketPrice)}
                  <small>Mid {usd(c.midPrice)}</small>
                </span>
                <span className="low">{h ? usd(h.low30) : "…"}</span>
                <span className="high">{h ? usd(h.high30) : "…"}</span>
                <span
                  className={`change change7 ${h?.change7 != null && h.change7 < 0 ? "down" : "up"}`}
                >
                  {h ? pct(h.change7) : "…"}
                </span>
                <span
                  className={`change change30 ${h?.change30 != null && h.change30 < 0 ? "down" : "up"}`}
                >
                  {h ? pct(h.change30) : "…"}
                </span>
              </MarketRow>
            );
          })}
          pagination={{
            page,
            pages,
            onChange: setPage,
            label: singlesModel.paginationLabel,
          }}
        />
      ) : (
        <SealedView
          key={sealedRevision}
          signalView={signalView}
          strictness={strictness}
          scalperEnabled={scalperMode === "scalper"}
          initialState={sealedState}
          onQueryChange={updateSealedState}
        />
      )}
      <section className="method" id="method">
        <p className="kicker">The methodology</p>
        <h2>How Raw Signal works.</h2>
        <p className="method-intro">
          A daily, raw-card market view built from cached TCGplayer catalog and
          pricing data. It separates current listings from historical market
          signals, keeps printing variants explicit, and marks unavailable data
          instead of estimating it.
        </p>
        <div className="method-grid">
          <p>
            <b>Daily ingestion</b> A validated sync reads TCGCSV groups,
            products, and prices, records source freshness and rejected records,
            and preserves the last good snapshot when an upstream response fails
            validation.
          </p>
          <p>
            <b>Current price fields</b> Market approximates recent selling
            value. TCGCSV listing low and median remain in card details;
            listing highs are excluded from the interface because price
            parking distorts them.
          </p>
          <p>
            <b>30-day range columns</b> The leaderboard’s Low and High columns
            are calculated from Near Mint market-history observations in the
            most recent 30-day window. Missing history stays unavailable rather
            than falling back silently to listing extremes.
          </p>
          <p>
            <b>History and signals</b> Matching history is cached durably when
            database coverage is available. Hot Buy and Hot Sell pages switch to
            complete persisted signals only after a validated backfill; during
            transition the interface reports how many candidates were evaluated.
          </p>
          <p>
            <b>Search and pagination</b> Pokémon and Riftbound share the same
            query engine for search, sorting, filtering, and pagination.
            Filters, view, sort, and page are encoded in the URL for sharing.
          </p>
          <p>
            <b>Images and sealed products</b> Text and prices render before
            near-viewport images. Failed art receives a readable fallback.
            Sealed market or median is compared with published MSRP; missing
            regional prices remain N/A.
          </p>
        </div>
        <p className="method-note">
          Coverage is limited to source-feed records and defined rarity groups.
          Prices are USD, may lag marketplaces, generally exclude shipping, and
          are informational—not financial advice.
        </p>
      </section>
      <footer>
        <a className="brand" href="#top">
          <span>R</span> Raw Signal
        </a>
        <p>
          Current catalog and listing prices from{" "}
          <a href="https://tcgcsv.com/docs" target="_blank" rel="noreferrer">
            TCGCSV
          </a>
          ; Near Mint market history from TCGplayer; sealed MSRP from publisher
          sources.
        </p>
      </footer>
    </main>
  );
}
