import { memo, useEffect, useRef, useState } from "react";
import {
  RemoteTrackPublication,
  Track,
  VideoQuality,
  ParticipantEvent,
} from "livekit-client";
import type {
  LocalParticipant,
  RemoteParticipant,
  RemoteTrack,
  TrackPublication,
} from "livekit-client";
import { Maximize2, MicOff, Pin, PinOff } from "lucide-react";
import { InitialsAvatar } from "../InitialsAvatar";

interface ParticipantTileProps {
  id: string;
  participant: LocalParticipant | RemoteParticipant;
  name: string;
  isLocal?: boolean;
  videoSource?: Track.Source;
  variant?: "thumbnail" | "stage";
  isSpeaking?: boolean;
  isPinned?: boolean;
  /** false for tiles collapsed into overflow — pauses the remote video subscription and drops it to the lowest simulcast layer to save bandwidth/CPU. */
  subscribed?: boolean;
  onExpand?: () => void;
  onSpotlight?: (participantId: string) => void;
  className?: string;
}

function isPublicationLive(pub: TrackPublication | undefined): boolean {
  return Boolean(pub?.track) && !pub?.isMuted;
}

function ParticipantTileImpl({
  id,
  participant,
  name,
  isLocal = false,
  videoSource = Track.Source.Camera,
  variant = "thumbnail",
  isSpeaking = false,
  isPinned = false,
  subscribed = true,
  onExpand,
  onSpotlight,
  className = "",
}: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasVideo, setHasVideo] = useState(() => isPublicationLive(participant.getTrackPublication(videoSource)));
  const [isMicMuted, setIsMicMuted] = useState(
    () => participant.getTrackPublication(Track.Source.Microphone)?.isMuted ?? true,
  );
  // Speaking-glow fade-out: keep the glow class on for a beat after
  // isSpeaking flips false so CSS can transition it out smoothly instead of
  // the class (and its transition trigger) disappearing instantly.
  const [showGlow, setShowGlow] = useState(isSpeaking);
  const [showMenu, setShowMenu] = useState(false);

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

    function refresh() {
      setHasVideo(isPublicationLive(participant.getTrackPublication(videoSource)));
      setIsMicMuted(participant.getTrackPublication(Track.Source.Microphone)?.isMuted ?? true);
    }

    function handleTrackEvent(track: RemoteTrack, publication: RemoteTrackPublication) {
      if (publication.source === videoSource && video) {
        track.attach(video);
      } else if (publication.source === Track.Source.Microphone && !isLocal && audio) {
        track.attach(audio);
      }
      refresh();
    }
    function handleLocalTrackEvent() {
      attachExisting();
      refresh();
    }

    participant.on(ParticipantEvent.TrackSubscribed, handleTrackEvent);
    participant.on(ParticipantEvent.TrackUnsubscribed, refresh);
    participant.on(ParticipantEvent.TrackMuted, refresh);
    participant.on(ParticipantEvent.TrackUnmuted, refresh);
    participant.on(ParticipantEvent.LocalTrackPublished, handleLocalTrackEvent);
    participant.on(ParticipantEvent.LocalTrackUnpublished, handleLocalTrackEvent);
    refresh();

    return () => {
      participant.off(ParticipantEvent.TrackSubscribed, handleTrackEvent);
      participant.off(ParticipantEvent.TrackUnsubscribed, refresh);
      participant.off(ParticipantEvent.TrackMuted, refresh);
      participant.off(ParticipantEvent.TrackUnmuted, refresh);
      participant.off(ParticipantEvent.LocalTrackPublished, handleLocalTrackEvent);
      participant.off(ParticipantEvent.LocalTrackUnpublished, handleLocalTrackEvent);
      participant.getTrackPublication(videoSource)?.track?.detach();
      participant.getTrackPublication(Track.Source.Microphone)?.track?.detach();
    };
  }, [participant, isLocal, videoSource]);

  // Performance: pause the remote video stream entirely for tiles collapsed
  // into overflow (or not currently visible in the current layout), and
  // request only the lowest simulcast layer for thumbnails vs the full
  // layer for the main stage — renegotiated whenever variant/subscribed
  // change (e.g. this participant gets promoted from strip to stage).
  useEffect(() => {
    if (isLocal) return;
    const pub = participant.getTrackPublication(videoSource);
    if (!(pub instanceof RemoteTrackPublication)) return;
    pub.setEnabled(subscribed);
    if (subscribed) {
      pub.setVideoQuality(variant === "stage" ? VideoQuality.HIGH : VideoQuality.LOW);
    }
  }, [participant, videoSource, isLocal, subscribed, variant]);

  useEffect(() => {
    if (isSpeaking) {
      setShowGlow(true);
      return;
    }
    const timeout = window.setTimeout(() => setShowGlow(false), 550);
    return () => window.clearTimeout(timeout);
  }, [isSpeaking]);

  const pillPadding = variant === "stage" ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs";

  return (
    <div className={`tile-glow h-full w-full rounded-[var(--meeting-radius)] ${showGlow ? "is-speaking" : ""} ${className}`}>
      <div
        className={`group relative h-full w-full overflow-hidden rounded-[var(--meeting-radius)] border border-brand-border bg-gray-800 ${
          variant === "thumbnail" && onSpotlight ? "cursor-pointer" : ""
        }`}
        onMouseLeave={() => setShowMenu(false)}
        // Click anywhere on a thumbnail to promote that participant to the
        // main stage — the pin icon/menu below still exists for the
        // explicit "spotlight"/"remove spotlight" wording, but this is the
        // fast path most people will actually use.
        onClick={variant === "thumbnail" && onSpotlight ? () => onSpotlight(id) : undefined}
        role={variant === "thumbnail" && onSpotlight ? "button" : undefined}
        aria-label={variant === "thumbnail" && onSpotlight ? `Show ${name} on the main stage` : undefined}
      >
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
        {!hasVideo && (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800">
            <InitialsAvatar name={name} size="xl" />
          </div>
        )}
        {!isLocal && <audio ref={audioRef} autoPlay />}

        {isMicMuted && (
          <span
            className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm"
            aria-label={`${name} is muted`}
            title="Muted"
          >
            <MicOff className="h-3.5 w-3.5" />
          </span>
        )}

        {variant === "stage" && onExpand && (
          <button
            type="button"
            onClick={onExpand}
            aria-label="Expand to fullscreen"
            title="Fullscreen"
            className="stage-expand-btn absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm hover:bg-black/60"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}

        {onSpotlight && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu((v) => !v);
            }}
            aria-label={`${name} tile options`}
            className="stage-expand-btn absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm hover:bg-black/60"
            style={variant === "stage" ? { right: "2.75rem" } : undefined}
          >
            {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
        )}
        {showMenu && onSpotlight && (
          <div className="absolute right-2.5 top-11 z-10 w-44 overflow-hidden rounded-lg border border-brand-border bg-white py-1 shadow-soft">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSpotlight(id);
                setShowMenu(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-brand-text hover:bg-slate-50"
            >
              {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              {isPinned ? "Remove spotlight" : "Spotlight this participant"}
            </button>
          </div>
        )}

        {/* Non-colour speaking cue alongside the name pill — see index.css .audio-bar */}
        <div
          className={`absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-full backdrop-blur-sm ${pillPadding}`}
          style={{ background: "var(--meeting-pill-bg)" }}
        >
          {showGlow && (
            <span className="flex h-3 items-end gap-[2px]" aria-hidden="true">
              <span className="audio-bar h-full w-[2.5px] rounded-full bg-white" style={{ animationDelay: "0ms" }} />
              <span className="audio-bar h-full w-[2.5px] rounded-full bg-white" style={{ animationDelay: "150ms" }} />
              <span className="audio-bar h-full w-[2.5px] rounded-full bg-white" style={{ animationDelay: "300ms" }} />
            </span>
          )}
          <span className="truncate font-medium tracking-wide text-white">{name}</span>
        </div>
      </div>
    </div>
  );
}

// Memoized so an active-speaker change (which changes isSpeaking on exactly
// one or two tiles) doesn't force every other tile in the grid to re-render.
export const ParticipantTile = memo(ParticipantTileImpl);
