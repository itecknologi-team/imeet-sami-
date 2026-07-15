import { pool } from "../../config/db";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors";

interface RecordingRow {
  id: string;
  meeting_id: string;
  file_url: string | null;
}

interface WhisperSegment {
  start: number;
  end: number;
  text: string;
}

interface WhisperResult {
  text: string;
  segments: WhisperSegment[];
}

async function runWhisperTranscription(fileUrl: string): Promise<WhisperResult> {
  if (!env.openaiApiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) {
    throw new Error(`Failed to download recording: ${fileRes.status}`);
  }
  const blob = await fileRes.blob();

  const form = new FormData();
  form.append("file", blob, "recording.mp4");
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.openaiApiKey}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Whisper API error: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { text: string; segments?: WhisperSegment[] };
  return { text: data.text, segments: data.segments ?? [] };
}

function formatSegmentsForPrompt(segments: WhisperSegment[]): string {
  return segments.map((s) => `[${s.start.toFixed(1)}s] ${s.text.trim()}`).join("\n");
}

async function generateSummaryAndHighlights(
  meetingId: string,
  recordingId: string,
  transcriptContent: string,
  segments: WhisperSegment[],
): Promise<void> {
  await pool.query(
    `INSERT INTO meeting_summaries (meeting_id, status)
     VALUES ($1, 'processing')
     ON CONFLICT (meeting_id) DO UPDATE SET status = 'processing', updated_at = NOW()`,
    [meetingId],
  );

  try {
    if (!env.anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content:
              "Summarize this meeting transcript in 2-4 sentences, list concrete action items, " +
              "pick out a handful of short timestamped notes worth jumping back to, and separately " +
              "flag any key moments (decisions or deadlines) as a start-end time range. " +
              "Only use timestamps that appear in the given segments below — do not invent times. " +
              'Respond with ONLY valid JSON, no markdown fences: {"summary": "...", "actionItems": ["..."], ' +
              '"notes": [{"timestampSeconds": 12.3, "label": "..."}], ' +
              '"keyMoments": [{"startSeconds": 40.0, "endSeconds": 55.0, "label": "..."}]}\n\n' +
              `Transcript segments:\n${formatSegmentsForPrompt(segments)}\n\n` +
              `Full transcript:\n${transcriptContent}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`Claude API error: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { content: Array<{ text: string }> };
    const parsed = JSON.parse(data.content[0].text) as {
      summary: string;
      actionItems: string[];
      notes: Array<{ timestampSeconds: number; label: string }>;
      keyMoments: Array<{ startSeconds: number; endSeconds: number; label: string }>;
    };

    await pool.query(
      `UPDATE meeting_summaries
       SET status = 'completed', summary_text = $2, action_items = $3, updated_at = NOW()
       WHERE meeting_id = $1`,
      [meetingId, parsed.summary, JSON.stringify(parsed.actionItems ?? [])],
    );

    await pool.query("DELETE FROM meeting_highlights WHERE meeting_id = $1", [meetingId]);
    for (const note of parsed.notes ?? []) {
      await pool.query(
        `INSERT INTO meeting_highlights (meeting_id, recording_id, kind, start_seconds, label)
         VALUES ($1, $2, 'note', $3, $4)`,
        [meetingId, recordingId, note.timestampSeconds, note.label],
      );
    }
    for (const moment of parsed.keyMoments ?? []) {
      await pool.query(
        `INSERT INTO meeting_highlights (meeting_id, recording_id, kind, start_seconds, end_seconds, label)
         VALUES ($1, $2, 'key_moment', $3, $4, $5)`,
        [meetingId, recordingId, moment.startSeconds, moment.endSeconds, moment.label],
      );
    }
  } catch (err) {
    console.error(`Summary generation failed for meeting ${meetingId}:`, err);
    await pool.query(
      "UPDATE meeting_summaries SET status = 'failed', updated_at = NOW() WHERE meeting_id = $1",
      [meetingId],
    );
  }
}

export async function transcribeRecording(recordingId: string): Promise<void> {
  const { rows } = await pool.query<RecordingRow>(
    "SELECT id, meeting_id, file_url FROM recordings WHERE id = $1",
    [recordingId],
  );
  const recording = rows[0];
  if (!recording || !recording.file_url) {
    return;
  }

  await pool.query(
    `INSERT INTO transcripts (meeting_id, recording_id, status)
     VALUES ($1, $2, 'processing')
     ON CONFLICT (recording_id) DO UPDATE SET status = 'processing', updated_at = NOW()`,
    [recording.meeting_id, recording.id],
  );

  try {
    const { text, segments } = await runWhisperTranscription(recording.file_url);
    await pool.query(
      "UPDATE transcripts SET status = 'completed', content = $2, segments = $3, updated_at = NOW() WHERE recording_id = $1",
      [recording.id, text, JSON.stringify(segments)],
    );
    await generateSummaryAndHighlights(recording.meeting_id, recording.id, text, segments);
  } catch (err) {
    console.error(`Transcription failed for recording ${recording.id}:`, err);
    await pool.query(
      "UPDATE transcripts SET status = 'failed', updated_at = NOW() WHERE recording_id = $1",
      [recording.id],
    );
  }
}

export async function getRecap(meetingCode: string) {
  const { rows: meetingRows } = await pool.query<{ id: string }>(
    "SELECT id FROM meetings WHERE meeting_code = $1",
    [meetingCode],
  );
  const meeting = meetingRows[0];
  if (!meeting) {
    throw new AppError(404, "Meeting not found");
  }

  const { rows: transcriptRows } = await pool.query<{
    status: string;
    content: string | null;
    recording_id: string;
  }>(
    `SELECT status, content, recording_id FROM transcripts
     WHERE meeting_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [meeting.id],
  );

  const { rows: summaryRows } = await pool.query<{
    status: string;
    summary_text: string | null;
    action_items: string[] | null;
  }>(
    "SELECT status, summary_text, action_items FROM meeting_summaries WHERE meeting_id = $1",
    [meeting.id],
  );

  const { rows: highlightRows } = await pool.query<{
    id: string;
    kind: string;
    start_seconds: string;
    end_seconds: string | null;
    label: string;
  }>(
    `SELECT id, kind, start_seconds, end_seconds, label FROM meeting_highlights
     WHERE meeting_id = $1
     ORDER BY start_seconds ASC`,
    [meeting.id],
  );

  return {
    transcript: transcriptRows[0]
      ? {
          status: transcriptRows[0].status,
          content: transcriptRows[0].content,
          recordingId: transcriptRows[0].recording_id,
        }
      : null,
    summary: summaryRows[0]
      ? {
          status: summaryRows[0].status,
          summaryText: summaryRows[0].summary_text,
          actionItems: summaryRows[0].action_items,
        }
      : null,
    highlights: highlightRows.map((row) => ({
      id: row.id,
      kind: row.kind,
      startSeconds: parseFloat(row.start_seconds),
      endSeconds: row.end_seconds !== null ? parseFloat(row.end_seconds) : null,
      label: row.label,
    })),
  };
}
