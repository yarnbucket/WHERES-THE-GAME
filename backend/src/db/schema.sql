-- Database schema for Where's the Game

-- Example table: events
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    league TEXT,
    start_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- More tables will be added later:
-- channels
-- streaming
-- blackout_rules
-- resolver_cache
