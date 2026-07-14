CREATE TABLE recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  egress_id VARCHAR(255) UNIQUE,
  status VARCHAR(20) DEFAULT 'recording',
  file_url TEXT,
  duration INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
