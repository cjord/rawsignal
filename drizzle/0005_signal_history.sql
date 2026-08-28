CREATE TABLE `signal_history` (
	`observed_date` text NOT NULL,
	`side` text NOT NULL,
	`strictness` text NOT NULL,
	`product_id` integer NOT NULL,
	`score` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`rank` integer NOT NULL,
	PRIMARY KEY(`observed_date`, `side`, `product_id`),
	CONSTRAINT "signal_history_side_check" CHECK(`side` in ('buy','sell')),
	FOREIGN KEY (`product_id`) REFERENCES `catalog_products`(`product_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_signal_history_product` ON `signal_history` (`product_id`,`observed_date`);
