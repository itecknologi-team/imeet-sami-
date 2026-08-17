import { useMemo } from "react";
import { Track } from "livekit-client";
import type { LocalParticipant, RemoteParticipant, Room } from "livekit-client";
import { useActiveSpeaker } from "../../../hooks/useActiveSpeaker";
import type { AdjustViewReturn } from "../../../hooks/useAdjustViewSettings";
import { ParticipantTile } from "./ParticipantTile";
import { FilmstripLayout } from "./FilmstripLayout";
import type { ScreenShareInfo } from "./FilmstripLayout";
import { TiledLayout } from "./TiledLayout";
import { LegacyLayout } from "./LegacyLayout";
import { SpotlightLayout } from "./SpotlightLayout";
import { SidebarLayout } from "./SidebarLayout";
import type { LayoutParticipant } from "./types";

interface LayoutRendererProps {
  room: Room;
  remoteParticipants: RemoteParticipant[];
  participantNames: Record<string, string>;
  currentUserName: string;
  screenShareParticipantIdentity: string | null;
  /** Host-broadcast pin (existing room-wide "spotlight for everyone" feature) — always outranks this viewer's own personal spotlight choice. */
  hostPinnedId: string | null;
  adjustView: AdjustViewReturn;
  onOpenParticipantList: () => void;
}

