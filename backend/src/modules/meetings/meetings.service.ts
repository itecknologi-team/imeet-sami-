import { AccessToken } from "livekit-server-sdk";
import { pool } from "../../config/db";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors";
import * as assistantService from "../assistant/assistant.service";
import * as captionsService from "../captions/captions.service";
import * as whiteboardService from "../whiteboard/whiteboard.service";
import * as codeEditorService from "../codeEditor/codeEditor.service";

interface MeetingRow {
  id: string;
  host_id: string;
  title: string;
  meeting_code: string;
  status: string;
  hourly_rate: string;
  started_at: string | null;
}

const CODE_SEGMENT_LENGTHS = [3, 4, 3];
const DEFAULT_HOURLY_RATE = 50;

function randomSegment(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function generateMeetingCode(): string {
  return CODE_SEGMENT_LENGTHS.map(randomSegment).join("-");
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "23505";
}

async function findMeetingRowByCode(meetingCode: string): Promise<MeetingRow> {
  const { rows } = await pool.query<MeetingRow>(
    "SELECT id, host_id, title, meeting_code, status, hourly_rate, started_at FROM meetings WHERE meeting_code = $1",
    [meetingCode],
  );
  const row = rows[0];
  if (!row) {
    throw new AppError(404, "Meeting not found");
  }
  return row;
}

export async function createMeeting(hostId: string, title: string | undefined, hourlyRate: number | undefined) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const meetingCode = generateMeetingCode();
    try {
      const { rows } = await pool.query<MeetingRow>(
        `INSERT INTO meetings (host_id, title, meeting_code, hourly_rate)
         VALUES ($1, $2, $3, $4)
         RETURNING id, host_id, title, meeting_code, status, hourly_rate, started_at`,
        [hostId, title ?? "Untitled Meeting", meetingCode, hourlyRate ?? DEFAULT_HOURLY_RATE],
      );
      const meeting = rows[0];
      return {
        id: meeting.id,
        title: meeting.title,
        meetingCode: meeting.meeting_code,
        hostId: meeting.host_id,
        status: meeting.status,
        hourlyRate: parseFloat(meeting.hourly_rate),
      };
    } catch (err) {
      if (isUniqueViolation(err)) {
        continue;
      }
      throw err;
    }
  }
  throw new AppError(500, "Failed to generate a unique meeting code");
}

export async function getMeetingByCode(meetingCode: string) {
  const { rows } = await pool.query<{
    id: string;
    title: string;
    meeting_code: string;
    status: string;
    host_name: string;
    hourly_rate: string;
    started_at: string | null;
    total_cost: string | null;
  }>(
    `SELECT m.id, m.title, m.meeting_code, m.status, u.name AS host_name,
            m.hourly_rate, m.started_at, m.total_cost
     FROM meetings m JOIN users u ON u.id = m.host_id
     WHERE m.meeting_code = $1`,
    [meetingCode],
  );
  const row = rows[0];
  if (!row) {
    throw new AppError(404, "Meeting not found");
  }
  return {
    id: row.id,
    title: row.title,
    meetingCode: row.meeting_code,
    status: row.status,
    hostName: row.host_name,
    hourlyRate: parseFloat(row.hourly_rate),
    startedAt: row.started_at,
    totalCost: row.total_cost !== null ? parseFloat(row.total_cost) : null,
  };
}

export async function joinMeeting(meetingCode: string, userId: string) {
  const meeting = await findMeetingRowByCode(meetingCode);
  if (meeting.status === "ended") {
    throw new AppError(400, "Meeting has ended");
  }

  if (meeting.status === "scheduled") {
    const { rows: startedRows } = await pool.query<{ started_at: string }>(
      "UPDATE meetings SET status = 'active', started_at = NOW() WHERE id = $1 RETURNING started_at",
      [meeting.id],
    );
    meeting.status = "active";
    meeting.started_at = startedRows[0].started_at;
  }

  const role = meeting.host_id === userId ? "host" : "participant";
  // ON CONFLICT (backed by a partial unique index on active rows) makes this
  // safe against concurrent join calls for the same user, instead of a
  // separate check-then-insert that's racy under concurrent requests.
  await pool.query(
    `INSERT INTO meeting_participants (meeting_id, user_id, role, joined_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (meeting_id, user_id) WHERE left_at IS NULL DO NOTHING`,
    [meeting.id, userId, role],
  );

  const { rows: userRows } = await pool.query<{ name: string }>(
    "SELECT name FROM users WHERE id = $1",
    [userId],
  );
  const userName = userRows[0]?.name ?? "Guest";

  const accessToken = new AccessToken(env.livekitApiKey, env.livekitApiSecret, {
    identity: userId,
    name: userName,
  });
  accessToken.addGrant({
    room: meetingCode,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  const livekitToken = await accessToken.toJwt();

  return {
    meeting: {
      id: meeting.id,
      title: meeting.title,
      status: meeting.status,
      hourlyRate: parseFloat(meeting.hourly_rate),
      startedAt: meeting.started_at,
    },
    livekitToken,
    livekitUrl: env.livekitUrl,
  };
}

export async function leaveMeeting(meetingCode: string, userId: string) {
  const meeting = await findMeetingRowByCode(meetingCode);
  await pool.query(
    "UPDATE meeting_participants SET left_at = NOW() WHERE meeting_id = $1 AND user_id = $2 AND left_at IS NULL",
    [meeting.id, userId],
  );
  return { success: true };
}

export async function endMeeting(meetingCode: string, userId: string) {
  const meeting = await findMeetingRowByCode(meetingCode);
  if (meeting.host_id !== userId) {
    throw new AppError(403, "Only host can end the meeting");
  }

  await pool.query(
    "UPDATE meeting_participants SET left_at = NOW() WHERE meeting_id = $1 AND left_at IS NULL",
    [meeting.id],
  );

  const { rows: costRows } = await pool.query<{ total_hours: string | null }>(
    `SELECT SUM(EXTRACT(EPOCH FROM (left_at - joined_at)) / 3600) AS total_hours
     FROM meeting_participants
     WHERE meeting_id = $1`,
    [meeting.id],
  );
  const totalHours = parseFloat(costRows[0]?.total_hours ?? "0") || 0;
  const totalCost = Math.round(totalHours * parseFloat(meeting.hourly_rate) * 100) / 100;

  await pool.query(
    "UPDATE meetings SET status = 'ended', ended_at = NOW(), total_cost = $2 WHERE id = $1",
    [meeting.id, totalCost],
  );

  assistantService.clearBuffer(meetingCode);
  captionsService.clearMeeting(meetingCode);
  whiteboardService.clear(meetingCode);
  codeEditorService.clear(meetingCode);

  return { success: true, status: "ended", totalCost };
}

export async function getParticipants(meetingCode: string) {
  const meeting = await findMeetingRowByCode(meetingCode);
  const { rows } = await pool.query<{
    user_id: string;
    name: string;
    role: string;
    joined_at: string;
  }>(
    `SELECT u.id AS user_id, u.name, mp.role, mp.joined_at
     FROM meeting_participants mp JOIN users u ON u.id = mp.user_id
     WHERE mp.meeting_id = $1 AND mp.left_at IS NULL
     ORDER BY mp.joined_at ASC`,
    [meeting.id],
  );
  return {
    participants: rows.map((row) => ({
      userId: row.user_id,
      name: row.name,
      role: row.role,
      joinedAt: row.joined_at,
    })),
  };
}
