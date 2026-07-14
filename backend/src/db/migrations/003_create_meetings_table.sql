CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES users(id),
  title VARCHAR(255) DEFAULT 'Untitled Meeting',
  meeting_code VARCHAR(20) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'scheduled',
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
