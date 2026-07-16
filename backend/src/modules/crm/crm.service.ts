import { pool } from "../../config/db";

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

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
