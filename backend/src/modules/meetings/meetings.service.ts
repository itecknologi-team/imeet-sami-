import { AccessToken } from "livekit-server-sdk";
import { pool } from "../../config/db";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors";
import * as assistantService from "../assistant/assistant.service";
import * as captionsService from "../captions/captions.service";
import * as crmService from "../crm/crm.service";
import * as whiteboardService from "../whiteboard/whiteboard.service";
import * as codeEditorService from "../codeEditor/codeEditor.service";
import * as paymentsService from "../payments/payments.service";
import * as virtualOfficeService from "../virtualOffice/virtualOffice.service";
import * as sharedViewService from "../sharedView/sharedView.service";
import * as waitingRoomService from "../waitingRoom/waitingRoom.service";
import * as mediaControlService from "../mediaControl/mediaControl.service";
import * as handRaiseService from "../handRaise/handRaise.service";
import * as pinService from "../pin/pin.service";
import * as hostControlsService from "../hostControls/hostControls.service";

interface MeetingRow {
  id: string;
  host_id: string | null;
  host_guest_id: string | null;
  title: string;
  meeting_code: string;
  status: string;
  hourly_rate: string;
  started_at: string | null;
  price_cents: number | null;
  passcode: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
}

const CODE_SEGMENT_LENGTHS = [3, 4, 3];
// Meetings are free unless a signed-in host explicitly sets an hourly rate —
// instant/guest meetings must never silently accrue a cost.
const DEFAULT_HOURLY_RATE = 0;

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
    `SELECT id, host_id, host_guest_id, title, meeting_code, status, hourly_rate, started_at, price_cents, passcode, scheduled_at, duration_minutes
     FROM meetings WHERE meeting_code = $1`,
    [meetingCode],
  );
  const row = rows[0];
  if (!row) {
    throw new AppError(404, "Meeting not found");
  }
  return row;
}

