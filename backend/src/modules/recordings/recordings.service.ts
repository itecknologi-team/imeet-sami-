import { EgressClient, EncodedFileOutput, EncodedFileType, S3Upload } from "livekit-server-sdk";
import { pool } from "../../config/db";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors";

const egressClient = new EgressClient(
  env.livekitUrl.replace(/^ws/, "http"),
  env.livekitApiKey,
  env.livekitApiSecret,
);

interface MeetingRow {
  id: string;
  host_id: string;
  meeting_code: string;
}

async function findMeetingRowByCode(meetingCode: string): Promise<MeetingRow> {
  const { rows } = await pool.query<MeetingRow>(
    "SELECT id, host_id, meeting_code FROM meetings WHERE meeting_code = $1",
    [meetingCode],
  );
  const row = rows[0];
  if (!row) {
    throw new AppError(404, "Meeting not found");
  }
  return row;
}

function requireHost(meeting: MeetingRow, userId: string) {
  if (meeting.host_id !== userId) {
    throw new AppError(403, "Only host can manage recording");
  }
}

export async function startRecording(meetingCode: string, userId: string) {
  const meeting = await findMeetingRowByCode(meetingCode);
  requireHost(meeting, userId);

  const existing = await pool.query(
    "SELECT id FROM recordings WHERE meeting_id = $1 AND status = 'recording'",
    [meeting.id],
  );
  if (existing.rows.length > 0) {
    throw new AppError(400, "Recording already in progress");
  }

  const output = new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath: `${meetingCode}-{time}.mp4`,
    output: {
      case: "s3",
      value: new S3Upload({
        accessKey: env.s3AccessKey,
        secret: env.s3SecretKey,
        region: env.s3Region,
        endpoint: env.s3Endpoint,
        bucket: env.s3Bucket,
        forcePathStyle: true,
      }),
    },
  });

  let info;
  try {
    info = await egressClient.startRoomCompositeEgress(meetingCode, { file: output });
  } catch (err) {
    if (typeof err === "object" && err !== null && "status" in err && (err as { status: unknown }).status === 404) {
      throw new AppError(400, "No one is currently in the meeting to record");
    }
    throw err;
  }

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO recordings (meeting_id, egress_id, status)
     VALUES ($1, $2, 'recording')
     RETURNING id`,
    [meeting.id, info.egressId],
  );

  return { id: rows[0].id, egressId: info.egressId, status: "recording" };
}

export async function stopRecording(meetingCode: string, userId: string) {
  const meeting = await findMeetingRowByCode(meetingCode);
  requireHost(meeting, userId);

  const { rows } = await pool.query<{ id: string; egress_id: string }>(
    "SELECT id, egress_id FROM recordings WHERE meeting_id = $1 AND status = 'recording'",
    [meeting.id],
  );
  const recording = rows[0];
  if (!recording) {
    throw new AppError(400, "No active recording for this meeting");
  }

  try {
    await egressClient.stopEgress(recording.egress_id);
  } catch (err) {
    // Egress may have already ended on its own (e.g. aborted); the webhook
    // will have updated (or will update) the row's final status in that case.
    console.error(`Failed to stop egress ${recording.egress_id}:`, err);
  }
  await pool.query(
    "UPDATE recordings SET status = 'processing' WHERE id = $1 AND status = 'recording'",
    [recording.id],
  );

  return { success: true };
}

export async function listRecordings(meetingCode: string) {
  const meeting = await findMeetingRowByCode(meetingCode);
  const { rows } = await pool.query<{
    id: string;
    file_url: string | null;
    duration: number | null;
    status: string;
    created_at: string;
  }>(
    `SELECT id, file_url, duration, status, created_at
     FROM recordings
     WHERE meeting_id = $1
     ORDER BY created_at DESC`,
    [meeting.id],
  );
  return {
    recordings: rows.map((row) => ({
      id: row.id,
      fileUrl: row.file_url,
      duration: row.duration,
      status: row.status,
      createdAt: row.created_at,
    })),
  };
}

export async function completeRecording(
  egressId: string,
  status: "completed" | "failed",
  fileUrl: string | null,
  durationSeconds: number | null,
) {
  const { rows } = await pool.query<{ id: string }>(
    "UPDATE recordings SET status = $1, file_url = $2, duration = $3 WHERE egress_id = $4 RETURNING id",
    [status, fileUrl, durationSeconds, egressId],
  );
  return rows[0] ?? null;
}
