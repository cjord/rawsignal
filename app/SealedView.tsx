"use client";
/* eslint-disable react-hooks/exhaustive-deps -- keyed effects synchronize remote sealed data and history */
import { useEffect, useMemo, useState } from "react";
import index from "../tcg-index.json";
import { useFreshness } from "./data/useFreshness";
import HistoryPanel, { movementMetric, movementTone } from "./HistoryPanel";
import {
  SegmentedView,
  SortableHeader,
  SortToolbar,
  type Direction,
} from "./MarketUI";
import SealedFilters from "./SealedFilters";
import { REGIME_LABELS, type MarketRegime } from "../core/domain/regime";
import { RegimeChip, SignalBadge } from "./SignalControls";
import FavoriteStar from "./FavoriteStar";
import { sealedFavorite } from "./state/favorites";
import { useFavoriteScope } from "./state/useFavorites";
import type { SignalSide, SignalStrictness } from "../core/signal-utils";
import MultiSelectField from "./MultiSelectField";
import PerPageSelect from "./PerPageSelect";
import SaleScenario from "./SaleScenario";
import { parseSealedProducts } from "../core/domain/contracts";
import { formatFullDate, formatGameName, formatPercent, formatUsd } from "../core/domain/formatters";
import type {
  PriceHistory,
  SealedMarket,
  SealedProduct,
  SealedView as SealedViewMode,
} from "../core/domain/types";
import type { SealedQueryState } from "./state/market-query";
import { useCatalogPage } from "./data/useCatalogPage";
import {
  calculateSealedScenario,
  querySealedCatalog,
} from "../core/catalog-query";
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
import LeaderboardSearch from "./leaderboard/LeaderboardSearch";
import FullViewCardWrap from "./leaderboard/FullViewCardWrap";
import { useSetGroups } from "./leaderboard/useSetGroups";
import ActiveFilterSummary from "./leaderboard/ActiveFilterSummary";
import { resultState, type LeaderboardModeModel } from "./leaderboard/types";
import MarketRow from "./leaderboard/MarketRow";
import ProductIdentity from "./leaderboard/ProductIdentity";
import HistoryPopover from "./leaderboard/HistoryPopover";
import FullMarketCard from "./leaderboard/FullMarketCard";
import {
  buildCatalogDerived,
  nextSortDirection,
  selectionChips,
  signalAwareSorts,
  signalResolver,
} from "./leaderboard/mode-adapter";

type Game = SealedMarket;
type Basis = "market" | "median";
type View = SealedViewMode;
type SortKey =
  | "name"
  | "signal"
  | "set"
  | "msrp"
  | "market"
  | "low"
  | "high"
  | "change7"
  | "change30"
  | "profit"
  | "profitPct";
type Product = SealedProduct;
type History = PriceHistory;
// Regular mode mirrors the singles columns (scalper rework 2026-08-28); scalper mode
// swaps the 30D range for profit, which closes the table as its last two columns.
const REGULAR_SORTS: { label: string; key: SortKey }[] = [
  { label: "Product", key: "name" },
  { label: "Set", key: "set" },
  { label: "MSRP", key: "msrp" },
  { label: "Market", key: "market" },
  { label: "30D Low", key: "low" },
  { label: "30D High", key: "high" },
  { label: "7D", key: "change7" },
  { label: "30D", key: "change30" },
];
const SCALPER_SORTS: { label: string; key: SortKey }[] = [
  { label: "Product", key: "name" },
  { label: "Set", key: "set" },
  { label: "MSRP", key: "msrp" },
  { label: "Market", key: "market" },
  { label: "7D", key: "change7" },
  { label: "30D", key: "change30" },
  { label: "Profit", key: "profit" },
  { label: "Profit %", key: "profitPct" },
];
const sealedModel: LeaderboardModeModel<View, SortKey> = {
  views: [
    { key: "medium", label: "Medium", icon: "▤" },
    { key: "text", label: "Text", icon: "☷" },
    { key: "full", label: "Full", icon: "▥" },
  ],
  sorts: REGULAR_SORTS,
  viewLabel: "Sealed product view",
  paginationLabel: "Sealed product pages",
};
const sealedSignalSort = { label: "Signal", key: "signal" as SortKey };
const ascendingSealedSorts = new Set<SortKey>(["name", "set"]);

