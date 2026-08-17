import { Mic, MicOff, Settings, Video, VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Wordmark } from "../brand/Wordmark";
import { getMediaPreferences, setMediaPreferences } from "../../lib/mediaPreferences";

interface PreJoinLobbyProps {
  meetingTitle: string;
  initialName: string;
  nameEditable: boolean;
  submitting: boolean;
  onJoin: (opts: { name: string; micEnabled: boolean; cameraEnabled: boolean; stream: MediaStream | null }) => void;
}

export function PreJoinLobby({ meetingTitle, initialName, nameEditable, submitting, onJoin }: PreJoinLobbyProps) {
  const [name, setName] = useState(initialName);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDeviceId, setVideoDeviceId] = useState<string>("");
  const [audioDeviceId, setAudioDeviceId] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const levelBarRef = useRef<HTMLDivElement>(null);
  // Read inside the rAF loop instead of the `micEnabled` state directly —
  // the loop closure is created once per acquireStream() call and would
  // otherwise keep seeing whatever mic state existed at that moment.
  const micEnabledRef = useRef(true);
  // Set right before handing the live stream off to the meeting room, so
  // the unmount cleanup below (which runs right after) knows not to stop
  // tracks that are now owned by LiveKit instead of released back to the OS.
  const handedOffRef = useRef(false);

  function stopLevelMeter() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
  }

  function stopStream() {
    if (!handedOffRef.current) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    }
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

      const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
        // Written straight to the DOM (not React state) — this runs on every
        // animation frame, and routing it through setState would re-render
        // the whole lobby ~60x/sec, which is what made mic/camera toggling
        // feel laggy.
        if (levelBarRef.current) levelBarRef.current.style.width = `${level * 100}%`;
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : "Could not access camera/microphone");
    }
  }

  useEffect(() => {
    // Respect whatever camera/mic the user picked as their default in
    // Settings, instead of always grabbing the OS's arbitrary default device.
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (nameEditable && !name.trim()) return;
    // Hand the already-live stream straight to LiveKit instead of stopping
    // it here and letting the meeting room re-acquire the camera/mic from
    // scratch — releasing and immediately re-requesting the same device is
    // a real race (the OS/driver doesn't always free it fast enough), and
    // was exactly why a joining user's camera would sometimes come up off.
    const stream = streamRef.current;
    handedOffRef.current = true;
    stopStream();
    onJoin({ name: name.trim(), micEnabled, cameraEnabled, stream });
  }

  return (
    <div className="page-bg flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <Wordmark size="sm" />
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-soft"
      >
        <h1 className="text-lg font-semibold text-brand-text">Join {meetingTitle || "meeting"}</h1>

        <div className="relative mt-4 aspect-video overflow-hidden rounded-xl bg-gray-800">
          {/* Always mounted — toggling the camera only flips the track's
              `enabled` flag, it never re-creates this element or its
              srcObject. Conditionally unmounting it here was the bug: a
              fresh <video> on "camera on" never got the stream reattached. */}
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

        <button
          type="button"
          onClick={() => setShowDeviceSettings((v) => !v)}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-blue hover:underline"
        >
          <Settings className="h-3.5 w-3.5" />
          Camera &amp; microphone settings
        </button>

        {showDeviceSettings && (
          <div className="mt-2 space-y-2 rounded-xl border border-brand-border p-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-brand-muted">Camera</label>
              <select
                value={videoDeviceId}
                onChange={(e) => {
                  setVideoDeviceId(e.target.value);
                  setMediaPreferences({ videoDeviceId: e.target.value });
                  acquireStream({ videoDeviceId: e.target.value, audioDeviceId });
                }}
                className="w-full rounded-lg border border-brand-border px-2 py-1.5 text-sm"
              >
                {videoDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || "Camera"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-brand-muted">Microphone</label>
              <select
                value={audioDeviceId}
                onChange={(e) => {
                  setAudioDeviceId(e.target.value);
                  setMediaPreferences({ audioDeviceId: e.target.value });
                  acquireStream({ videoDeviceId, audioDeviceId: e.target.value });
                }}
                className="w-full rounded-lg border border-brand-border px-2 py-1.5 text-sm"
              >
                {audioDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || "Microphone"}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-brand-text">Your name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!nameEditable}
            placeholder="Your name"
            className="w-full rounded-[10px] border border-brand-border px-4 py-3 text-sm disabled:bg-slate-50 disabled:text-brand-muted"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || (nameEditable && !name.trim())}
          className="mt-4 w-full rounded-full bg-brand-blue py-3 text-center text-sm font-bold text-white transition-colors hover:bg-brand-blue-dark disabled:opacity-50"
        >
          {submitting ? "Joining..." : "Join now"}
        </button>
      </form>
    </div>
  );
}
