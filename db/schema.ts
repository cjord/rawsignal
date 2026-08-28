import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const ingestionRuns = sqliteTable("ingestion_runs", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  status: text("status", { enum: ["running", "succeeded", "failed"] }).notNull(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  recordsSeen: integer("records_seen").notNull().default(0),
  recordsWritten: integer("records_written").notNull().default(0),
  recordsRejected: integer("records_rejected").notNull().default(0),
  duplicateDecisions: integer("duplicate_decisions").notNull().default(0),
  schemaVersion: integer("schema_version").notNull().default(1),
  sourceUpdatedAt: text("source_updated_at"),
  statsJson: text("stats_json"),
  errorMessage: text("error_message"),
}, (table) => [
  check("ingestion_runs_status_check", sql`${table.status} in ('running','succeeded','failed')`),
  index("idx_ingestion_runs_source_started").on(table.source, table.startedAt),
]);

export const catalogProducts = sqliteTable("catalog_products", {
  productId: integer("product_id").primaryKey(),
  kind: text("kind", { enum: ["single", "sealed"] }).notNull(),
  game: text("game", { enum: ["pokemon", "riftbound", "onepiece"] }).notNull(),
  section: text("section"),
  name: text("name").notNull(),
  setName: text("set_name").notNull(),
  releaseYear: integer("release_year"),
  rarity: text("rarity"),
  cardNumber: text("card_number"),
  printing: text("printing"),
  productType: text("product_type"),
  imageUrl: text("image_url"),
  sourceUrl: text("source_url"),
  sourceUpdatedAt: text("source_updated_at").notNull(),
  ingestionRunId: text("ingestion_run_id").references(() => ingestionRuns.id),
}, (table) => [
  check("catalog_products_kind_check", sql`${table.kind} in ('single','sealed')`),
  check("catalog_products_game_check", sql`${table.game} in ('pokemon','riftbound','onepiece')`),
  check("catalog_products_onepiece_sealed_check", sql`${table.game} != 'onepiece' or ${table.kind} = 'sealed'`),
  index("idx_catalog_kind_game_section").on(table.kind, table.game, table.section),
  index("idx_catalog_kind_game_set").on(table.kind, table.game, table.setName),
  index("idx_catalog_kind_game_type").on(table.kind, table.game, table.productType),
]);

export const currentPrices = sqliteTable("current_prices", {
  productId: integer("product_id").primaryKey().references(() => catalogProducts.productId, { onDelete: "cascade" }),
  marketCents: integer("market_cents"),
  listingLowCents: integer("listing_low_cents"),
  medianCents: integer("median_cents"),
  listingHighCents: integer("listing_high_cents"),
  currency: text("currency").notNull().default("USD"),
  observedAt: text("observed_at").notNull(),
  source: text("source").notNull(),
  ingestionRunId: text("ingestion_run_id").references(() => ingestionRuns.id),
}, (table) => [
  check("current_prices_currency_check", sql`${table.currency} = 'USD'`),
  index("idx_current_prices_market").on(table.marketCents),
  index("idx_current_prices_observed").on(table.observedAt),
]);

export const sealedDetails = sqliteTable("sealed_details", {
  productId: integer("product_id").primaryKey().references(() => catalogProducts.productId, { onDelete: "cascade" }),
  msrpCents: integer("msrp_cents"),
  msrpSource: text("msrp_source"),
});

export const productDetails = sqliteTable("product_details", {
  productId: integer("product_id").primaryKey().references(() => catalogProducts.productId, { onDelete: "cascade" }),
  categoryId: integer("category_id"),
  groupId: integer("group_id"),
  setAbbreviation: text("set_abbreviation"),
  publishedOn: text("published_on"),
  modifiedOn: text("modified_on"),
  imageCount: integer("image_count"),
  isPresale: integer("is_presale", { mode: "boolean" }),
  presaleNote: text("presale_note"),
  metadataJson: text("metadata_json").notNull().default("[]"),
  priceVariantsJson: text("price_variants_json").notNull().default("[]"),
  sourceUpdatedAt: text("source_updated_at"),
}, (table) => [
  index("idx_product_details_group").on(table.categoryId, table.groupId),
]);

