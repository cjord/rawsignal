CREATE TABLE `catalog_products` (
	`product_id` integer PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`game` text NOT NULL,
	`section` text,
	`name` text NOT NULL,
	`set_name` text NOT NULL,
	`release_year` integer,
	`rarity` text,
	`card_number` text,
	`printing` text,
	`product_type` text,
	`image_url` text,
	`source_url` text,
	`source_updated_at` text NOT NULL,
	`ingestion_run_id` text,
	FOREIGN KEY (`ingestion_run_id`) REFERENCES `ingestion_runs`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "catalog_products_kind_check" CHECK("catalog_products"."kind" in ('single','sealed')),
	CONSTRAINT "catalog_products_game_check" CHECK("catalog_products"."game" in ('pokemon','riftbound','onepiece')),
	CONSTRAINT "catalog_products_onepiece_sealed_check" CHECK("catalog_products"."game" != 'onepiece' or "catalog_products"."kind" = 'sealed')
);
--> statement-breakpoint
CREATE INDEX `idx_catalog_kind_game_section` ON `catalog_products` (`kind`,`game`,`section`);--> statement-breakpoint
CREATE INDEX `idx_catalog_kind_game_set` ON `catalog_products` (`kind`,`game`,`set_name`);--> statement-breakpoint
CREATE INDEX `idx_catalog_kind_game_type` ON `catalog_products` (`kind`,`game`,`product_type`);--> statement-breakpoint
CREATE TABLE `current_prices` (
	`product_id` integer PRIMARY KEY NOT NULL,
	`market_cents` integer,
	`listing_low_cents` integer,
	`median_cents` integer,
	`listing_high_cents` integer,
	`currency` text DEFAULT 'USD' NOT NULL,
	`observed_at` text NOT NULL,
	`source` text NOT NULL,
	`ingestion_run_id` text,
	FOREIGN KEY (`product_id`) REFERENCES `catalog_products`(`product_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingestion_run_id`) REFERENCES `ingestion_runs`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "current_prices_currency_check" CHECK("current_prices"."currency" = 'USD')
);
--> statement-breakpoint
CREATE INDEX `idx_current_prices_market` ON `current_prices` (`market_cents`);--> statement-breakpoint
CREATE INDEX `idx_current_prices_observed` ON `current_prices` (`observed_at`);--> statement-breakpoint
CREATE TABLE `ingestion_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`records_seen` integer DEFAULT 0 NOT NULL,
	`records_written` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	CONSTRAINT "ingestion_runs_status_check" CHECK("ingestion_runs"."status" in ('running','succeeded','failed'))
);
--> statement-breakpoint
CREATE INDEX `idx_ingestion_runs_source_started` ON `ingestion_runs` (`source`,`started_at`);--> statement-breakpoint
CREATE TABLE `market_metrics` (
	`product_id` integer NOT NULL,
	`variant` text NOT NULL,
	`condition` text NOT NULL,
	`as_of_date` text NOT NULL,
	`coverage` text NOT NULL,
	`change_7_bps` integer,
	`change_30_bps` integer,
	`change_90_bps` integer,
	`low_30_cents` integer,
	`high_30_cents` integer,
	`historic_low_cents` integer,
	`historic_high_cents` integer,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`product_id`, `variant`, `condition`),
	FOREIGN KEY (`product_id`) REFERENCES `catalog_products`(`product_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "market_metrics_coverage_check" CHECK("market_metrics"."coverage" in ('exact','fallback','none'))
);
--> statement-breakpoint
CREATE INDEX `idx_market_metrics_as_of` ON `market_metrics` (`as_of_date`);--> statement-breakpoint
CREATE TABLE `market_signals` (
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
	PRIMARY KEY(`product_id`, `side`, `strictness`),
	FOREIGN KEY (`product_id`) REFERENCES `catalog_products`(`product_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "market_signals_side_check" CHECK("market_signals"."side" in ('buy','sell')),
	CONSTRAINT "market_signals_strictness_check" CHECK("market_signals"."strictness" in ('conservative','balanced','aggressive')),
	CONSTRAINT "market_signals_confidence_check" CHECK("market_signals"."confidence" in ('high','medium','low')),
	CONSTRAINT "market_signals_score_check" CHECK("market_signals"."score" between 0 and 100)
);
--> statement-breakpoint
CREATE INDEX `idx_market_signals_rank` ON `market_signals` (`side`,`strictness`,`score`);--> statement-breakpoint
CREATE TABLE `price_observations` (
	`product_id` integer NOT NULL,
	`variant` text NOT NULL,
	`condition` text NOT NULL,
	`observed_date` text NOT NULL,
	`market_cents` integer NOT NULL,
	`source` text NOT NULL,
	`fetched_at` text NOT NULL,
	PRIMARY KEY(`product_id`, `variant`, `condition`, `observed_date`),
	FOREIGN KEY (`product_id`) REFERENCES `catalog_products`(`product_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "price_observations_positive_check" CHECK("price_observations"."market_cents" > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_price_observations_product_date` ON `price_observations` (`product_id`,`observed_date`);--> statement-breakpoint
CREATE TABLE `refresh_state` (
	`key` text PRIMARY KEY NOT NULL,
	`last_success_at` text,
	`ingestion_run_id` text,
	`cursor` text,
	FOREIGN KEY (`ingestion_run_id`) REFERENCES `ingestion_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sealed_details` (
	`product_id` integer PRIMARY KEY NOT NULL,
	`msrp_cents` integer,
	`msrp_source` text,
	FOREIGN KEY (`product_id`) REFERENCES `catalog_products`(`product_id`) ON UPDATE no action ON DELETE cascade
);
