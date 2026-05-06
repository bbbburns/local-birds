CREATE TABLE IF NOT EXISTS checklist_comments (
    sub_id TEXT PRIMARY KEY,
    obs_date TEXT NOT NULL,
    observer_name TEXT,
    comment_text TEXT NOT NULL,
    fetched_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_checklist_comments_obs_date
    ON checklist_comments(obs_date);