export const priceObservations = sqliteTable("price_observations", {
  productId: integer("product_id").notNull().references(() => catalogProducts.productId, { onDelete: "cascade" }),
  variant: text("variant").notNull(),
  condition: text("condition").notNull(),
  observedDate: text("observed_date").notNull(),
  marketCents: integer("market_cents").notNull(),
  source: text("source").notNull(),
  fetchedAt: text("fetched_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.productId, table.variant, table.condition, table.observedDate] }),
  check("price_observations_positive_check", sql`${table.marketCents} > 0`),
  index("idx_price_observations_product_date").on(table.productId, table.observedDate),
]);

export const marketMetrics = sqliteTable("market_metrics", {
  productId: integer("product_id").notNull().references(() => catalogProducts.productId, { onDelete: "cascade" }),
  variant: text("variant").notNull(),
  condition: text("condition").notNull(),
  asOfDate: text("as_of_date").notNull(),
  coverage: text("coverage", { enum: ["exact", "fallback", "none"] }).notNull(),
  change7Bps: integer("change_7_bps"),
  change30Bps: integer("change_30_bps"),
  change90Bps: integer("change_90_bps"),
  low30Cents: integer("low_30_cents"),
  high30Cents: integer("high_30_cents"),
  historicLowCents: integer("historic_low_cents"),
  historicHighCents: integer("historic_high_cents"),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.productId, table.variant, table.condition] }),
  check("market_metrics_coverage_check", sql`${table.coverage} in ('exact','fallback','none')`),
  index("idx_market_metrics_as_of").on(table.asOfDate),
]);

export const marketSignals = sqliteTable("market_signals", {
  productId: integer("product_id").notNull().references(() => catalogProducts.productId, { onDelete: "cascade" }),
  side: text("side", { enum: ["buy", "sell"] }).notNull(),
  strictness: text("strictness", { enum: ["conservative", "balanced", "aggressive"] }).notNull(),
  score: integer("score").notNull(),
  confidence: text("confidence", { enum: ["high", "medium", "low"] }).notNull(),
  reason: text("reason").notNull(),
  detail: text("detail").notNull(),
  distanceBps: integer("distance_bps").notNull(),
  cutoffBps: integer("cutoff_bps").notNull(),
  asOfDate: text("as_of_date").notNull(),
  observationDate: text("observation_date").notNull().default(""),
  coverage: text("coverage", { enum: ["exact", "fallback", "none"] }).notNull().default("none"),
}, (table) => [
  primaryKey({ columns: [table.productId, table.side, table.strictness] }),
  check("market_signals_side_check", sql`${table.side} in ('buy','sell')`),
  check("market_signals_strictness_check", sql`${table.strictness} in ('conservative','balanced','aggressive')`),
  check("market_signals_confidence_check", sql`${table.confidence} in ('high','medium','low')`),
  check("market_signals_coverage_check", sql`${table.coverage} in ('exact','fallback','none')`),
  check("market_signals_score_check", sql`${table.score} between 0 and 100`),
  index("idx_market_signals_rank").on(table.side, table.strictness, table.score),
]);

export const gradedPrices = sqliteTable("graded_prices", {
  productId: integer("product_id").primaryKey().references(() => catalogProducts.productId, { onDelete: "cascade" }),
  gradesJson: text("grades_json").notNull().default("{}"),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_graded_prices_updated").on(table.updatedAt),
]);

export const marketDailyMetrics = sqliteTable("market_daily_metrics", {
  series: text("series").notNull(),
  observedDate: text("observed_date").notNull(),
  valueCents: integer("value_cents").notNull(),
  members: integer("members").notNull(),
}, (table) => [
  primaryKey({ columns: [table.series, table.observedDate] }),
]);

export const refreshState = sqliteTable("refresh_state", {
  key: text("key").primaryKey(),
  lastSuccessAt: text("last_success_at"),
  ingestionRunId: text("ingestion_run_id").references(() => ingestionRuns.id),
  cursor: text("cursor"),
});
