ALTER TABLE artists ADD COLUMN month text NOT NULL DEFAULT to_char(current_date, 'YYYY-MM');
CREATE INDEX idx_artists_month ON artists(month);
ALTER TABLE artists DROP CONSTRAINT IF EXISTS artists_genre_lane_check;
