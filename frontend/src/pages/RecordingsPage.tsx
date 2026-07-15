import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as api from "../services/api";

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function isTerminal(status: string | undefined): boolean {
  return status === "completed" || status === "failed";
}

export function RecordingsPage() {
  const { meetingCode = "" } = useParams<{ meetingCode: string }>();
  const [recordings, setRecordings] = useState<api.Recording[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [recap, setRecap] = useState<api.RecapResponse | null>(null);

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
              {recording.status === "completed" && recording.fileUrl ? (
                <video src={recording.fileUrl} controls className="w-full rounded" />
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
