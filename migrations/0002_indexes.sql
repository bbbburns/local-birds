-- Speed up the two most frequent query patterns as data grows over time.
-- sightings is queried by obs_date on every page load.
-- species is queried by fetched_at to find stale thumbnails each poll.
CREATE INDEX IF NOT EXISTS idx_sightings_obs_date ON sightings(obs_date);
CREATE INDEX IF NOT EXISTS idx_species_fetched_at ON species(fetched_at);
