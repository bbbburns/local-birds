-- Last successful eBird poll, kept separately from polled_at so a single
-- failed poll doesn't erase when data last arrived.
ALTER TABLE poll_status ADD COLUMN last_success_at TEXT;
UPDATE poll_status SET last_success_at = polled_at WHERE success = 1;

-- Single-row heartbeat for bird-sync (id = 1, like poll_status).
-- last_seen_at: last authenticated GET /admin/thumbnails/pending (start of each cycle)
-- last_push_at: last accepted POST /admin/thumbnails
CREATE TABLE IF NOT EXISTS sync_status (
    id INTEGER PRIMARY KEY,
    last_seen_at TEXT,
    last_push_at TEXT
);
