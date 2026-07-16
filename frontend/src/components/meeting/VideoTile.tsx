import { useEffect, useRef } from "react";
import {
  LocalParticipant,
  ParticipantEvent,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Track,
} from "livekit-client";

interface VideoTileProps {
  participant: LocalParticipant | RemoteParticipant;
  name: string;
  isLocal?: boolean;
  videoSource?: Track.Source;
  audioContext?: AudioContext;
  gain?: number;
  pan?: number;
}

export function VideoTile({
  participant,
  name,
  isLocal = false,
  videoSource = Track.Source.Camera,
  audioContext,
  gain = 1,
  pan = 0,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const pannerNodeRef = useRef<StereoPannerNode | null>(null);
  const audioGraphCreatedRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;

    function attachExisting() {
      const videoPub = participant.getTrackPublication(videoSource);
      if (videoPub?.track && video) {
        videoPub.track.attach(video);
      }
      const audioPub = participant.getTrackPublication(Track.Source.Microphone);
      if (!isLocal && audioPub?.track && audio) {
        audioPub.track.attach(audio);
      }
    }

    attachExisting();

    function handleTrackEvent(track: RemoteTrack, publication: RemoteTrackPublication) {
      if (publication.source === videoSource && video) {
        track.attach(video);
      } else if (publication.source === Track.Source.Microphone && !isLocal && audio) {
        track.attach(audio);
      }
    }

    function handleLocalTrackEvent() {
      attachExisting();
    }

    participant.on(ParticipantEvent.TrackSubscribed, handleTrackEvent);
    participant.on(ParticipantEvent.LocalTrackPublished, handleLocalTrackEvent);

    return () => {
      participant.off(ParticipantEvent.TrackSubscribed, handleTrackEvent);
      participant.off(ParticipantEvent.LocalTrackPublished, handleLocalTrackEvent);
      participant.getTrackPublication(videoSource)?.track?.detach();
      participant.getTrackPublication(Track.Source.Microphone)?.track?.detach();
    };
  }, [participant, isLocal, videoSource]);

  useEffect(() => {
    if (isLocal || !audioContext || !audioRef.current || audioGraphCreatedRef.current) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocal, audioContext]);

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = gain;
    }
    if (pannerNodeRef.current) {
      pannerNodeRef.current.pan.value = pan;
    }
  }, [gain, pan]);

  return (
    <div className="relative aspect-video overflow-hidden rounded bg-gray-800">
      <video ref={videoRef} autoPlay playsInline muted={isLocal} className="h-full w-full object-cover" />
      {!isLocal && <audio ref={audioRef} autoPlay />}
      <span className="absolute bottom-1 left-1 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
        {name}
      </span>
    </div>
  );
}
