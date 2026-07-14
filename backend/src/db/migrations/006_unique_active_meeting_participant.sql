CREATE UNIQUE INDEX meeting_participants_active_unique
  ON meeting_participants (meeting_id, user_id)
  WHERE left_at IS NULL;
