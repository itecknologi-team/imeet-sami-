import { pool } from "../../config/db";
import { assertPublicHttpsUrl } from "../../shared/ssrf";

interface MeetingInfoRow {
  title: string;
  host_id: string;
  started_at: string | null;
  ended_at: string | null;
}

interface AttendeeRow {
  name: string;
  email: string;
}

export async function syncMeetingEnd(meetingId: string, meetingCode: string, totalCost: number): Promise<void> {
  try {
    const { rows: meetingRows } = await pool.query<MeetingInfoRow>(
      "SELECT title, host_id, started_at, ended_at FROM meetings WHERE id = $1",
      [meetingId],
    );
    const meeting = meetingRows[0];
    if (!meeting) return;

    const { rows: hostRows } = await pool.query<{ crm_webhook_url: string | null }>(
      "SELECT crm_webhook_url FROM users WHERE id = $1",
      [meeting.host_id],
    );
    const webhookUrl = hostRows[0]?.crm_webhook_url;
    if (!webhookUrl) return;

    const { rows: attendees } = await pool.query<AttendeeRow>(
      `SELECT u.name, u.email
       FROM meeting_participants mp JOIN users u ON u.id = mp.user_id
       WHERE mp.meeting_id = $1`,
      [meetingId],
    );

    const durationMinutes =
      meeting.started_at && meeting.ended_at
        ? Math.round((new Date(meeting.ended_at).getTime() - new Date(meeting.started_at).getTime()) / 60_000)
        : null;

    // Re-validated here, not just when the user saved it: DNS for a hostname
    // that resolved publicly at save time can be re-pointed at an internal
    // address afterwards (DNS rebinding).
    const safeUrl = await assertPublicHttpsUrl(webhookUrl);

    await fetch(safeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // A 3xx to http://169.254.169.254/... would otherwise be followed
      // automatically, defeating the check above.
      redirect: "manual",
      // Without a deadline a hostile/hanging endpoint pins this request (and
      // its socket) open indefinitely.
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        meetingCode,
        title: meeting.title,
        startedAt: meeting.started_at,
        endedAt: meeting.ended_at,
        durationMinutes,
        totalCost,
        attendees,
      }),
    });
  } catch (err) {
    console.error(`CRM sync failed for meeting ${meetingCode}:`, err);
  }
}