export async function createMeeting(
  hostId: string | null,
  hostGuestId: string | null,
  hostGuestName: string | undefined,
  title: string | undefined,
  hourlyRate: number | undefined,
  priceCents: number | undefined,
  passcode?: string,
  scheduledAt?: string,
  durationMinutes?: number,
) {
  if (priceCents && priceCents > 0 && !hostId) {
    throw new AppError(400, "Sign in to create a paid meeting");
  }
  if (priceCents && priceCents > 0 && !env.stripeSecretKey) {
    throw new AppError(400, "Payments are not configured on this server — cannot create a paid meeting");
  }
  // Charging by the hour is a signed-in-host feature (doctors, tutors,
  // consultants, ...) — guests always get a free instant meeting.
  if (hourlyRate && hourlyRate > 0 && !hostId) {
    throw new AppError(400, "Sign in to set an hourly rate for a meeting");
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const meetingCode = generateMeetingCode();
    try {
      const { rows } = await pool.query<MeetingRow>(
        `INSERT INTO meetings (host_id, host_guest_id, host_guest_name, title, meeting_code, hourly_rate, price_cents, passcode, scheduled_at, duration_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, host_id, title, meeting_code, status, hourly_rate, started_at, price_cents, scheduled_at, duration_minutes`,
        [
          hostId,
          hostGuestId,
          hostGuestName ?? null,
          title ?? "Untitled Meeting",
          meetingCode,
          hourlyRate ?? DEFAULT_HOURLY_RATE,
          priceCents ?? null,
          passcode?.trim() || null,
          scheduledAt ?? null,
          durationMinutes ?? null,
        ],
      );
      const meeting = rows[0];
      return {
        id: meeting.id,
        title: meeting.title,
        meetingCode: meeting.meeting_code,
        hostId: meeting.host_id,
        status: meeting.status,
        hourlyRate: parseFloat(meeting.hourly_rate),
        priceCents: meeting.price_cents,
        scheduledAt: meeting.scheduled_at,
        durationMinutes: meeting.duration_minutes,
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
    host_name: string | null;
    host_guest_name: string | null;
    hourly_rate: string;
    started_at: string | null;
    total_cost: string | null;
    price_cents: number | null;
    scheduled_at: string | null;
    duration_minutes: number | null;
  }>(
    `SELECT m.id, m.title, m.meeting_code, m.status, u.name AS host_name, m.host_guest_name,
            m.hourly_rate, m.started_at, m.total_cost, m.price_cents, m.scheduled_at, m.duration_minutes
     FROM meetings m LEFT JOIN users u ON u.id = m.host_id
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
    hostName: row.host_name ?? row.host_guest_name ?? "Guest",
    hourlyRate: parseFloat(row.hourly_rate),
    startedAt: row.started_at,
    totalCost: row.total_cost !== null ? parseFloat(row.total_cost) : null,
    priceCents: row.price_cents,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
  };
}

export async function listMyMeetings(userId: string) {
  const { rows } = await pool.query<{
    id: string;
    title: string;
    meeting_code: string;
    status: string;
    hourly_rate: string;
    started_at: string | null;
    ended_at: string | null;
    scheduled_at: string | null;
    duration_minutes: number | null;
    created_at: string;
  }>(
    `SELECT id, title, meeting_code, status, hourly_rate, started_at, ended_at, scheduled_at, duration_minutes, created_at
     FROM meetings
     WHERE host_id = $1
     ORDER BY COALESCE(scheduled_at, created_at) DESC
     LIMIT 50`,
    [userId],
  );
  return {
    meetings: rows.map((row) => ({
      id: row.id,
      title: row.title,
      meetingCode: row.meeting_code,
      status: row.status,
      hourlyRate: parseFloat(row.hourly_rate),
      startedAt: row.started_at,
      endedAt: row.ended_at,
      scheduledAt: row.scheduled_at,
      durationMinutes: row.duration_minutes,
      createdAt: row.created_at,
    })),
  };
}

export async function joinMeeting(
  meetingCode: string,
  userId: string | null,
  guestId?: string | null,
  guestName?: string,
  passcode?: string,
) {
  const meeting = await findMeetingRowByCode(meetingCode);
  if (meeting.status === "ended") {
    throw new AppError(400, "Meeting has ended");
  }
  if (meeting.passcode && meeting.passcode !== (passcode ?? "")) {
    throw new AppError(403, "Incorrect passcode");
  }

  if (userId) {
    await paymentsService.requirePaymentIfNeeded(meeting, userId);
  } else if (meeting.price_cents && meeting.price_cents > 0) {
    throw new AppError(403, "Sign in to join a paid meeting");
  }

  if (meeting.status === "scheduled") {
    const { rows: startedRows } = await pool.query<{ started_at: string }>(
      "UPDATE meetings SET status = 'active', started_at = NOW() WHERE id = $1 RETURNING started_at",
      [meeting.id],
    );
    meeting.status = "active";
    meeting.started_at = startedRows[0].started_at;
  }

  const isHost = userId ? meeting.host_id === userId : Boolean(guestId) && meeting.host_guest_id === guestId;
  const role = isHost ? "host" : "participant";
  // ON CONFLICT (backed by partial unique indexes on active rows) makes this
  // safe against concurrent join calls for the same identity, instead of a
  // separate check-then-insert that's racy under concurrent requests.
  if (userId) {
    await pool.query(
      `INSERT INTO meeting_participants (meeting_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (meeting_id, user_id) WHERE left_at IS NULL DO NOTHING`,
      [meeting.id, userId, role],
    );
  } else {
    await pool.query(
      `INSERT INTO meeting_participants (meeting_id, guest_id, guest_name, role, joined_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (meeting_id, guest_id) WHERE left_at IS NULL AND guest_id IS NOT NULL DO NOTHING`,
      [meeting.id, guestId, guestName, role],
    );
  }

  let identity: string;
  let userName: string;
  if (userId) {
    const { rows: userRows } = await pool.query<{ name: string }>(
      "SELECT name FROM users WHERE id = $1",
      [userId],
    );
    identity = userId;
    userName = userRows[0]?.name ?? "Guest";
  } else {
    identity = `guest-${guestId}`;
    userName = guestName ?? "Guest";
  }

  const accessToken = new AccessToken(env.livekitApiKey, env.livekitApiSecret, {
    identity,
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

// Sockets have no equivalent of the REST layer's requireAuth/optionalAuth
// middleware, so any host-only realtime action (approving a join request,
// force-muting a participant) re-derives host-ness from the DB here rather
// than trusting a client-supplied flag.
export async function isMeetingHost(meetingCode: string, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const meeting = await findMeetingRowByCode(meetingCode);
  if (userId.startsWith("guest-")) {
    return meeting.host_guest_id === userId.slice("guest-".length);
  }
  return meeting.host_id === userId;
}

export async function leaveMeeting(meetingCode: string, userId: string | null, guestId?: string | null) {
  const meeting = await findMeetingRowByCode(meetingCode);
  if (userId) {
    await pool.query(
      "UPDATE meeting_participants SET left_at = NOW() WHERE meeting_id = $1 AND user_id = $2 AND left_at IS NULL",
      [meeting.id, userId],
    );
  } else if (guestId) {
    await pool.query(
      "UPDATE meeting_participants SET left_at = NOW() WHERE meeting_id = $1 AND guest_id = $2 AND left_at IS NULL",
      [meeting.id, guestId],
    );
  }
  return { success: true };
}

export async function endMeeting(meetingCode: string, userId: string | null, guestId?: string | null) {
  const meeting = await findMeetingRowByCode(meetingCode);
  const isHost = userId ? meeting.host_id === userId : Boolean(guestId) && meeting.host_guest_id === guestId;
  if (!isHost) {
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
  virtualOfficeService.clear(meetingCode);
  sharedViewService.clear(meetingCode);
  waitingRoomService.clear(meetingCode);
  mediaControlService.clear(meetingCode);
  handRaiseService.clear(meetingCode);
  pinService.clear(meetingCode);
  hostControlsService.clear(meetingCode);

  // Fire-and-forget — a slow or broken CRM webhook must never delay or fail
  // the end-meeting response.
  crmService.syncMeetingEnd(meeting.id, meetingCode, totalCost).catch((err) => {
    console.error(`CRM sync failed for meeting ${meetingCode}:`, err);
  });

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
    `SELECT COALESCE(u.id::text, 'guest-' || mp.guest_id) AS user_id,
            COALESCE(u.name, mp.guest_name, 'Guest') AS name,
            mp.role, mp.joined_at
     FROM meeting_participants mp LEFT JOIN users u ON u.id = mp.user_id
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
