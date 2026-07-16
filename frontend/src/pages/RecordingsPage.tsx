import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as api from "../services/api";
import { useAuth } from "../hooks/useAuth";

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function isTerminal(status: string | undefined): boolean {
  return status === "completed" || status === "failed";
}

export function RecordingsPage() {
  const { meetingCode = "" } = useParams<{ meetingCode: string }>();
  const { user, accessToken } = useAuth();
  const [recordings, setRecordings] = useState<api.Recording[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recap, setRecap] = useState<api.RecapResponse | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const pauseListenerRef = useRef<{ video: HTMLVideoElement; listener: () => void } | null>(null);

  async function handleDelete(recordingId: string) {
    if (!accessToken) return;
    try {
      await api.deleteRecording(accessToken, meetingCode, recordingId);
      const res = await api.getRecordings(meetingCode);
      setRecordings(res.recordings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete recording");
    }
  }

  function seekTo(recordingId: string, start: number, end: number | null) {
    const video = videoRefs.current[recordingId];
    if (!video) return;

    if (pauseListenerRef.current) {
      pauseListenerRef.current.video.removeEventListener("timeupdate", pauseListenerRef.current.listener);
      pauseListenerRef.current = null;
    }

    video.currentTime = start;
    video.play();

    if (end !== null) {
      const listener = () => {
        if (video.currentTime >= end) {
          video.pause();
          video.removeEventListener("timeupdate", listener);
          pauseListenerRef.current = null;
        }
      };
      video.addEventListener("timeupdate", listener);
      pauseListenerRef.current = { video, listener };
    }
  }

  useEffect(() => {
    let cancelled = false;
    api
      .getRecordings(meetingCode)
      .then((res) => {
        if (!cancelled) setRecordings(res.recordings);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load recordings");
      });
    return () => {
      cancelled = true;
    };
  }, [meetingCode]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .getParticipants(meetingCode)
      .then((res) => {
        if (!cancelled) {
          setIsHost(res.participants.find((p) => p.userId === user.id)?.role === "host");
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [meetingCode, user]);

  useEffect(() => {
    if (!recordings.some((r) => r.status === "completed")) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await api.getRecap(meetingCode);
        if (cancelled) return;
        setRecap(res);
        const done = isTerminal(res.transcript?.status) && isTerminal(res.summary?.status);
        if (!done) {
          timer = setTimeout(poll, 4000);
        }
      } catch {
        if (!cancelled) timer = setTimeout(poll, 4000);
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [meetingCode, recordings]);

  return (
    <div className="min-h-screen bg-white p-8 dark:bg-gray-900">
      <div className="mx-auto max-w-2xl">
        <Link to={`/meeting/${meetingCode}`} className="text-sm text-blue-600">
          &larr; Back to meeting
        </Link>
        <h1 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
          Recordings for {meetingCode}
        </h1>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 space-y-6">
          {recordings.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">No recordings yet.</p>
          )}
          {recordings.map((recording) => (
            <div key={recording.id} className="space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>{new Date(recording.createdAt).toLocaleString()}</span>
                <span>
                  {recording.status}
                  {recording.duration !== null && ` — ${formatDuration(recording.duration)}`}
                </span>
              </div>
              {recording.deletedAt ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This recording has been deleted.
                </p>
              ) : recording.status === "completed" && recording.fileUrl ? (
                <>
                  <video
                    ref={(el) => {
                      videoRefs.current[recording.id] = el;
                    }}
                    src={recording.fileUrl}
                    controls
                    className="w-full rounded"
                  />
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    {recording.expiresAt && (
                      <span>Expires on {new Date(recording.expiresAt).toLocaleDateString()}</span>
                    )}
                    {isHost && (
                      <button
                        onClick={() => handleDelete(recording.id)}
                        className="text-red-600 hover:underline dark:text-red-400"
                      >
                        Delete now
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {recording.status === "recording" ? "Recording in progress..." : "Processing..."}
                </p>
              )}
            </div>
          ))}
        </div>

        {recap && (recap.transcript || recap.summary) && (
          <div className="mt-8 space-y-4 border-t border-gray-200 pt-6 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Meeting Recap</h2>

            {recap.summary?.status === "completed" && (
              <div className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">{recap.summary.summaryText}</p>
                {recap.summary.actionItems && recap.summary.actionItems.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
                    {recap.summary.actionItems.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {recap.summary?.status === "processing" && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Generating summary...</p>
            )}
            {recap.summary?.status === "failed" && (
              <p className="text-sm text-red-600">Summary generation failed.</p>
            )}
            {!recap.summary && recap.transcript?.status === "processing" && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Transcribing recording...</p>
            )}
            {recap.transcript?.status === "failed" && (
              <p className="text-sm text-red-600">Transcription failed.</p>
            )}

            {recap.highlights.filter((h) => h.kind === "note").length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Notes</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {recap.highlights
                    .filter((h) => h.kind === "note")
                    .map((h) => (
                      <li key={h.id}>
                        <button
                          onClick={() => recap.transcript && seekTo(recap.transcript.recordingId, h.startSeconds, null)}
                          className="text-left text-blue-600 hover:underline"
                        >
                          {formatDuration(h.startSeconds)} — {h.label}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {recap.highlights.filter((h) => h.kind === "key_moment").length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Key Moments</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {recap.highlights
                    .filter((h) => h.kind === "key_moment")
                    .map((h) => (
                      <li key={h.id}>
                        <button
                          onClick={() =>
                            recap.transcript && seekTo(recap.transcript.recordingId, h.startSeconds, h.endSeconds)
                          }
                          className="text-left text-blue-600 hover:underline"
                        >
                          {formatDuration(h.startSeconds)}
                          {h.endSeconds !== null && `–${formatDuration(h.endSeconds)}`} — {h.label}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {recap.transcript?.status === "completed" && recap.transcript.content && (
              <details className="text-sm text-gray-700 dark:text-gray-300">
                <summary className="cursor-pointer text-gray-600 dark:text-gray-400">Full transcript</summary>
                <p className="mt-2 whitespace-pre-wrap">{recap.transcript.content}</p>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
