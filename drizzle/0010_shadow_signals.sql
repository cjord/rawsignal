CREATE TABLE `shadow_signals` (
	`product_id` integer NOT NULL,
	`side` text NOT NULL,
	`score` integer NOT NULL,
	`confidence` text NOT NULL,
	`reason` text NOT NULL,
	`detail` text NOT NULL,
	`distance_bps` integer NOT NULL,
	`cutoff_bps` integer NOT NULL,
	`as_of_date` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`product_id`, `side`),
	FOREIGN KEY (`product_id`) REFERENCES `catalog_products`(`product_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "shadow_signals_side_check" CHECK("side" in ('buy','sell'))
);
--> statement-breakpoint
CREATE TABLE `shadow_signal_history` (
	`observed_date` text NOT NULL,
	`side` text NOT NULL,
	`strictness` text NOT NULL,
	`product_id` integer NOT NULL,
	`score` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`rank` integer NOT NULL,
	PRIMARY KEY(`observed_date`, `side`, `product_id`),
	FOREIGN KEY (`product_id`) REFERENCES `catalog_products`(`product_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "shadow_signal_history_side_check" CHECK("side" in ('buy','sell'))
);
--> statement-breakpoint
CREATE INDEX `idx_shadow_signal_history_product` ON `shadow_signal_history` (`product_id`,`observed_date`);
