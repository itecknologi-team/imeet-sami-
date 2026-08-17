import { RoomServiceClient } from "livekit-server-sdk";
import { TrackSource } from "@livekit/protocol";
import { env } from "../../config/env";

const roomService = new RoomServiceClient(
  env.livekitUrl.replace(/^ws/, "http"),
  env.livekitApiKey,
  env.livekitApiSecret,
);

export type MediaKind = "microphone" | "camera" | "screen_share";

const KIND_TO_SOURCE: Record<MediaKind, TrackSource> = {
  microphone: TrackSource.MICROPHONE,
  camera: TrackSource.CAMERA,
  screen_share: TrackSource.SCREEN_SHARE,
};

const ALL_SOURCES = [
  TrackSource.CAMERA,
  TrackSource.MICROPHONE,
  TrackSource.SCREEN_SHARE,
  TrackSource.SCREEN_SHARE_AUDIO,
];

// meetingCode -> identity -> set of sources the host has blocked. Kept here
// (rather than trusting LiveKit's current permission as the source of truth)
// because canPublishSources must be resent in full on every update — we need
// our own record of everything currently blocked to compute the next
// "allow everything except these" list.
const blockedSources = new Map<string, Map<string, Set<TrackSource>>>();

function getBlockedSet(meetingCode: string, identity: string): Set<TrackSource> {
  const meetingMap = blockedSources.get(meetingCode) ?? new Map<string, Set<TrackSource>>();
  blockedSources.set(meetingCode, meetingMap);
  const set = meetingMap.get(identity) ?? new Set<TrackSource>();
  meetingMap.set(identity, set);
  return set;
}

// Chains setBlocked calls per (meetingCode, identity) so overlapping
// requests (rapid host clicks, or a per-participant toggle racing a bulk
// host-controls re-apply) issue their updateParticipant calls to LiveKit in
// the order they were made, instead of two concurrent read-modify-write
// cycles on blockedSources landing out of order and leaving a stale grant.
const pendingChains = new Map<string, Promise<void>>();

// Enforced server-side via LiveKit's own permission grant, not just a
// client-trusted toggle — revoking canPublishSources means the SFU itself
// rejects the track, so the participant can't just ignore the instruction
// and re-publish from their end.
export function setBlocked(
  meetingCode: string,
  identity: string,
  kind: MediaKind,
  blocked: boolean,
): Promise<void> {
  const chainKey = `${meetingCode}:${identity}`;
  const prior = pendingChains.get(chainKey) ?? Promise.resolve();
  const next = prior.then(() => applyBlocked(meetingCode, identity, kind, blocked));
  // Swallowed here so one failed update doesn't poison the chain for the
  // next queued call — the real rejection still propagates to this call's
  // own caller via `next`.
  pendingChains.set(chainKey, next.catch(() => undefined));
  return next;
}

async function applyBlocked(
  meetingCode: string,
  identity: string,
  kind: MediaKind,
  blocked: boolean,
): Promise<void> {
  const source = KIND_TO_SOURCE[kind];
  const blockedSet = getBlockedSet(meetingCode, identity);
  if (blocked) {
    blockedSet.add(source);
  } else {
    blockedSet.delete(source);
  }

  const allowedSources = ALL_SOURCES.filter((s) => !blockedSet.has(s));
  await roomService.updateParticipant(meetingCode, identity, {
    permission: {
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canPublishSources: allowedSources,
    },
  });

  const participant = await roomService.getParticipant(meetingCode, identity).catch(() => null);
  const track = participant?.tracks.find((t) => t.source === source);
  if (blocked) {
    if (track && !track.muted) {
      await roomService.mutePublishedTrack(meetingCode, identity, track.sid, true).catch(() => undefined);
    }
  } else if (track?.muted) {
    // Symmetric with the block branch above: if the participant's track is
    // still published-but-muted (rather than fully unpublished) at the
    // moment they're unblocked, resume it server-side too instead of
    // leaving the whole recovery burden on the client's republish call.
    await roomService.mutePublishedTrack(meetingCode, identity, track.sid, false).catch(() => undefined);
  }
}

export function getRestrictions(meetingCode: string): Record<string, MediaKind[]> {
  const meetingMap = blockedSources.get(meetingCode);
  if (!meetingMap) return {};
  const out: Record<string, MediaKind[]> = {};
  for (const [identity, set] of meetingMap) {
    const kinds = (Object.keys(KIND_TO_SOURCE) as MediaKind[]).filter((k) => set.has(KIND_TO_SOURCE[k]));
    if (kinds.length > 0) {
      out[identity] = kinds;
    }
  }
  return out;
}

export function clear(meetingCode: string): void {
  blockedSources.delete(meetingCode);
}

// Actually disconnects the participant's LiveKit session — kicking someone
// only over the socket would leave their media connection alive, so they'd
// still be seen/heard by everyone until LiveKit's own timeout caught up.
export async function removeParticipant(meetingCode: string, identity: string): Promise<void> {
  await roomService.removeParticipant(meetingCode, identity).catch(() => undefined);
}
