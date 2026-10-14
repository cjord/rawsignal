-- Snapshot points and their metrics land in the existing atomic metrics upsert.
-- Keep one previous version for readers holding an older catalog response.
ALTER TABLE market_metrics ADD COLUMN history_snapshot_id TEXT;
ALTER TABLE market_metrics ADD COLUMN history_snapshot_json TEXT;
ALTER TABLE market_metrics ADD COLUMN previous_history_snapshot_id TEXT;
ALTER TABLE market_metrics ADD COLUMN previous_history_snapshot_json TEXT;
