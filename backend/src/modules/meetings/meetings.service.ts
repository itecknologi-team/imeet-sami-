import crypto from "crypto";
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

// The meeting code IS the capability to reach a meeting, so it has to be
// unguessable. Math.random() is a non-cryptographic PRNG: observing a few
// issued codes is enough to recover its internal state and then predict every
// subsequent one. randomInt draws from the CSPRNG instead, and rejects modulo
// bias while doing it.
function randomSegment(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[crypto.randomInt(chars.length)];
  }
  return out;
}

function generateMeetingCode(): string {
  return CODE_SEGMENT_LENGTHS.map(randomSegment).join("-");
}

// `===` on secrets short-circuits at the first differing byte, so response
// timing leaks how much of a guess was correct — enough to recover a short
// passcode character by character. Hash both sides first so the comparison is
// always over equal-length digests, then compare in constant time.
function passcodeMatches(expected: string, provided: string | undefined): boolean {
  const digest = (value: string) => crypto.createHash("sha256").update(value, "utf8").digest();
  return crypto.timingSafeEqual(digest(expected), digest(provided ?? ""));
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
  const isHost = userId ? meeting.host_id === userId : Boolean(guestId) && meeting.host_guest_id === guestId;

  if (meeting.status === "ended") {
    // Like Zoom/Meet: the meeting link stays permanently valid for its host
    // to restart — only non-hosts are locked out once it's ended, and only
    // until the host rejoins. Without this, a host who ends (or is dropped
    // from) their own meeting could never get back in via the same code.
    if (!isHost) {
      throw new AppError(400, "Meeting has ended");
    }
    const { rows: resumedRows } = await pool.query<{ started_at: string }>(
      "UPDATE meetings SET status = 'active', ended_at = NULL WHERE id = $1 RETURNING started_at",
      [meeting.id],
    );
    meeting.status = "active";
    meeting.started_at = resumedRows[0].started_at;
  }
  if (meeting.passcode && !passcodeMatches(meeting.passcode, passcode)) {
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
    // The browser-facing URL, not the internal one the server SDK uses.
    livekitUrl: env.livekitPublicUrl,
  };
}

// Recordings/recap stay reachable long after a meeting ends (up to the
// retention window), so — unlike isActiveParticipant below — this
// deliberately does NOT require `left_at IS NULL` or an active meeting:
// anyone who actually attended (or the host) can still look back at it,
// but someone who merely knows/guessed the meeting code and never joined
// cannot.
export async function canAccessMeetingHistory(
  meetingCode: string,
  userId: string | null,
  guestId?: string | null,
): Promise<boolean> {
  const meeting = await findMeetingRowByCode(meetingCode);
  const isHost = userId ? meeting.host_id === userId : Boolean(guestId) && meeting.host_guest_id === guestId;
  if (isHost) return true;

  if (userId) {
    const { rows } = await pool.query(
      "SELECT 1 FROM meeting_participants WHERE meeting_id = $1 AND user_id = $2 LIMIT 1",
      [meeting.id, userId],
    );
    return rows.length > 0;
  }
  if (guestId) {
    const { rows } = await pool.query(
      "SELECT 1 FROM meeting_participants WHERE meeting_id = $1 AND guest_id = $2 LIMIT 1",
      [meeting.id, guestId],
    );
    return rows.length > 0;
  }
  return false;
}

// Socket identity is authenticated at connection time (realtime/socket.ts),
// but *membership* of a given meeting still has to be checked against the DB:
// the REST join endpoint is what enforces the passcode and the paywall, and
// what writes the participant row this reads. Requiring the row means the
// realtime channel can't be used to skip those checks.
export async function isActiveParticipant(meetingCode: string, identity: string): Promise<boolean> {
  const meeting = await findMeetingRowByCode(meetingCode);
  if (meeting.status === "ended") return false;

  if (identity.startsWith("guest-")) {
    const guestId = identity.slice("guest-".length);
    const { rows } = await pool.query(
      `SELECT 1 FROM meeting_participants
       WHERE meeting_id = $1 AND guest_id = $2 AND left_at IS NULL LIMIT 1`,
      [meeting.id, guestId],
    );
    return rows.length > 0;
  }

  const { rows } = await pool.query(
    `SELECT 1 FROM meeting_participants
     WHERE meeting_id = $1 AND user_id = $2 AND left_at IS NULL LIMIT 1`,
    [meeting.id, identity],
  );
  return rows.length > 0;
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

  // Transactional so a crash/DB error between steps can't leave the meeting
  // half-ended — e.g. participants marked "left" but status never flipped to
  // "ended", or the cost never persisted.
  const client = await pool.connect();
  let totalCost: number;
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE meeting_participants SET left_at = NOW() WHERE meeting_id = $1 AND left_at IS NULL",
      [meeting.id],
    );

    const { rows: costRows } = await client.query<{ total_hours: string | null }>(
      `SELECT SUM(EXTRACT(EPOCH FROM (left_at - joined_at)) / 3600) AS total_hours
       FROM meeting_participants
       WHERE meeting_id = $1`,
      [meeting.id],
    );
    const totalHours = parseFloat(costRows[0]?.total_hours ?? "0") || 0;
    totalCost = Math.round(totalHours * parseFloat(meeting.hourly_rate) * 100) / 100;

    await client.query(
      "UPDATE meetings SET status = 'ended', ended_at = NOW(), total_cost = $2 WHERE id = $1",
      [meeting.id, totalCost],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

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
