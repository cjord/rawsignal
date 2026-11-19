-- Additive Pokémon community projection; no existing profiles or opt-ins change.
CREATE TABLE pokemon_auction_public_profiles (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL UNIQUE REFERENCES auth_user(id) ON DELETE CASCADE,
 display_name TEXT NOT NULL DEFAULT 'Player',
 showcase_public INTEGER NOT NULL DEFAULT 0 CHECK(showcase_public IN (0,1)),
 leaderboard_public INTEGER NOT NULL DEFAULT 0 CHECK(leaderboard_public IN (0,1)),
 profit_cents INTEGER NOT NULL DEFAULT 0, settled INTEGER NOT NULL DEFAULT 0,
 won INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
);
CREATE INDEX pokemon_auction_profiles_ranking ON pokemon_auction_public_profiles(leaderboard_public,profit_cents DESC,settled DESC,id);
CREATE INDEX pokemon_auction_profiles_showcases ON pokemon_auction_public_profiles(showcase_public,updated_at DESC,id);
-- Projection stays atomic with cloud saves, including reset and deletion. These are
-- browser-reported statistics, not server-verified competitive results.
CREATE TRIGGER pokemon_auction_profile_save_insert AFTER INSERT ON account_documents
 WHEN NEW.document_key='raw-signal-pokemon-auction-v1' BEGIN
 UPDATE pokemon_auction_public_profiles SET profit_cents=COALESCE(json_extract(NEW.value_json,'$.statistics.profit'),0),
 settled=COALESCE(json_extract(NEW.value_json,'$.statistics.settled'),0),won=COALESCE(json_extract(NEW.value_json,'$.statistics.won'),0),updated_at=NEW.updated_at WHERE user_id=NEW.user_id;
END;
CREATE TRIGGER pokemon_auction_profile_save_update AFTER UPDATE ON account_documents
 WHEN NEW.document_key='raw-signal-pokemon-auction-v1' BEGIN
 UPDATE pokemon_auction_public_profiles SET profit_cents=COALESCE(json_extract(NEW.value_json,'$.statistics.profit'),0),
 settled=COALESCE(json_extract(NEW.value_json,'$.statistics.settled'),0),won=COALESCE(json_extract(NEW.value_json,'$.statistics.won'),0),updated_at=NEW.updated_at WHERE user_id=NEW.user_id;
END;
CREATE TRIGGER pokemon_auction_profile_save_delete AFTER DELETE ON account_documents
 WHEN OLD.document_key='raw-signal-pokemon-auction-v1' BEGIN
 UPDATE pokemon_auction_public_profiles SET profit_cents=0,settled=0,won=0,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id=OLD.user_id;
END;

-- Public presentation only. Private documents, holdings and cash are never altered.
CREATE TABLE pokemon_auction_profile_moderation (
 profile_id TEXT PRIMARY KEY REFERENCES pokemon_auction_public_profiles(id) ON DELETE CASCADE,
 hidden INTEGER NOT NULL CHECK(hidden IN (0,1)),
 revision INTEGER NOT NULL CHECK(revision > 0),
 reason_code TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 last_request_id TEXT NOT NULL
);
