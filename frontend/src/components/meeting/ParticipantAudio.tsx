import { useEffect, useRef } from "react";
import { ParticipantEvent, Track } from "livekit-client";
import type { RemoteParticipant, RemoteTrack, RemoteTrackPublication } from "livekit-client";

interface ParticipantAudioProps {
  participant: RemoteParticipant;
  audioContext?: AudioContext;
  gain?: number;
  pan?: number;
}

// Exactly one <audio> element per remote participant, mounted once regardless
// of how many video tiles currently render them (main stage + thumbnail
// strip, a screen-share tile alongside their own camera tile, a pinned
// spotlight alongside the grid, ...). Attaching the mic track once per tile
// instead plays the same live audio out of multiple elements at once —
// audible to everyone as an echo/doubling the moment a tile duplicates,
// which screen sharing always does (the sharer keeps their normal tile
// *and* gets a new screen-share tile).
export function ParticipantAudio({ participant, audioContext, gain = 1, pan = 0 }: ParticipantAudioProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const pannerNodeRef = useRef<StereoPannerNode | null>(null);
  const audioGraphCreatedRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;

    function attachExisting() {
      const pub = participant.getTrackPublication(Track.Source.Microphone);
      if (pub?.track && audio) {
        pub.track.attach(audio);
      }
    }
    attachExisting();

    function handleTrackEvent(track: RemoteTrack, publication: RemoteTrackPublication) {
      if (publication.source === Track.Source.Microphone && audio) {
        track.attach(audio);
      }
    }

    participant.on(ParticipantEvent.TrackSubscribed, handleTrackEvent);

    return () => {
      participant.off(ParticipantEvent.TrackSubscribed, handleTrackEvent);
      participant.getTrackPublication(Track.Source.Microphone)?.track?.detach();
    };
  }, [participant]);

  useEffect(() => {
    if (!audioContext || !audioRef.current || audioGraphCreatedRef.current) return;
    // An HTMLMediaElement can only ever be routed into a Web Audio graph once
    // via createMediaElementSource — calling it twice throws. StrictMode's
    // dev-mode double-invoke (mount -> cleanup -> remount) re-runs this effect
    // body without recreating the <audio> element, so a ref guard (which
    // survives that double-invoke, unlike a plain local variable) is required.
    audioGraphCreatedRef.current = true;

    const source = audioContext.createMediaElementSource(audioRef.current);
    const gainNode = audioContext.createGain();
    const pannerNode = audioContext.createStereoPanner();
    source.connect(gainNode).connect(pannerNode).connect(audioContext.destination);
    gainNodeRef.current = gainNode;
    pannerNodeRef.current = pannerNode;
    audioContext.resume().catch(() => {});
  }, [audioContext]);

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = gain;
    }
    if (pannerNodeRef.current) {
      pannerNodeRef.current.pan.value = pan;
    }
  }, [gain, pan]);

  return <audio ref={audioRef} autoPlay />;
}
