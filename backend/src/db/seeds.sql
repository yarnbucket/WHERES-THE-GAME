-- Seed data for Where's the Game

-- Insert sample events
INSERT INTO events (name, league, start_time)
VALUES
    ('Steelers vs Ravens', 'NFL', NOW() + INTERVAL '1 day'),
    ('Penguins vs Flyers', 'NHL', NOW() + INTERVAL '2 days'),
    ('Pirates vs Cubs', 'MLB', NOW() + INTERVAL '3 days');

-- More seed data will be added later:
-- channels
-- streaming platforms
-- blackout rules
