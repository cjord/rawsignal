-- One observation series per sealed product (docs/todo.md R3). The daily walk and the TCGCSV
-- archive key sealed history as Sealed/Unopened; the TCGplayer client reported the same series
-- as Normal/Unopened, so most sealed products carried two series and two metrics rows, and the
-- boards read the shallow one. Fold the TCGplayer rows into the canonical key (a point already
-- stored for that date wins), drop the duplicate metrics rows, and let the next daily pass
-- recompute metrics and signals from the merged series.
INSERT INTO price_observations (product_id, variant, condition, observed_date, market_cents, source, fetched_at)
SELECT o.product_id, 'Sealed', 'Unopened', o.observed_date, o.market_cents, o.source, o.fetched_at
FROM price_observations o JOIN catalog_products p ON p.product_id = o.product_id
WHERE p.kind = 'sealed' AND o.condition = 'Unopened' AND o.variant <> 'Sealed'
ON CONFLICT(product_id, variant, condition, observed_date) DO NOTHING;
--> statement-breakpoint
DELETE FROM price_observations
WHERE condition = 'Unopened' AND variant <> 'Sealed'
  AND product_id IN (SELECT product_id FROM catalog_products WHERE kind = 'sealed');
--> statement-breakpoint
DELETE FROM market_metrics
WHERE condition = 'Unopened' AND variant <> 'Sealed'
  AND product_id IN (SELECT product_id FROM catalog_products WHERE kind = 'sealed');
