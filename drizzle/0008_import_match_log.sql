-- Collectr-import fuzzy-match audit (2026-08-31). Every match reached by a fallback tier
-- (name / normalized / fuzzy — NOT an exact id-join) is logged here so the uncertain
-- matches can be reviewed manually once enough accumulate. seen_count bumps on repeat
-- imports. score is per-mille (0-1000); normalized-equal is 1000. No FK: this is a
-- standalone audit trail (collectr_product_id can be a Collectr synthetic id 10,000,000+).
CREATE TABLE IF NOT EXISTS import_match_log (
	collectr_product_id integer NOT NULL,
	matched_product_id integer NOT NULL,
	kind text NOT NULL,
	match_tier text NOT NULL,
	score integer,
	collectr_name text NOT NULL,
	collectr_set text NOT NULL DEFAULT '',
	matched_name text NOT NULL DEFAULT '',
	seen_count integer NOT NULL DEFAULT 1,
	first_seen text NOT NULL,
	last_seen text NOT NULL,
	PRIMARY KEY (collectr_product_id, matched_product_id),
	CONSTRAINT import_match_log_tier_check CHECK (match_tier in ('name','normalized','fuzzy'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_import_match_log_review ON import_match_log (match_tier, last_seen);
