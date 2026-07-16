import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import * as api from "../services/api";

type Stage = "requesting" | "denied" | "ready" | "recording" | "preview" | "saving";

export function RecordVideoPage() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("requesting");
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(0);

  const previewRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  const startedAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (previewRef.current) {
          previewRef.current.srcObject = stream;
        }
        setStage("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not access camera/microphone");
        setStage("denied");
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      recordedBlobRef.current = blob;
      setDurationSeconds(Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)));
      setStage("preview");
      if (playbackRef.current) {
        playbackRef.current.src = URL.createObjectURL(blob);
      }
    };
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    recorder.start();
    setStage("recording");
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  function reRecord() {
    recordedBlobRef.current = null;
    setStage("ready");
  }

  async function handleSave() {
    if (!accessToken || !recordedBlobRef.current) return;
    setError(null);
    setStage("saving");
    try {
      await api.uploadAsyncVideo(
        accessToken,
        title.trim() || "Untitled",
        recordedBlobRef.current,
        durationSeconds,
      );
      navigate("/videos/mine");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save video");
      setStage("preview");
    }
  }

  return (
    <div className="min-h-screen bg-white p-8 dark:bg-gray-900">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Record a Video Message</h1>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {stage === "denied" && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Camera/microphone access is required to record a video message.
          </p>
        )}

        <video
          ref={previewRef}
          autoPlay
          muted
          playsInline
          className={stage === "ready" || stage === "recording" || stage === "requesting" ? "w-full rounded bg-black" : "hidden"}
        />
        <video
          ref={playbackRef}
          controls
          className={stage === "preview" || stage === "saving" ? "w-full rounded bg-black" : "hidden"}
        />

        {stage === "ready" && (
          <button onClick={startRecording} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Start Recording
          </button>
        )}

        {stage === "recording" && (
          <button onClick={stopRecording} className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white">
            Stop Recording
          </button>
        )}

        {(stage === "preview" || stage === "saving") && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={stage === "saving"}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {stage === "saving" ? "Saving..." : "Save & Get Link"}
              </button>
              <button
                onClick={reRecord}
                disabled={stage === "saving"}
                className="rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200"
              >
                Re-record
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
