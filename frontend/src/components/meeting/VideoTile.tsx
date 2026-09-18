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
  isHandRaised = false,
  isPinned = false,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(() => isPublicationLive(participant.getTrackPublication(videoSource)));
  const [hasAudio, setHasAudio] = useState(() =>
    isPublicationLive(participant.getTrackPublication(Track.Source.Microphone)),
  );

  // Audio is NOT handled here — a dedicated ParticipantAudio component is
  // mounted once per remote participant regardless of how many VideoTile
  // instances render them (e.g. a screen-share tile alongside their own
  // camera tile). Attaching the mic per-tile here instead would play the
  // same live audio out of multiple elements at once — an audible
  // echo/doubling the moment a participant appears in more than one tile.
  useEffect(() => {
    const video = videoRef.current;

    function attachExisting() {
      const videoPub = participant.getTrackPublication(videoSource);
      if (videoPub?.track && video) {
        videoPub.track.attach(video);
      }
    }

    attachExisting();

    function handleTrackEvent(track: RemoteTrack, publication: RemoteTrackPublication) {
      if (publication.source === videoSource && video) {
        track.attach(video);
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
    };
  }, [participant, videoSource]);

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
