ALTER TABLE transcripts ADD COLUMN segments JSONB;

CREATE TABLE meeting_highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  recording_id UUID REFERENCES recordings(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL, -- 'note' | 'key_moment'
  start_seconds NUMERIC(10, 2) NOT NULL,
  end_seconds NUMERIC(10, 2), -- only set for key_moment
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
