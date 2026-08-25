ALTER TABLE `ingestion_runs` ADD `records_rejected` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ingestion_runs` ADD `duplicate_decisions` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ingestion_runs` ADD `schema_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `ingestion_runs` ADD `source_updated_at` text;--> statement-breakpoint
ALTER TABLE `ingestion_runs` ADD `stats_json` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_market_signals` (
	`product_id` integer NOT NULL,
	`side` text NOT NULL,
	`strictness` text NOT NULL,
	`score` integer NOT NULL,
	`confidence` text NOT NULL,
	`reason` text NOT NULL,
	`detail` text NOT NULL,
	`distance_bps` integer NOT NULL,
	`cutoff_bps` integer NOT NULL,
	`as_of_date` text NOT NULL,
	`observation_date` text DEFAULT '' NOT NULL,
	`coverage` text DEFAULT 'none' NOT NULL,
	PRIMARY KEY(`product_id`, `side`, `strictness`),
	FOREIGN KEY (`product_id`) REFERENCES `catalog_products`(`product_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "market_signals_side_check" CHECK("__new_market_signals"."side" in ('buy','sell')),
	CONSTRAINT "market_signals_strictness_check" CHECK("__new_market_signals"."strictness" in ('conservative','balanced','aggressive')),
	CONSTRAINT "market_signals_confidence_check" CHECK("__new_market_signals"."confidence" in ('high','medium','low')),
	CONSTRAINT "market_signals_coverage_check" CHECK("__new_market_signals"."coverage" in ('exact','fallback','none')),
	CONSTRAINT "market_signals_score_check" CHECK("__new_market_signals"."score" between 0 and 100)
);
--> statement-breakpoint
INSERT INTO `__new_market_signals`("product_id", "side", "strictness", "score", "confidence", "reason", "detail", "distance_bps", "cutoff_bps", "as_of_date", "observation_date", "coverage") SELECT "product_id", "side", "strictness", "score", "confidence", "reason", "detail", "distance_bps", "cutoff_bps", "as_of_date", "as_of_date", 'none' FROM `market_signals`;--> statement-breakpoint
DROP TABLE `market_signals`;--> statement-breakpoint
ALTER TABLE `__new_market_signals` RENAME TO `market_signals`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_market_signals_rank` ON `market_signals` (`side`,`strictness`,`score`);
