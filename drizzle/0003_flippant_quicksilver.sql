CREATE TABLE `graded_prices` (
	`product_id` integer PRIMARY KEY NOT NULL,
	`grades_json` text DEFAULT '{}' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `catalog_products`(`product_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_graded_prices_updated` ON `graded_prices` (`updated_at`);