// What the URL should say for this state under the given mode (decision D11): an
// out-of-mode sort falls back to Market, and the profit filters/scenario serialize only
// while scalping — regular mode keeps the typed values without applying or sharing them.
export const sealedUrlState = (state: SealedQueryState, isScalping: boolean): SealedQueryState => {
  const modeSorts = isScalping ? SCALPER_SORTS : REGULAR_SORTS;
  const valid = new Set<string>([...modeSorts.map((item) => item.key), "signal"]);
  return {
    ...state,
    sort: valid.has(state.sort) ? state.sort : "market",
    profitMin: isScalping ? state.profitMin : "",
    profitMax: isScalping ? state.profitMax : "",
    profitPctMin: isScalping ? state.profitPctMin : "",
    profitPctMax: isScalping ? state.profitPctMax : "",
    keepPct: isScalping ? state.keepPct : 100,
    taxOn: isScalping ? state.taxOn : false,
    taxRate: isScalping ? state.taxRate : 8,
    shipping: isScalping ? state.shipping : 0,
    profitableOnly: isScalping ? state.profitableOnly : false,
  };
};
const usd = (value: number | null) => formatUsd(value, "N/A");
const pct = (value: number | null) => formatPercent(value, "N/A");
const productKey = (product: Product) => product.productId;

