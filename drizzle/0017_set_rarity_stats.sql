CREATE TABLE `set_rarity_stats` (
	`game` text NOT NULL,
	`set_name` text NOT NULL,
	`tier` text NOT NULL,
	`rarity` text NOT NULL,
	`section` text,
	`card_count` integer NOT NULL,
	`priced_count` integer NOT NULL,
	`sum_cents` integer NOT NULL,
	`top_cents` integer,
	`top_product_id` integer,
	`updated_at` text NOT NULL,
	`ingestion_run_id` text,
	PRIMARY KEY(`game`, `set_name`, `tier`),
	FOREIGN KEY (`ingestion_run_id`) REFERENCES `ingestion_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_set_rarity_stats_updated` ON `set_rarity_stats` (`updated_at`);
