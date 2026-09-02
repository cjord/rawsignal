CREATE TABLE `cohort_stats` (
	`cohort_key` text PRIMARY KEY NOT NULL,
	`as_of_date` text NOT NULL,
	`members` integer NOT NULL,
	`median_change30_bps` integer,
	`breadth_pct` integer
);
