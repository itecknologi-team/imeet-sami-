import type { LocalParticipant, RemoteParticipant, Track } from "livekit-client";

// One unified view-model per participant, built once by LayoutRenderer from
// useMeeting's raw LiveKit + roster state, and handed down to every layout
// component — so FilmstripLayout/TiledLayout/etc. never have to know about
// participants vs remoteParticipants vs room.localParticipant separately.
export interface LayoutParticipant {
  id: string;
  name: string;
  participant: LocalParticipant | RemoteParticipant;
  isLocal: boolean;
  isSpeaking: boolean;
  /** Defaults to Camera. Set to ScreenShare for the synthetic tile LayoutRenderer prepends when someone's presenting, in modes (Tiled/Legacy) that don't have a separate "stage" concept of their own. */
  videoSource?: Track.Source;
}
