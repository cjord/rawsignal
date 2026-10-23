-- Account recovery keys are wrapped with a domain-separated AUTH_SECRET key.
CREATE TABLE account_recovery_keys (
 user_id TEXT PRIMARY KEY NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
 key_id TEXT NOT NULL UNIQUE, wrapped_key TEXT NOT NULL, iv TEXT NOT NULL, created_at TEXT NOT NULL
);

-- Opaque account IDs, never emails, tokens, saved documents or arbitrary request data.
CREATE TABLE admin_audit_events (
 id TEXT PRIMARY KEY NOT NULL, occurred_at TEXT NOT NULL,
 actor_id TEXT NOT NULL, actor_role TEXT NOT NULL CHECK(actor_role IN ('admin','member')),
 action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT,
 outcome TEXT NOT NULL CHECK(outcome IN ('allowed','denied')),
 request_id TEXT NOT NULL, reason_code TEXT NOT NULL, event_bucket TEXT UNIQUE
);
CREATE INDEX admin_audit_time ON admin_audit_events(occurred_at DESC,id DESC);
CREATE INDEX admin_audit_actor_time ON admin_audit_events(actor_id,occurred_at DESC);
CREATE INDEX admin_audit_action_time ON admin_audit_events(action,occurred_at DESC);
CREATE TRIGGER admin_audit_no_update BEFORE UPDATE ON admin_audit_events
 BEGIN SELECT RAISE(ABORT,'Audit records are append-only'); END;
CREATE TRIGGER admin_audit_keep_recent BEFORE DELETE ON admin_audit_events
 WHEN OLD.occurred_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-90 days')
 BEGIN SELECT RAISE(ABORT,'Audit retention has not elapsed'); END;
