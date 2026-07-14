import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as api from "../services/api";

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function RecordingsPage() {
  const { meetingCode = "" } = useParams<{ meetingCode: string }>();
  const [recordings, setRecordings] = useState<api.Recording[]>([]);
  const [error, setError] = useState<string | null>(null);

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
      </div>
    </div>
  );
}
