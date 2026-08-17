import { Hand, MicOff, Pin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  LocalParticipant,
  ParticipantEvent,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Track,
} from "livekit-client";
import type { TrackPublication } from "livekit-client";
import { AvatarPlaceholder } from "./AvatarPlaceholder";

interface VideoTileProps {
  participant: LocalParticipant | RemoteParticipant;
  name: string;
  isLocal?: boolean;
  videoSource?: Track.Source;
  audioContext?: AudioContext;
  gain?: number;
  pan?: number;
  isHandRaised?: boolean;
  isPinned?: boolean;
}

function isPublicationLive(pub: TrackPublication | undefined): boolean {
  return Boolean(pub?.track) && !pub?.isMuted;
}

export function VideoTile({
  participant,
  name,
  isLocal = false,
  videoSource = Track.Source.Camera,
  audioContext,
  gain = 1,
  pan = 0,
  isHandRaised = false,
  isPinned = false,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const pannerNodeRef = useRef<StereoPannerNode | null>(null);
  const audioGraphCreatedRef = useRef(false);
  const [hasVideo, setHasVideo] = useState(() => isPublicationLive(participant.getTrackPublication(videoSource)));
  const [hasAudio, setHasAudio] = useState(() =>
    isPublicationLive(participant.getTrackPublication(Track.Source.Microphone)),
  );

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

  // Tracked separately from the attach/detach effect above — this drives
  // the "camera is off" avatar placeholder and the "mic is muted" badge,
  // which need to reflect the live on/off state, not just whether a track
  // element is attached.
  useEffect(() => {
    function refresh() {
      setHasVideo(isPublicationLive(participant.getTrackPublication(videoSource)));
      setHasAudio(isPublicationLive(participant.getTrackPublication(Track.Source.Microphone)));
    }
    refresh();

    participant.on(ParticipantEvent.TrackSubscribed, refresh);
    participant.on(ParticipantEvent.TrackUnsubscribed, refresh);
    participant.on(ParticipantEvent.TrackMuted, refresh);
    participant.on(ParticipantEvent.TrackUnmuted, refresh);
    participant.on(ParticipantEvent.LocalTrackPublished, refresh);
    participant.on(ParticipantEvent.LocalTrackUnpublished, refresh);

    return () => {
      participant.off(ParticipantEvent.TrackSubscribed, refresh);
      participant.off(ParticipantEvent.TrackUnsubscribed, refresh);
      participant.off(ParticipantEvent.TrackMuted, refresh);
      participant.off(ParticipantEvent.TrackUnmuted, refresh);
      participant.off(ParticipantEvent.LocalTrackPublished, refresh);
      participant.off(ParticipantEvent.LocalTrackUnpublished, refresh);
    };
  }, [participant, videoSource]);

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
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-gray-800">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        data-video-tile={isLocal ? "local" : "remote"}
        className={`h-full w-full object-cover ${isLocal && videoSource === Track.Source.Camera ? "-scale-x-100" : ""} ${
          hasVideo ? "" : "hidden"
        }`}
      />
      {!hasVideo && <AvatarPlaceholder />}
      {!isLocal && <audio ref={audioRef} autoPlay />}
      {isPinned && (
        <span
          className="absolute left-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-brand-blue text-white shadow-soft"
          aria-label={`${name} is pinned`}
          title="Pinned"
        >
          <Pin className="h-3.5 w-3.5" />
        </span>
      )}
      {isHandRaised && videoSource === Track.Source.Camera && (
        <span
          className="animate-avatar-float absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-brand-orange text-white shadow-soft"
          aria-label={`${name} raised their hand`}
          title="Hand raised"
        >
          <Hand className="h-3.5 w-3.5" />
        </span>
      )}
      {!hasAudio && videoSource === Track.Source.Camera && (
        <span
          className="absolute bottom-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-brand-danger text-white"
          aria-label={`${name} is muted`}
          title="Muted"
        >
          <MicOff className="h-3.5 w-3.5" />
        </span>
      )}
      <span className="absolute bottom-2.5 left-2.5 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
        {name}
      </span>
    </div>
  );
}
