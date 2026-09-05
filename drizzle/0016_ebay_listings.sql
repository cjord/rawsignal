CREATE TABLE `ebay_listings` (
	`product_id` integer PRIMARY KEY NOT NULL,
	`query` text NOT NULL,
	`category_id` integer,
	`listing_count` integer NOT NULL,
	`lowest_cents` integer,
	`median_cents` integer,
	`samples_json` text DEFAULT '[]' NOT NULL,
	`fetched_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `catalog_products`(`product_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ebay_listings_updated` ON `ebay_listings` (`updated_at`);
