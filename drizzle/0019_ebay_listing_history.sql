CREATE TABLE `ebay_listing_observations` (
	`product_id` integer NOT NULL,
	`observed_date` text NOT NULL,
	`observed_at` text NOT NULL,
	`reference_market_cents` integer,
	`listing_count` integer NOT NULL,
	`reviewed_count` integer NOT NULL,
	`accepted_count` integer NOT NULL,
	`lowest_cents` integer,
	`median_cents` integer,
	`lowest_delivered_cents` integer,
	`median_delivered_cents` integer,
	`delivered_q1_cents` integer,
	`delivered_q3_cents` integer,
	`below_market_count` integer DEFAULT 0 NOT NULL,
	`near_market_count` integer DEFAULT 0 NOT NULL,
	`free_shipping_count` integer DEFAULT 0 NOT NULL,
	`best_offer_count` integer DEFAULT 0 NOT NULL,
	`new_listing_count` integer,
	`missing_listing_count` integer,
	`price_reduction_count` integer,
	PRIMARY KEY(`product_id`, `observed_date`),
	FOREIGN KEY (`product_id`) REFERENCES `catalog_products`(`product_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ebay_listing_observations_product_date` ON `ebay_listing_observations` (`product_id`,`observed_date`);