// Central switchboard: builds the unified participant view-model once, runs
// active-speaker detection once, resolves who's on "stage" once (pin >
// screen share > active speaker), then hands off to whichever layout
// component the mode calls for. Individual layout components stay dumb
// renderers — all the "who goes where" decisions live here.
export function LayoutRenderer({
  room,
  remoteParticipants,
  participantNames,
  currentUserName,
  screenShareParticipantIdentity,
  hostPinnedId,
  adjustView,
  onOpenParticipantList,
}: LayoutRendererProps) {
  const localParticipant = room.localParticipant;
  const localId = localParticipant.identity;

  const allLiveKitParticipants = useMemo(
    () => [localParticipant as LocalParticipant | RemoteParticipant, ...remoteParticipants],
    [localParticipant, remoteParticipants],
  );
  const activeSpeakerId = useActiveSpeaker(allLiveKitParticipants, localId);

  const layoutParticipants: LayoutParticipant[] = useMemo(
    () =>
      allLiveKitParticipants.map((p) => ({
        id: p.identity,
        name: p.identity === localId ? `${currentUserName} (You)` : (participantNames[p.identity] ?? p.identity),
        participant: p,
        isLocal: p.identity === localId,
        isSpeaking: p.identity === activeSpeakerId,
      })),
    [allLiveKitParticipants, localId, currentUserName, participantNames, activeSpeakerId],
  );

  // Host broadcast pin always wins over this viewer's own personal spotlight
  // choice — see the comment on useAdjustViewSettings for why they're two
  // separate concepts.
  const effectivePinnedId = hostPinnedId ?? adjustView.pinnedId;

  const screenShare: ScreenShareInfo | null = useMemo(() => {
    if (!screenShareParticipantIdentity) return null;
    const participant = allLiveKitParticipants.find((p) => p.identity === screenShareParticipantIdentity);
    if (!participant) return null;
    const name =
      screenShareParticipantIdentity === localId
        ? `${currentUserName} (You)`
        : (participantNames[screenShareParticipantIdentity] ?? screenShareParticipantIdentity);
    return { participant, name: `${name} — sharing screen` };
  }, [screenShareParticipantIdentity, allLiveKitParticipants, localId, currentUserName, participantNames]);

  // Stage priority for the single-stage layouts: explicit pin > active
  // speaker > whoever's first (screen share, when present, is handled
  // separately by each layout component and always wins over this).
  const stageParticipantId =
    (effectivePinnedId && layoutParticipants.some((p) => p.id === effectivePinnedId) ? effectivePinnedId : null) ??
    activeSpeakerId ??
    layoutParticipants[0]?.id ??
    null;

  function handleSpotlight(participantId: string) {
    adjustView.togglePin(participantId);
  }

  // Tiled/Legacy have no separate "stage" concept of their own, so a screen
  // share is represented as one more (synthetic) tile in their normal list
  // instead of needing special-cased rendering paths.
  const participantsWithSyntheticShare: LayoutParticipant[] = useMemo(() => {
    if (!screenShare) return layoutParticipants;
    const shareTile: LayoutParticipant = {
      id: `${screenShare.participant.identity}__screen`,
      name: screenShare.name,
      participant: screenShare.participant,
      isLocal: screenShare.participant.identity === localId,
      isSpeaking: false,
      videoSource: Track.Source.ScreenShare,
    };
    return [shareTile, ...layoutParticipants];
  }, [screenShare, layoutParticipants, localId]);

  const mode =
    adjustView.mode !== "auto"
      ? adjustView.mode
      : screenShare
        ? "auto-filmstrip"
        : layoutParticipants.length <= 1
          ? "auto-solo"
          : layoutParticipants.length === 2
            ? "auto-two"
            : "auto-filmstrip";

  if (mode === "auto-solo") {
    const local = layoutParticipants[0];
    // Same cap the old grid used (max-w-[1150px], centered) — full height,
    // but not stretched edge-to-edge on wide screens.
    return (
      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <div className="relative mx-auto h-full w-full max-w-[1150px]">
          {local && (
            <ParticipantTile
              id={local.id}
              participant={local.participant}
              name={local.name}
              isLocal
              isSpeaking={local.isSpeaking}
              variant="stage"
            />
          )}
          {/* Vertically centered rather than bottom-anchored so it never
              competes with the name pill / watermark for the same corner
              on a narrow phone screen. */}
          <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-black/45 px-3 py-1.5 text-xs text-white backdrop-blur-sm">
            Waiting for others to join
          </p>
        </div>
      </div>
    );
  }

  if (mode === "auto-two") {
    // Exactly 2 participants: a guaranteed 50/50 split divided by a vertical
    // line (two equal side-by-side columns) — deliberately NOT the generic
    // auto-fit grid engine, which could pick a stacked 1x2 on a narrow/tall
    // container. Two people always get the same left/right split.
    return (
      <div className="flex min-h-0 w-full flex-1 gap-[var(--meeting-gap)]">
        {layoutParticipants.map((p) => (
          <div key={p.id} className="meeting-layout-transition min-h-0 min-w-0 flex-1">
            <ParticipantTile
              id={p.id}
              participant={p.participant}
              name={p.name}
              isLocal={p.isLocal}
              isSpeaking={p.isSpeaking}
              isPinned={effectivePinnedId === p.id}
              onSpotlight={handleSpotlight}
            />
          </div>
        ))}
      </div>
    );
  }

  if (mode === "auto-filmstrip") {
    return (
      <FilmstripLayout
        participants={layoutParticipants}
        stageParticipantId={stageParticipantId}
        activeSpeakerId={activeSpeakerId}
        maxTiles={adjustView.maxTiles}
        pinnedId={effectivePinnedId}
        onSpotlight={handleSpotlight}
        // Clicking the strip's overflow "+N" tile expands to Tiled (equal-size
        // tiles for everyone) rather than opening the participant list —
        // that's the "tap it to see everyone the same size" behaviour.
        onOpenParticipantList={() => adjustView.setMode("tiled")}
        screenShare={screenShare}
      />
    );
  }

  switch (mode) {
    case "tiled":
      return (
        <TiledLayout
          participants={participantsWithSyntheticShare}
          maxTiles={adjustView.maxTiles}
          pinnedId={screenShare ? `${screenShare.participant.identity}__screen` : effectivePinnedId}
          onSpotlight={handleSpotlight}
          onOpenParticipantList={onOpenParticipantList}
        />
      );
    case "legacy":
      return (
        <LegacyLayout
          participants={participantsWithSyntheticShare}
          pinnedId={screenShare ? `${screenShare.participant.identity}__screen` : effectivePinnedId}
          onSpotlight={handleSpotlight}
        />
      );
    case "spotlight":
      return (
        <SpotlightLayout
          participants={layoutParticipants}
          stageParticipantId={stageParticipantId}
          pinnedId={effectivePinnedId}
          onSpotlight={handleSpotlight}
          screenShare={screenShare}
        />
      );
    case "sidebar":
      return (
        <SidebarLayout
          participants={layoutParticipants}
          stageParticipantId={stageParticipantId}
          maxTiles={adjustView.maxTiles}
          pinnedId={effectivePinnedId}
          collapsed={adjustView.sidebarCollapsed}
          onToggleCollapsed={adjustView.setSidebarCollapsed}
          onSpotlight={handleSpotlight}
          onOpenParticipantList={() => adjustView.setMode("tiled")}
          screenShare={screenShare}
        />
      );
    default:
      return null;
  }
}
