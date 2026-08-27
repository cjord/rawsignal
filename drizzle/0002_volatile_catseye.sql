CREATE TABLE `product_details` (
	`product_id` integer PRIMARY KEY NOT NULL,
	`category_id` integer,
	`group_id` integer,
	`set_abbreviation` text,
	`published_on` text,
	`modified_on` text,
	`image_count` integer,
	`is_presale` integer,
	`presale_note` text,
	`metadata_json` text DEFAULT '[]' NOT NULL,
	`price_variants_json` text DEFAULT '[]' NOT NULL,
	`source_updated_at` text,
	FOREIGN KEY (`product_id`) REFERENCES `catalog_products`(`product_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_product_details_group` ON `product_details` (`category_id`,`group_id`);