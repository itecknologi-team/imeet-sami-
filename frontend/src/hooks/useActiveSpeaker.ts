import { useEffect, useRef, useState } from "react";
import { Track } from "livekit-client";
import type { LocalParticipant, RemoteParticipant } from "livekit-client";

// LiveKit's Participant.audioLevel is already the "WebRTC audioLevel stat"
// the spec allows as an alternative to a hand-rolled Web Audio API /
// AnalyserNode graph — it's computed internally by LiveKit from real RTC
// audio stats and kept current on a short interval, so standing up a
// parallel AnalyserNode per remote track would just duplicate that work.
// We poll it ourselves at the spec's ~100ms sampling rate and layer our own
// noise floor + sustain/hold debounce on top, since LiveKit doesn't apply
// either of those on its own.
const SAMPLE_INTERVAL_MS = 100;
const NOISE_FLOOR = 0.02;
// A participant must be the loudest candidate continuously for this long
// before they actually take the stage — filters out short crosstalk blips.
const SUSTAIN_MS = 600;
// Once someone is the active speaker, the stage won't hand off to anyone
// else for at least this long, even if a louder candidate appears — this is
// what prevents flicker when two people are talking over each other.
const MIN_HOLD_MS = 2000;

type SpeakerParticipant = LocalParticipant | RemoteParticipant;

export function useActiveSpeaker(participants: SpeakerParticipant[], localIdentity: string): string | null {
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const pendingRef = useRef<{ id: string; since: number } | null>(null);
  const activeSinceRef = useRef(0);
  const activeSpeakerRef = useRef<string | null>(null);
  activeSpeakerRef.current = activeSpeakerId;

  useEffect(() => {
    // With only self in the room there's no one else to spotlight, so self
    // becomes eligible; otherwise self never takes the stage this way.
    const excludeSelf = participants.length > 1;

    const interval = window.setInterval(() => {
      const now = Date.now();
      let loudest: { id: string; level: number } | null = null;

      for (const p of participants) {
        if (excludeSelf && p.identity === localIdentity) continue;
        const micPublication = p.getTrackPublication(Track.Source.Microphone);
        if (!micPublication || micPublication.isMuted) continue;
        const level = p.audioLevel ?? 0;
        if (level < NOISE_FLOOR) continue;
        if (!loudest || level > loudest.level) {
          loudest = { id: p.identity, level };
        }
      }

      if (!loudest) {
        pendingRef.current = null;
        return;
      }

      if (pendingRef.current?.id !== loudest.id) {
        pendingRef.current = { id: loudest.id, since: now };
      }

      const sustained = now - pendingRef.current.since >= SUSTAIN_MS;
      const current = activeSpeakerRef.current;
      const heldLongEnough = now - activeSinceRef.current >= MIN_HOLD_MS;

      if (sustained && loudest.id !== current && (current === null || heldLongEnough)) {
        activeSinceRef.current = now;
        activeSpeakerRef.current = loudest.id;
        setActiveSpeakerId(loudest.id);
      }
    }, SAMPLE_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [participants, localIdentity]);

  // If the current active speaker leaves the room entirely, drop them
  // immediately rather than waiting out the minimum hold on a phantom tile.
  useEffect(() => {
    if (activeSpeakerId && !participants.some((p) => p.identity === activeSpeakerId)) {
      activeSinceRef.current = 0;
      setActiveSpeakerId(null);
    }
  }, [participants, activeSpeakerId]);

  return activeSpeakerId;
}
