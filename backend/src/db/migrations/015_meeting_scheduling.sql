-- Lets a host create a meeting for a future date/time (with a planned
-- duration) instead of only ever starting instantly. Meetings already
-- default to status='scheduled' and only flip to 'active' on first join
-- (see meetings.service.ts joinMeeting), so no new status value is needed —
-- these columns are purely "when/how long is this meant to be" metadata,
-- used for the dashboard's upcoming-meetings list and calendar exports.
ALTER TABLE meetings ADD COLUMN scheduled_at TIMESTAMPTZ;
ALTER TABLE meetings ADD COLUMN duration_minutes INTEGER;
