import { Mic, MicOff, Video, VideoOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getMediaPreferences, setMediaPreferences } from "../lib/mediaPreferences";

interface DevicePreviewModalProps {
  onClose: () => void;
}

export function DevicePreviewModal({ onClose }: DevicePreviewModalProps) {
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDeviceId, setVideoDeviceId] = useState("");
  const [audioDeviceId, setAudioDeviceId] = useState("");
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [durationMinutes, setDurationMinutes] = useState(
    String(getMediaPreferences().defaultDurationMinutes ?? 60),
  );
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const levelBarRef = useRef<HTMLDivElement>(null);
  // Read inside the rAF loop instead of the `micEnabled` state directly — the
  // loop closure is created once per acquireStream() call and would
  // otherwise keep seeing whatever mic state existed at that moment.
  const micEnabledRef = useRef(true);

  function stopLevelMeter() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    stopLevelMeter();
  }

  async function acquireStream(constraints?: { videoDeviceId?: string; audioDeviceId?: string }) {
    stopStream();
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: constraints?.videoDeviceId ? { deviceId: { exact: constraints.videoDeviceId } } : true,
        audio: constraints?.audioDeviceId ? { deviceId: { exact: constraints.audioDeviceId } } : true,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      stream.getVideoTracks().forEach((t) => (t.enabled = cameraEnabled));
      stream.getAudioTracks().forEach((t) => (t.enabled = micEnabled));

      const devices = await navigator.mediaDevices.enumerateDevices();
      setVideoDevices(devices.filter((d) => d.kind === "videoinput"));
      setAudioDevices(devices.filter((d) => d.kind === "audioinput"));
      const activeVideoTrack = stream.getVideoTracks()[0];
      const activeAudioTrack = stream.getAudioTracks()[0];
      if (activeVideoTrack) setVideoDeviceId(activeVideoTrack.getSettings().deviceId ?? "");
      if (activeAudioTrack) setAudioDeviceId(activeAudioTrack.getSettings().deviceId ?? "");

      const AudioContextCtor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioContextCtor();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const value of data) {
          const centered = value - 128;
          sum += centered * centered;
        }
        const rms = Math.sqrt(sum / data.length) / 128;
        const level = micEnabledRef.current ? Math.min(1, rms * 4) : 0;
        if (levelBarRef.current) levelBarRef.current.style.width = `${level * 100}%`;
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : "Could not access camera/microphone");
    }
  }

  useEffect(() => {
    const prefs = getMediaPreferences();
    acquireStream({ videoDeviceId: prefs.videoDeviceId, audioDeviceId: prefs.audioDeviceId });
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleToggleMic() {
    const next = !micEnabled;
    setMicEnabled(next);
    micEnabledRef.current = next;
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
  }

  function handleToggleCamera() {
    const next = !cameraEnabled;
    setCameraEnabled(next);
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
  }

  function handleSave() {
    setMediaPreferences({
      videoDeviceId: videoDeviceId || undefined,
      audioDeviceId: audioDeviceId || undefined,
      defaultDurationMinutes: durationMinutes.trim() ? Number(durationMinutes) : undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-soft"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand-text">Camera &amp; microphone</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-border text-brand-text hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mt-4 aspect-video overflow-hidden rounded-xl bg-gray-800">
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
          {(!cameraEnabled || mediaError) && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-sm text-gray-400">
              {mediaError ? "Camera unavailable" : "Camera is off"}
            </div>
          )}
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2">
            <button
              type="button"
              onClick={handleToggleMic}
              aria-label={micEnabled ? "Turn off microphone" : "Turn on microphone"}
              className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                micEnabled
                  ? "border-white/10 bg-black/40 text-white hover:bg-black/55"
                  : "border-brand-danger/30 bg-brand-danger text-white"
              }`}
            >
              {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={handleToggleCamera}
              aria-label={cameraEnabled ? "Turn off camera" : "Turn on camera"}
              className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                cameraEnabled
                  ? "border-white/10 bg-black/40 text-white hover:bg-black/55"
                  : "border-brand-danger/30 bg-brand-danger text-white"
              }`}
            >
              {cameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div ref={levelBarRef} className="h-full rounded-full bg-brand-green transition-[width] duration-75" />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-brand-muted">Camera</label>
            <select
              value={videoDeviceId}
              onChange={(e) => {
                setVideoDeviceId(e.target.value);
                acquireStream({ videoDeviceId: e.target.value, audioDeviceId });
              }}
              className="w-full rounded-[10px] border border-brand-border px-3 py-2 text-sm"
            >
              {videoDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || "Camera"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-brand-muted">Microphone</label>
            <select
              value={audioDeviceId}
              onChange={(e) => {
                setAudioDeviceId(e.target.value);
                acquireStream({ videoDeviceId, audioDeviceId: e.target.value });
              }}
              className="w-full rounded-[10px] border border-brand-border px-3 py-2 text-sm"
            >
              {audioDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || "Microphone"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className="mb-1.5 block text-xs font-medium text-brand-muted">
            Default meeting duration (minutes)
          </label>
          <input
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            type="number"
            min="1"
            className="w-full rounded-[10px] border border-brand-border px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] border border-brand-border px-4 py-2 text-sm font-medium text-brand-text hover:bg-slate-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-[10px] bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-dark"
          >
            {saved ? "Saved!" : "Save as default"}
          </button>
        </div>
      </div>
    </div>
  );
}