export default function SealedView({
  signalView = "leaderboard",
  strictness = "balanced",
  scalperEnabled = false,
  favoritesOnly = false,
  state,
  onState,
}: {
  signalView?: SignalSide;
  strictness?: SignalStrictness;
  scalperEnabled?: boolean;
  favoritesOnly?: boolean;
  state: SealedQueryState;
  onState: (updater: (current: SealedQueryState) => SealedQueryState) => void;
}) {
  // The market comes from the page-level slider (the page owns all sealed query state —
  // decision D11); a stale scalping URL without scalper mode falls back for display.
  const game: Game = state.market === "scalping" && !scalperEnabled ? "pokemon" : state.market;
  const {
    query,
    sets: selectedSets,
    regimes: selectedRegimes,
    productTypes: selectedTypes,
    marketMin,
    marketMax,
    msrpMin,
    msrpMax,
    profitMin,
    profitMax,
    profitPctMin,
    profitPctMax,
    sort,
    direction,
    perPage,
    page,
    view,
    keepPct,
    taxOn,
    taxRate,
    shipping,
    profitableOnly,
  } = state;
  const [setEv, setSetEv] = useState<Record<string, { packEv: number | null; evRatio: number | null }>>({});
  // Controlled setters keep the names the JSX has always used, now writing through the
  // page-owned state instead of local copies reconciled by a remount key.
  const patch = (partial: Partial<SealedQueryState>) => onState((current) => ({ ...current, ...partial }));
  const setQuery = (query: string) => patch({ query });
  const setSelectedSets = (sets: string[]) => patch({ sets });
  const setSelectedRegimes = (regimes: string[]) => patch({ regimes });
  const setSelectedTypes = (productTypes: string[]) => patch({ productTypes });
  const setMarketMin = (marketMin: string) => patch({ marketMin });
  const setMarketMax = (marketMax: string) => patch({ marketMax });
  const setMsrpMin = (msrpMin: string) => patch({ msrpMin });
  const setMsrpMax = (msrpMax: string) => patch({ msrpMax });
  const setProfitMin = (profitMin: string) => patch({ profitMin });
  const setProfitMax = (profitMax: string) => patch({ profitMax });
  const setProfitPctMin = (profitPctMin: string) => patch({ profitPctMin });
  const setProfitPctMax = (profitPctMax: string) => patch({ profitPctMax });
  const setSort = (sort: SortKey) => patch({ sort });
  const setDirection = (next: Direction | ((current: Direction) => Direction)) =>
    onState((current) => ({ ...current, direction: typeof next === "function" ? next(current.direction) : next }));
  const setPerPage = (perPage: number) => patch({ perPage });
  const setPage = (page: number) => patch({ page });
  const setView = (view: View) => patch({ view });
  // Market/Median toggle removed from the UI (todo N4 batch, 2026-09-01): the display
  // basis is pinned to market pricing. The capability survives underneath — the URL
  // codec still parses/serializes `basis`, the query and scenario layers stay
  // parameterized — so a future surface can re-expose it without data work.
  const basis: Basis = "market";
  const setKeepPct = (keepPct: number) => patch({ keepPct });
  const setTaxOn = (taxOn: boolean) => patch({ taxOn });
  const setTaxRate = (taxRate: number) => patch({ taxRate });
  const setShipping = (shipping: number) => patch({ shipping });
  const setProfitableOnly = (profitableOnly: boolean) => patch({ profitableOnly });
  const isScalping = scalperEnabled,
    isScalpingMarket = game === "scalping",
    scenarioProfitableOnly = isScalping && profitableOnly;
  // Each mode has its own column set; a sort carried across the toggle (or an old URL)
  // that the mode no longer shows falls back to Market. Profit filters only bind in
  // scalper mode — regular keeps the typed values but never applies or serializes them.
  const modeSorts = isScalping ? SCALPER_SORTS : REGULAR_SORTS;
  const validSorts = useMemo(() => new Set<SortKey>([...modeSorts.map(item => item.key), "signal"]), [modeSorts]);
  const effectiveSort = validSorts.has(sort) ? sort : "market";
  const boundProfit = {
    profitMin: isScalping ? profitMin : "",
    profitMax: isScalping ? profitMax : "",
    profitPctMin: isScalping ? profitPctMin : "",
    profitPctMax: isScalping ? profitPctMax : "",
  };
  const scenario = {
      basis,
      keepPct: isScalping ? keepPct : 100,
      taxOn: isScalping ? taxOn : false,
      taxRate,
      shipping: isScalping ? shipping : 0,
    } as const,
    calculate = (product: Product) =>
      calculateSealedScenario(product, scenario);
  const {
    items: products,
    status: catalogStatus,
    reload: reloadCatalog,
  } = useCatalogPage({
    sources: game === "all"
      ? ["pokemon", "riftbound", "onepiece"].map((market) => `/data/sealed-${market}.json`)
      : [isScalpingMarket ? "/data/sealed-scalping.json" : `/data/sealed-${game}.json`],
    parse: parseSealedProducts,
    keyOf: productKey,
  });
  const {
    history,
    status: historyStatus,
    request: requestHistory,
  } = usePriceHistoryBatch();
  const freshIso = useFreshness(index.sourceUpdatedAt);
  const { scoped: scopedProducts } = useFavoriteScope("sealed", products, favoritesOnly);
  const setGames = useSetGroups(products);
  const persistedSignals = usePersistedSignals({
    kind: "sealed",
    market: game,
    side: basis === "market" ? signalView : "leaderboard",
    strictness,
  });
  // Per-set chase EV annotates hover cards on database-backed deployments (audit Phase C);
  // a 503 (feed-only, dev) simply leaves the metric out.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/set-ev", { signal: controller.signal })
      .then(async (response) => (response.ok ? await response.json() as { rows: { game: string; set: string; packEv: number | null; evRatio: number | null }[] } : null))
      .then((body) => { if (body?.rows && !controller.signal.aborted) setSetEv(Object.fromEntries(body.rows.map((row) => [`${row.game}|${row.set}`, { packEv: row.packEv, evRatio: row.evRatio }]))); })
      .catch(() => { /* Feed-only deployment; hover cards omit EV. */ });
    return () => controller.abort();
  }, []);
  const signalFor = signalResolver<Product>(signalView, strictness, persistedSignals, history, (product) => calculate(product).value);
  const derived = useMemo(
    () => buildCatalogDerived(scopedProducts, history, persistedSignals, signalFor),
    [
      scopedProducts,
      history,
      signalView,
      strictness,
      basis,
      keepPct,
      taxOn,
      taxRate,
      shipping,
      persistedSignals,
    ],
  );
  const catalogResult = useMemo(
    () =>
      querySealedCatalog(
        scopedProducts,
        {
          market: game,
          productTypes: selectedTypes,
          query,
          sets: selectedSets,
          regimes: selectedRegimes,
          marketMin,
          marketMax,
          msrpMin,
          msrpMax,
          ...boundProfit,
          profitableOnly: scenarioProfitableOnly,
          ...scenario,
          signal: signalView,
          strictness,
          sort: effectiveSort,
          direction,
          page,
          perPage,
        },
        derived,
      ),
    [
      scopedProducts,
      game,
      selectedTypes,
      query,
      selectedSets,
      selectedRegimes,
      marketMin,
      marketMax,
      msrpMin,
      msrpMax,
      profitMin,
      profitMax,
      profitPctMin,
      profitPctMax,
      profitableOnly,
      basis,
      keepPct,
      taxOn,
      taxRate,
      shipping,
      signalView,
      strictness,
      sort,
      direction,
      page,
      perPage,
      derived,
      isScalping,
    ],
  );
  const sets = catalogResult.facets.sets,
    productTypes = catalogResult.facets.productTypes,
    filtered = catalogResult.allItems,
    pages = catalogResult.pages,
    visible = catalogResult.items;
  const metrics = useMemo(() => {
    const rows = filtered.map(calculate),
      priced = rows.filter((row) => row.value != null);
    return {
      market: priced.reduce((sum, row) => sum + row.value!, 0),
      count: rows.length,
    };
  }, [filtered, basis, keepPct, taxOn, taxRate, shipping]);
  const fallbackProducts = useMemo(
    () =>
      selectSignalCandidates(
        products,
        SIGNAL_FALLBACK_LIMIT,
        (product) => product.category,
      ),
    [products],
  );
  const historyProducts = (
    signalView === "leaderboard" || persistedSignals.ready
      ? visible
      : fallbackProducts
  ).filter(
    (product) => product.marketPrice != null || product.midPrice != null,
  );
  usePriceHistoryPrefetch(
    historyProducts.map((product) => ({
      productId: product.productId,
      printing: "Normal",
      sealed: true,
    })),
    signalView === "leaderboard" || persistedSignals.resolved,
    requestHistory,
  );
  const changeSort = (next: SortKey) => {
    // Compare against the displayed column (effectiveSort), not the raw state: a sort
    // carried across the scalper toggle can be out-of-mode, and clicking the column shown
    // as active must toggle its direction instead of restarting at descending.
    setDirection((current) =>
      nextSortDirection(effectiveSort, current, next, ascendingSealedSorts),
    );
    setSort(next);
    setPage(1);
  };
  const rowDetails = (
    product: Product,
    result: ReturnType<typeof calculate>,
    h?: History,
    large = false,
  ) => {
    const movement = (label: string, value: number | null | undefined) =>
      movementMetric(label, value, "N/A");
    return (
      <HistoryPanel
        title={h?.condition ?? "Sealed Market History"}
        subtitle={h?.variant ?? product.category}
        points={h?.points ?? []}
        label="sealed market"
        metrics={[
          { label: "MSRP", value: usd(product.msrp) },
          { label: basis === "market" ? "Market" : "Median", value: usd(result.value) },
          { label: "30D Low", value: usd(h?.low30 ?? null) },
          { label: "30D High", value: usd(h?.high30 ?? null) },
          { label: "Hist Low", value: usd(h?.historyLow ?? null) },
          ...(setEv[`${product.game}|${product.set}`]?.packEv != null
            ? [{
                label: "Set pack EV",
                value: `${usd(setEv[`${product.game}|${product.set}`].packEv)}${setEv[`${product.game}|${product.set}`].evRatio != null ? ` · ${(setEv[`${product.game}|${product.set}`].evRatio as number).toFixed(2)}×` : ""}`,
                tone: setEv[`${product.game}|${product.set}`].evRatio != null ? ((setEv[`${product.game}|${product.set}`].evRatio as number) >= 1 ? "up" as const : "down" as const) : undefined,
              }]
            : []),
          // Profit is a scalper concept: regular mode's popover and full view stay
          // aligned with the singles tiles (visual pass 2026-08-28).
          ...(isScalping
            ? [
                { label: "Profit", value: usd(result.profit), tone: movementTone(result.profit) },
                { label: "Profit %", value: pct(result.profitPct), tone: movementTone(result.profitPct) },
              ]
            : []),
          movement("7 Day", h?.change7),
          movement("30 Day", h?.change30),
          movement("90 Day", h?.change90),
        ]}
        large={large}
      />
    );
  };
  const activeSorts = signalAwareSorts(
    modeSorts,
    sealedSignalSort,
    signalView,
  );
  const summaryFilters = [
    query
      ? { key: "query", label: `Search: ${query}`, clear: () => setQuery("") }
      : null,
    selectedTypes.length
      ? {
          key: "types",
          label: `${selectedTypes.length} Product Type${selectedTypes.length === 1 ? "" : "s"}`,
          clear: () => setSelectedTypes([]),
        }
      : null,
    ...selectionChips("set", selectedSets, setSelectedSets),
    ...selectionChips("regime", selectedRegimes, setSelectedRegimes, (regime) => REGIME_LABELS[regime as MarketRegime] ?? regime),
    marketMin || marketMax
      ? {
          key: "market",
          label: `Market: ${marketMin || "Any"}–${marketMax || "Any"}`,
          clear: () => {
            setMarketMin("");
            setMarketMax("");
          },
        }
      : null,
    msrpMin || msrpMax
      ? {
          key: "msrp",
          label: `MSRP: ${msrpMin || "Any"}–${msrpMax || "Any"}`,
          clear: () => {
            setMsrpMin("");
            setMsrpMax("");
          },
        }
      : null,
    isScalping && (profitMin || profitMax)
      ? {
          key: "profit",
          label: `Profit: ${profitMin || "Any"}–${profitMax || "Any"}`,
          clear: () => {
            setProfitMin("");
            setProfitMax("");
          },
        }
      : null,
    isScalping && (profitPctMin || profitPctMax)
      ? {
          key: "profitPct",
          label: `Profit %: ${profitPctMin || "Any"}–${profitPctMax || "Any"}`,
          clear: () => {
            setProfitPctMin("");
            setProfitPctMax("");
          },
        }
      : null,
    isScalping && keepPct !== 100
      ? {
          key: "keepPct",
          label: `Keep After Fees: ${keepPct}%`,
          clear: () => setKeepPct(100),
        }
      : null,
    isScalping && shipping > 0
      ? {
          key: "shipping",
          label: `Shipping: ${usd(shipping)}`,
          clear: () => setShipping(0),
        }
      : null,
    isScalping && taxOn
      ? {
          key: "tax",
          label: `Sales Tax: ${taxRate}%`,
          clear: () => setTaxOn(false),
        }
      : null,
    scenarioProfitableOnly
      ? {
          key: "profitable",
          label: "Profitable Only",
          clear: () => setProfitableOnly(false),
        }
      : null,
  ].filter((item): item is { key: string; label: string; clear: () => void } =>
    Boolean(item),
  );
  return (
    <MarketLeaderboard
      className={`sealed-market${isScalping ? " is-scalper" : ""}`}
      id="sealed-market"
      historyStatus={historyStatus}
      header={
        <LeaderboardHeader
          className="sealed-summary"
          kicker="Sealed product intelligence"
          kickerClassName="kicker"
          title={
            signalView === "leaderboard"
              ? <>{isScalping && <em className="scalping-flag">Scalping </em>}{formatGameName(game)} Sealed</>
              : `${formatGameName(game)} ${signalView === "buy" ? "Hot Buys" : "Hot Sells"}`
          }
          description={
            signalView === "leaderboard"
              ? "MSRP compared with current TCGplayer pricing — published values where sources exist, standard type pricing (marked derived) elsewhere."
              : `${strictness[0].toUpperCase() + strictness.slice(1)} signals ranked by proximity, volatility, and data confidence.`
          }
          summary={
            <ActiveFilterSummary
              items={summaryFilters}
              matches={filtered.length}
              label="Active sealed filters"
              signalLabel={
                signalView !== "leaderboard"
                  ? `${strictness[0].toUpperCase() + strictness.slice(1)} Signals`
                  : undefined
              }
              onRemove={() => setPage(1)}
            />
          }
          aside={
            <div className="sealed-aside">
              <span className="sealed-count-line">
                <strong>{metrics.count.toLocaleString()}</strong> products · {usd(metrics.market)} combined market
              </span>
              <span className="sealed-updated">Updated {formatFullDate(freshIso)}</span>
            </div>
          }
        />
      }
      beforeControls={
        isScalping ? (
          <SaleScenario
            keepPct={keepPct}
            onKeepPct={(value) => {
              setKeepPct(value);
              setPage(1);
            }}
            taxOn={taxOn}
            onTaxOn={(value) => {
              setTaxOn(value);
              setPage(1);
            }}
            taxRate={taxRate}
            onTaxRate={(value) => {
              setTaxRate(value);
              setPage(1);
            }}
            shipping={shipping}
            onShipping={(value) => {
              setShipping(value);
              setPage(1);
            }}
            profitableOnly={profitableOnly}
            onProfitableOnly={(value) => {
              setProfitableOnly(value);
              setPage(1);
            }}
          />
        ) : undefined
      }
      controls={
        <LeaderboardControls className="sealed-toolbar">
          <LeaderboardSearch
            className="sealed-toolbar-search"
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder="Search product, set, or type"
          />
          <MultiSelectField
            label="Product type"
            className="toolbar-select"
            options={productTypes.map((type) => ({ key: type, label: type }))}
            selected={selectedTypes}
            onChange={(values) => {
              setSelectedTypes(values);
              setPage(1);
            }}
            allLabel="All product types"
            searchable={false}
          />
          <SealedFilters
            showProfit={isScalping}
            sets={sets}
            setGroups={setGames}
            selectedSets={selectedSets}
            onSets={(values) => {
              setSelectedSets(values);
              setPage(1);
            }}
            marketMin={marketMin}
            marketMax={marketMax}
            onMarketMin={(value) => {
              setMarketMin(value);
              setPage(1);
            }}
            onMarketMax={(value) => {
              setMarketMax(value);
              setPage(1);
            }}
            msrpMin={msrpMin}
            msrpMax={msrpMax}
            onMsrpMin={(value) => {
              setMsrpMin(value);
              setPage(1);
            }}
            onMsrpMax={(value) => {
              setMsrpMax(value);
              setPage(1);
            }}
            profitMin={profitMin}
            profitMax={profitMax}
            onProfitMin={(value) => {
              setProfitMin(value);
              setPage(1);
            }}
            onProfitMax={(value) => {
              setProfitMax(value);
              setPage(1);
            }}
            profitPctMin={profitPctMin}
            profitPctMax={profitPctMax}
            onProfitPctMin={(value) => {
              setProfitPctMin(value);
              setPage(1);
            }}
            onProfitPctMax={(value) => {
              setProfitPctMax(value);
              setPage(1);
            }}
            regimes={selectedRegimes}
            onRegimes={(value) => {
              setSelectedRegimes(value);
              setPage(1);
            }}
            onReset={() => {
              setSelectedSets([]);
              setSelectedRegimes([]);
              setMarketMin("");
              setMarketMax("");
              setMsrpMin("");
              setMsrpMax("");
              setProfitMin("");
              setProfitMax("");
              setProfitPctMin("");
              setProfitPctMax("");
              setPage(1);
            }}
          />
          <SegmentedView
            value={view}
            options={sealedModel.views}
            label={sealedModel.viewLabel}
            onChange={(next) => {
              setView(next);
              setPage(1);
            }}
          />
        </LeaderboardControls>
      }
      sortSurface={
        view === "full" ? (
          <SortToolbar
            items={activeSorts.map((item) =>
              item.key === "market"
                ? { ...item, label: basis === "market" ? "Market" : "Median" }
                : item,
            )}
            sort={effectiveSort}
            direction={direction}
            onSort={changeSort}
            label="Full sealed product sorting"
          />
        ) : (
          <div
            className={`sealed-head ${signalView !== "leaderboard" ? "has-signal" : ""}`}
          >
            {activeSorts.map((item) => (
              <SortableHeader
                key={item.key}
                label={
                  item.key === "market"
                    ? basis === "market"
                      ? "Market"
                      : "Median"
                    : item.label
                }
                column={item.key}
                sort={effectiveSort}
                direction={direction}
                onSort={changeSort}
              />
            ))}
          </div>
        )
      }
      rowsClassName={`sealed-rows sealed-view-${view}`}
      state={resultState(catalogStatus, !visible.length)}
      loadingLabel="Loading sealed products"
      skeletonCount={8}
      errorMessage="Sealed-product data is temporarily unavailable."
      emptyMessage="No sealed products match the current selection."
      onRetry={reloadCatalog}
      rows={visible.map((product) => {
        const result = calculate(product),
          h = history[product.productId],
          priced = result.value != null,
          comparable = result.profit != null,
          signal = signalFor(product),
          columnSignal = signal && (view === "medium" || view === "text");
        if (view === "full")
          return (
            <FullViewCardWrap
              key={product.productId}
              signal={signal}
              favorite={sealedFavorite(product)}
              href={`/sealed/${product.productId}${isScalpingMarket?"?market=scalping":""}`}
              label={`View ${product.name} details`}
            >
              <FullMarketCard
                className="sealed-full-card"
                artClassName="sealed-full-art"
                dataClassName="sealed-full-data"
                titleClassName="sealed-full-title"
                image={product.image}
                alt={`${product.name} product`}
                title={product.name}
                meta={
                  <>
                    {product.set} · {product.category}
                  </>
                }
                content={rowDetails(product, result, h)}
              />
            </FullViewCardWrap>
          );
        return (
          <MarketRow
            className={`sealed-row ${columnSignal ? "has-signal" : ""}`}
            key={product.productId}
            href={`/sealed/${product.productId}${isScalpingMarket?"?market=scalping":""}`}
            label={`View ${product.name} details`}
            popupWidth={650}
            popover={
              <HistoryPopover
                className="sealed-hover-card"
                identityClassName="sealed-hover-identity"
                artClassName="sealed-hover-art"
                image={product.image}
                alt={`${product.name} product`}
                badge={signal && <SignalBadge signal={signal} />}
                label={`${product.name} price history`}
              >
                {rowDetails(product, result, h)}
              </HistoryPopover>
            }
          >
            <ProductIdentity
              className="sealed-product"
              image={product.image}
              alt=""
              title={product.name}
              meta={product.category}
            />
            {columnSignal && (
              <span className="sealed-signal-cell">
                <SignalBadge signal={signal!} />
                <RegimeChip regime={derived[product.productId]?.regime} />
              </span>
            )}
            <span className="sealed-category">{product.set}</span>
            <span data-label="MSRP">
              <b>{usd(product.msrp)}</b>
              <small>
                {product.msrp == null
                  ? "Unavailable"
                  : scenario.taxOn
                    ? `Cost ${usd(result.cost)}`
                    : product.msrpSource}
              </small>
            </span>
            <span data-label={basis === "market" ? "Market" : "Median"}>
              <b>{usd(result.value)}</b>
              {(!priced || scenario.keepPct < 100) && (
                <small>
                  {priced ? `Proceeds ${usd(result.proceeds)}` : "No TCGplayer data"}
                </small>
              )}
            </span>
            {!isScalping && (
              <>
                <span data-label="30D Low" className="sealed-range-cell"><b>{h ? usd(h.low30 ?? null) : "…"}</b></span>
                <span data-label="30D High" className="sealed-range-cell"><b>{h ? usd(h.high30 ?? null) : "…"}</b></span>
              </>
            )}
            <span data-label="7D" className="sealed-change-cell">
              <b className={h?.change7 != null ? (h.change7 < 0 ? "down" : "up") : undefined}>{h ? pct(h.change7 ?? null) : "…"}</b>
            </span>
            <span data-label="30D" className="sealed-change-cell">
              <b className={h?.change30 != null ? (h.change30 < 0 ? "down" : "up") : undefined}>{h ? pct(h.change30 ?? null) : "…"}</b>
            </span>
            {isScalping && (
              <>
                <span
                  data-label="Profit"
                  className={
                    !comparable
                      ? ""
                      : result.profit! >= 0
                        ? "profit-positive"
                        : "profit-negative"
                  }
                >
                  <b>
                    {!comparable
                      ? "N/A"
                      : `${result.profit! >= 0 ? "+" : ""}${usd(result.profit)}`}
                  </b>
                </span>
                <span data-label="Profit %">
                  <b
                    className={`profit-pill ${!comparable ? "unavailable" : result.profitPct! >= 0 ? "positive" : "negative"}`}
                  >
                    {!comparable
                      ? "N/A"
                      : `${result.profitPct! >= 0 ? "+" : ""}${result.profitPct!.toFixed(1)}%`}
                  </b>
                </span>
              </>
            )}
            <span className="row-star"><FavoriteStar entry={sealedFavorite(product)} /></span>
          </MarketRow>
        );
      })}
      pagination={{
        page,
        pages,
        onChange: setPage,
        label: sealedModel.paginationLabel,
      }}
      paginationAside={
        <PerPageSelect
          label="Sealed products per page"
          value={perPage}
          onChange={(next) => {
            setPerPage(next);
            setPage(1);
          }}
        />
      }
      footer={
        <p className="sealed-note">
          {isScalping
            ? "Profit uses the selected price basis and optional sale assumptions above. Fees, tax, and shipping are scenario inputs, not predictions."
            : "MSRP shows published values where sources exist and standard type pricing (marked derived) elsewhere. The 30-day range and movement come from sealed market history; missing data stays unavailable rather than estimated."}
        </p>
      }
    />
  );
}
