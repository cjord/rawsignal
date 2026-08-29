-- Decision D3: the curated Riftbound/One Piece category vocabulary is retired in favor
-- of the canonical sealed product-type buckets (core/catalog-query.ts sealedProductTypes).
-- The producers (core/sealed-product-utils.ts, the curated feeds) now emit canonical
-- strings; this migrates the rows written under the old vocabulary. Matching on
-- product_type alone (kind-scoped) covers every game that used the old labels.
-- ORDER MATTERS: apply AFTER deploying the Worker that emits canonical strings
-- (docs/cloudflare-cutover.md §3) — an old-Worker ingestion after this migration
-- would re-write old labels that wrangler will never migrate again.
UPDATE catalog_products SET product_type = 'Booster Packs' WHERE kind = 'sealed' AND product_type = 'Boosters';
--> statement-breakpoint
UPDATE catalog_products SET product_type = 'Booster Boxes' WHERE kind = 'sealed' AND product_type = 'Booster boxes';
--> statement-breakpoint
UPDATE catalog_products SET product_type = 'Starter / Theme Decks' WHERE kind = 'sealed' AND product_type = 'Decks';
--> statement-breakpoint
UPDATE catalog_products SET product_type = 'Boxes / Bundles' WHERE kind = 'sealed' AND product_type = 'Gift boxes';
--> statement-breakpoint
UPDATE catalog_products SET product_type = 'Collections' WHERE kind = 'sealed' AND product_type = 'Collector bundles';
