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
}

export function VideoTile({
  participant,
  name,
  isLocal = false,
  videoSource = Track.Source.Camera,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

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
