"use client";
/* eslint-disable react-hooks/exhaustive-deps -- keyed effects synchronize remote sealed data and history */
import { useEffect, useMemo, useRef, useState } from "react";
import HistoryPanel, { movementTone } from "./HistoryPanel";
import {
  SegmentedView,
  SortableHeader,
  SortToolbar,
  type Direction,
} from "./MarketUI";
import SealedFilters from "./SealedFilters";
import { SignalBadge } from "./SignalControls";
import { sealedFavorite } from "./state/favorites";
import {
  marketSignal,
  type SignalSide,
  type SignalStrictness,
} from "./signal-utils";
import MultiSelectField from "./MultiSelectField";
import SaleScenario from "./SaleScenario";
import { parseSealedProducts } from "./domain/contracts";
import { formatGameName, formatPercent, formatUsd } from "./domain/formatters";
import type {
  PriceHistory,
  SealedMarket,
  SealedProduct,
  SealedView as SealedViewMode,
} from "./domain/types";
import type { SealedQueryState } from "./state/market-query";
import { useCatalogPage } from "./data/useCatalogPage";
import {
  calculateSealedScenario,
  querySealedCatalog,
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

type Game = SealedMarket;
type Basis = "market" | "median";
type View = SealedViewMode;
type SortKey =
  | "name"
  | "signal"
  | "set"
  | "msrp"
  | "market"
  | "profit"
  | "profitPct";
type Product = SealedProduct;
type History = PriceHistory;
const sealedModel: LeaderboardModeModel<View, SortKey> = {
  views: [
    { key: "medium", label: "Medium", icon: "▤" },
    { key: "text", label: "Text", icon: "☷" },
    { key: "full", label: "Full", icon: "▥" },
  ],
  sorts: [
    { label: "Product", key: "name" },
    { label: "Set", key: "set" },
    { label: "MSRP", key: "msrp" },
    { label: "Market", key: "market" },
    { label: "Profit", key: "profit" },
    { label: "Profit %", key: "profitPct" },
  ],
  viewLabel: "Sealed product view",
  paginationLabel: "Sealed product pages",
};
const sealedSignalSort = { label: "Signal", key: "signal" as SortKey };
const ascendingSealedSorts = new Set<SortKey>(["name", "set"]);
const usd = (value: number | null) => formatUsd(value, "N/A");
const pct = (value: number | null) => formatPercent(value, "N/A");
const productKey = (product: Product) => product.productId;

export default function SealedView({
  signalView = "leaderboard",
  strictness = "balanced",
  scalperEnabled = false,
  initialState,
  onQueryChange,
}: {
  signalView?: SignalSide;
  strictness?: SignalStrictness;
  scalperEnabled?: boolean;
  initialState: SealedQueryState;
  onQueryChange: (state: SealedQueryState) => void;
}) {
  const [game, setGame] = useState<Game>(() =>
      initialState.market === "scalping" && !scalperEnabled
        ? "pokemon"
        : initialState.market,
    ),
    [query, setQuery] = useState(initialState.query),
    [selectedSets, setSelectedSets] = useState<string[]>(initialState.sets),
    [selectedTypes, setSelectedTypes] = useState<string[]>(
      initialState.productTypes,
    ),
    [marketMin, setMarketMin] = useState(initialState.marketMin),
    [marketMax, setMarketMax] = useState(initialState.marketMax),
    [msrpMin, setMsrpMin] = useState(initialState.msrpMin),
    [msrpMax, setMsrpMax] = useState(initialState.msrpMax),
    [profitMin, setProfitMin] = useState(initialState.profitMin),
    [profitMax, setProfitMax] = useState(initialState.profitMax),
    [profitPctMin, setProfitPctMin] = useState(initialState.profitPctMin),
    [profitPctMax, setProfitPctMax] = useState(initialState.profitPctMax),
    [setEv, setSetEv] = useState<Record<string, { packEv: number | null; evRatio: number | null }>>({}),
    [sort, setSort] = useState<SortKey>(initialState.sort),
    [direction, setDirection] = useState<Direction>(initialState.direction),
    [perPage, setPerPage] = useState(initialState.perPage),
    [page, setPage] = useState(initialState.page),
    [view, setView] = useState<View>(initialState.view);
  const [basis, setBasis] = useState<Basis>(initialState.basis),
    [keepPct, setKeepPct] = useState(initialState.keepPct),
    [taxOn, setTaxOn] = useState(initialState.taxOn),
    [taxRate, setTaxRate] = useState(initialState.taxRate),
    [shipping, setShipping] = useState(initialState.shipping),
    [profitableOnly, setProfitableOnly] = useState(initialState.profitableOnly),
    previousSignal = useRef(signalView);
  const isScalping = scalperEnabled,
    isScalpingMarket = game === "scalping",
    scenarioProfitableOnly = isScalping && profitableOnly;
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
    sources: [
      isScalpingMarket
        ? "/data/sealed-scalping.json"
        : `/data/sealed-${game}.json`,
    ],
    parse: parseSealedProducts,
    keyOf: productKey,
  });
  const {
    history,
    status: historyStatus,
    request: requestHistory,
  } = usePriceHistoryBatch();
  const persistedSignals = usePersistedSignals({
    kind: "sealed",
    market: game,
    side: basis === "market" ? signalView : "leaderboard",
    strictness,
  });
  useEffect(() => {
    if (previousSignal.current === signalView) return;
    previousSignal.current = signalView;
    setSort(signalView === "leaderboard" ? "market" : "signal");
    setDirection("desc");
    setPage(1);
  }, [signalView]);
  // Per-set chase EV annotates hover cards on database-backed deployments (audit Phase C);
  // a 503 (feed-only, dev) simply leaves the metric out.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/set-ev", { signal: controller.signal })
      .then(async (response) => (response.ok ? await response.json() as { rows: { set: string; packEv: number | null; evRatio: number | null }[] } : null))
      .then((body) => { if (body?.rows && !controller.signal.aborted) setSetEv(Object.fromEntries(body.rows.map((row) => [row.set, { packEv: row.packEv, evRatio: row.evRatio }]))); })
      .catch(() => { /* Feed-only deployment; hover cards omit EV. */ });
    return () => controller.abort();
  }, []);
  useEffect(
    () =>
      onQueryChange({
        mode: "sealed",
        market: game,
        productTypes: selectedTypes,
        view,
        sort,
        direction,
        page,
        perPage,
        query,
        sets: selectedSets,
        marketMin,
        marketMax,
        msrpMin,
        msrpMax,
        profitMin,
        profitMax,
        profitPctMin,
        profitPctMax,
        ...scenario,
        profitableOnly: scenarioProfitableOnly,
        signal: signalView,
        strictness,
      }),
    [
      game,
      selectedTypes,
      view,
      sort,
      direction,
      page,
      perPage,
      query,
      selectedSets,
      marketMin,
      marketMax,
      msrpMin,
      msrpMax,
      profitMin,
      profitMax,
      profitPctMin,
      profitPctMax,
      basis,
      keepPct,
      taxOn,
      taxRate,
      shipping,
      profitableOnly,
      signalView,
      strictness,
      isScalping,
    ],
  );
  const signalFor = (product: Product) =>
    signalView === "leaderboard"
      ? null
      : persistedSignals.ready
        ? (persistedSignals.derived[product.productId]?.signal ?? null)
        : marketSignal(
            history[product.productId]?.points ?? [],
            signalView,
            strictness,
            calculate(product).value,
          );
  const derived = useMemo(
    () => buildCatalogDerived(products, history, persistedSignals, signalFor),
    [
      products,
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
        products,
        {
          market: game,
          productTypes: selectedTypes,
          query,
          sets: selectedSets,
          marketMin,
          marketMax,
          msrpMin,
          msrpMax,
          profitMin,
          profitMax,
          profitPctMin,
          profitPctMax,
          profitableOnly: scenarioProfitableOnly,
          ...scenario,
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
      products,
      game,
      selectedTypes,
      query,
      selectedSets,
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
    setDirection((current) =>
      nextSortDirection(sort, current, next, ascendingSealedSorts),
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
    const movement = (label: string, value: number | null | undefined) => ({
      label,
      value: value === undefined ? "…" : pct(value ?? null),
      tone: movementTone(value),
    });
    return (
      <HistoryPanel
        title={h?.condition ?? "Sealed market history"}
        subtitle={h?.variant ?? product.category}
        points={h?.points ?? []}
        label="sealed market"
        metrics={[
          { label: "MSRP", value: usd(product.msrp) },
          { label: basis, value: usd(result.value) },
          { label: "30D low", value: usd(h?.low30 ?? null) },
          { label: "30D high", value: usd(h?.high30 ?? null) },
          { label: "Hist low", value: usd(h?.historyLow ?? null) },
          ...(setEv[product.set]?.packEv != null
            ? [{
                label: "Set pack EV",
                value: `${usd(setEv[product.set].packEv)}${setEv[product.set].evRatio != null ? ` · ${(setEv[product.set].evRatio as number).toFixed(2)}×` : ""}`,
                tone: setEv[product.set].evRatio != null ? ((setEv[product.set].evRatio as number) >= 1 ? "up" as const : "down" as const) : undefined,
              }]
            : []),
          {
            label: "Profit",
            value: usd(result.profit),
            tone: movementTone(result.profit),
          },
          {
            label: "Profit %",
            value: pct(result.profitPct),
            tone: movementTone(result.profitPct),
          },
          movement("7 day", h?.change7),
          movement("30 day", h?.change30),
          movement("90 day", h?.change90),
        ]}
        large={large}
      />
    );
  };
  const activeSorts = signalAwareSorts(
    sealedModel.sorts,
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
    ...selectedSets.map((set) => ({
      key: `set:${set}`,
      label: set,
      clear: () => setSelectedSets(selectedSets.filter((value) => value !== set)),
    })),
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
    profitMin || profitMax
      ? {
          key: "profit",
          label: `Profit: ${profitMin || "Any"}–${profitMax || "Any"}`,
          clear: () => {
            setProfitMin("");
            setProfitMax("");
          },
        }
      : null,
    profitPctMin || profitPctMax
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
      className="sealed-market"
      id="sealed-market"
      historyStatus={historyStatus}
      marketStrip={
        <section className="market-strip sealed-market-strip">
          <label>
            <span>Market</span>
            <select
              aria-label="Sealed market"
              value={game}
              onChange={(event) => {
                setGame(event.target.value as Game);
                setSelectedSets([]);
                setSelectedTypes([]);
                setPage(1);
              }}
            >
              <option value="pokemon">Pokémon</option>
              <option value="onepiece">One Piece</option>
              <option value="riftbound">Riftbound</option>
              {scalperEnabled && <option value="scalping">Scalping</option>}
            </select>
          </label>
          <MultiSelectField
            label="Product type"
            options={productTypes.map((type) => ({ key: type, label: type }))}
            selected={selectedTypes}
            onChange={(values) => {
              setSelectedTypes(values);
              setPage(1);
            }}
            allLabel="All product types"
            searchable={false}
          />
          <div>
            <span>Products available</span>
            <strong>{metrics.count.toLocaleString()}</strong>
            <small>{usd(metrics.market)} combined market</small>
          </div>
          <label>
            <span>Products per page</span>
            <select
              aria-label="Sealed products per page"
              value={perPage}
              onChange={(event) => {
                setPerPage(Number(event.target.value));
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
          className="sealed-summary"
          kicker="Sealed product intelligence"
          kickerClassName="kicker"
          title={`${formatGameName(game)} ${signalView === "leaderboard" ? "Sealed" : signalView === "buy" ? "Hot Buys" : "Hot Sells"}`}
          description={
            signalView === "leaderboard"
              ? "Verified MSRP compared with current TCGplayer pricing."
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
            <div className="price-basis" aria-label="Price basis">
              <i aria-hidden="true" />
              <button
                className={basis === "market" ? "active" : ""}
                onClick={() => setBasis("market")}
              >
                Market
              </button>
              <button
                className={basis === "median" ? "active" : ""}
                onClick={() => setBasis("median")}
              >
                Median
              </button>
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
          <label className="sealed-toolbar-search">
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search product, set, or type"
            />
          </label>
          <SealedFilters
            sets={sets}
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
            onReset={() => {
              setSelectedSets([]);
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
            sort={sort}
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
                sort={sort}
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
            <span className="signal-card-wrap" key={product.productId}>
              {signal && <SignalBadge signal={signal} />}
              <a className="detail-link-card" href={`/sealed/${product.productId}${isScalpingMarket?"?market=scalping":""}`} aria-label={`View ${product.name} details`}>
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
              </a>
            </span>
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
                favorite={sealedFavorite(product)}
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
              </span>
            )}
            <span className="sealed-category">{product.set}</span>
            <span data-label="MSRP">
              <b>{usd(product.msrp)}</b>
              <small>
                {product.msrp == null
                  ? "MSRP unavailable"
                  : scenario.taxOn
                    ? `Cost ${usd(result.cost)}`
                    : product.msrpSource}
              </small>
            </span>
            <span data-label={basis === "market" ? "Market" : "Median"}>
              <b>{usd(result.value)}</b>
              <small>
                {priced
                  ? scenario.keepPct < 100
                    ? `Proceeds ${usd(result.proceeds)}`
                    : "TCGplayer value"
                  : "No TCGplayer data"}
              </small>
            </span>
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
          </MarketRow>
        );
      })}
      pagination={{
        page,
        pages,
        onChange: setPage,
        label: sealedModel.paginationLabel,
      }}
      footer={
        <p className="sealed-note">
          {isScalping
            ? "Profit uses the selected price basis and optional sale assumptions above. Fees, tax, and shipping are scenario inputs, not predictions."
            : "Profit compares the selected TCGplayer price basis directly with published US MSRP. Missing prices remain N/A."}
        </p>
      }
    />
  );
}
