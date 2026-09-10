ALTER TABLE `ebay_listings` ADD `accepted_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `ebay_listings` ADD `expires_at` text;
--> statement-breakpoint
UPDATE `ebay_listings` SET `expires_at` = `fetched_at` WHERE `expires_at` IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_ebay_listings_expires` ON `ebay_listings` (`expires_at`);
--> statement-breakpoint
CREATE TABLE `ebay_api_usage` (
	`usage_date` text PRIMARY KEY NOT NULL,
	`calls` integer DEFAULT 0 NOT NULL,
	`on_demand_calls` integer DEFAULT 0 NOT NULL,
	`background_calls` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ebay_fetch_leases` (
	`product_id` integer PRIMARY KEY NOT NULL,
	`holder` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `catalog_products`(`product_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ebay_fetch_leases_expires` ON `ebay_fetch_leases` (`expires_at`);
