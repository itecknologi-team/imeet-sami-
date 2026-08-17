-- Allow instant meetings to be created and joined without an account (guest access).
ALTER TABLE meetings ADD COLUMN host_guest_id VARCHAR(64);
ALTER TABLE meetings ADD COLUMN host_guest_name VARCHAR(255);
ALTER TABLE meetings ADD COLUMN passcode VARCHAR(64);

ALTER TABLE meeting_participants ADD COLUMN guest_id VARCHAR(64);
ALTER TABLE meeting_participants ADD COLUMN guest_name VARCHAR(255);

CREATE UNIQUE INDEX meeting_participants_active_guest_unique
  ON meeting_participants (meeting_id, guest_id)
  WHERE left_at IS NULL AND guest_id IS NOT NULL;
