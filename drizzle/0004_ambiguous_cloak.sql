CREATE TABLE `market_daily_metrics` (
	`series` text NOT NULL,
	`observed_date` text NOT NULL,
	`value_cents` integer NOT NULL,
	`members` integer NOT NULL,
	PRIMARY KEY(`series`, `observed_date`)
);
