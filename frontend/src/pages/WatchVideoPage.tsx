import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import * as api from "../services/api";

export function WatchVideoPage() {
  const { videoId = "" } = useParams<{ videoId: string }>();
  const [video, setVideo] = useState<api.AsyncVideo | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getAsyncVideo(videoId)
      .then((res) => {
        if (!cancelled) setVideo(res);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">Video not found.</p>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8 dark:bg-gray-900">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{video.title}</h1>
        <video src={video.fileUrl} controls autoPlay className="mt-4 w-full rounded bg-black" />
      </div>
    </div>
  );
}
