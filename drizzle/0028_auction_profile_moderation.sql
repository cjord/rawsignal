-- Public presentation only. Private documents, holdings and cash are never altered.
CREATE TABLE auction_profile_moderation (
 profile_id TEXT PRIMARY KEY REFERENCES auction_public_profiles(id) ON DELETE CASCADE,
 hidden INTEGER NOT NULL CHECK(hidden IN (0,1)),
 revision INTEGER NOT NULL CHECK(revision > 0),
 reason_code TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 last_request_id TEXT NOT NULL
);
