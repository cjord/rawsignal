-- Supplemental game-only singles reuse canonical normalization and the live walk.
-- They never enter market metrics/history/signals or the dashboard catalog.
CREATE TABLE game_catalog_stock (
 product_id INTEGER PRIMARY KEY NOT NULL,
 game TEXT NOT NULL CHECK(game IN ('pokemon','riftbound')),
 section TEXT NOT NULL, name TEXT NOT NULL, set_name TEXT NOT NULL,
 release_year INTEGER, rarity TEXT NOT NULL, card_number TEXT NOT NULL,
 printing TEXT NOT NULL, image_url TEXT NOT NULL, source_url TEXT NOT NULL,
 market_cents INTEGER NOT NULL CHECK(market_cents>0),
 observed_at TEXT NOT NULL,
 ingestion_run_id TEXT NOT NULL REFERENCES ingestion_runs(id) ON DELETE CASCADE
);
CREATE INDEX game_stock_market_run ON game_catalog_stock(game,ingestion_run_id);
