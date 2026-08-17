import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { copyToClipboard } from "../lib/clipboard";
import * as api from "../services/api";

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MyVideosPage() {
  const { accessToken } = useAuth();
  const [videos, setVideos] = useState<api.AsyncVideo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    api
      .listMyVideos(accessToken)
      .then((res) => {
        if (!cancelled) setVideos(res.videos);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load videos");
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function handleCopyLink(videoId: string) {
    const link = `${window.location.origin}/videos/${videoId}`;
    await copyToClipboard(link);
    setCopiedId(videoId);
    setTimeout(() => setCopiedId((prev) => (prev === videoId ? null : prev)), 2000);
  }

  return (
    <div className="min-h-screen bg-white p-8 dark:bg-gray-900">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">My Videos</h1>
          <Link
            to="/videos/new"
            className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white"
          >
            Record new video
          </Link>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 space-y-3">
          {videos.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">No videos yet.</p>
          )}
          {videos.map((video) => (
            <div
              key={video.id}
              className="flex items-center justify-between rounded border border-gray-200 p-3 dark:border-gray-700"
            >
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">{video.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(video.createdAt).toLocaleString()}
                  {video.duration !== null && ` — ${formatDuration(video.duration)}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link to={`/videos/${video.id}`} className="text-sm text-blue-600 hover:underline">
                  View
                </Link>
                <button
                  onClick={() => handleCopyLink(video.id)}
                  className="rounded bg-gray-200 px-3 py-1 text-xs font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                >
                  {copiedId === video.id ? "Copied!" : "Copy link"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
