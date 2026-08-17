import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Track } from "livekit-client";
import { Check, Link2, Users, X } from "lucide-react";
import { Wordmark } from "../components/brand/Wordmark";
import { AdjustViewPanel } from "../components/meeting/AdjustViewPanel";
import { CaptionsOverlay } from "../components/meeting/CaptionsOverlay";
import { ChatPanel } from "../components/meeting/ChatPanel";
import { CodeEditorPanel } from "../components/meeting/CodeEditorPanel";
import { ConnectionQualityIcon } from "../components/meeting/ConnectionQualityIcon";
import { Controls } from "../components/meeting/Controls";
import type { SidePanel } from "../components/meeting/Controls";
import { CostCounter } from "../components/meeting/CostCounter";
import { HostControlsPanel } from "../components/meeting/HostControlsPanel";
import { IconRail } from "../components/meeting/IconRail";
import { JoinRequestPopup } from "../components/meeting/JoinRequestPopup";
import { JoinRequestsPanel } from "../components/meeting/JoinRequestsPanel";
import { LayoutRenderer } from "../components/meeting/layout/LayoutRenderer";
import { MeetingTimer } from "../components/meeting/MeetingTimer";
import { NotificationToast } from "../components/meeting/NotificationToast";
import { ParticipantList } from "../components/meeting/ParticipantList";
import { RecordingIndicator } from "../components/meeting/RecordingIndicator";
import { PreJoinLobby } from "../components/meeting/PreJoinLobby";
import { ReactionOverlay } from "../components/meeting/ReactionOverlay";
import { VideoTile } from "../components/meeting/VideoTile";
import { VirtualOfficePanel } from "../components/meeting/VirtualOfficePanel";
import { WatermarkOverlay } from "../components/meeting/WatermarkOverlay";
import { WhiteboardPanel } from "../components/meeting/WhiteboardPanel";
import { useAdjustViewSettings } from "../hooks/useAdjustViewSettings";
import { useAuth } from "../hooks/useAuth";
import type { AvatarPosition } from "../hooks/useMeeting";
import { useMeeting, VIRTUAL_OFFICE_DEFAULT_POSITION, VIRTUAL_OFFICE_HEARING_RADIUS } from "../hooks/useMeeting";
import { copyRichToClipboard } from "../lib/clipboard";
import { buildInviteMessage } from "../lib/meetingInviteMessage";
import { getEffectiveGuestId } from "../lib/guestId";
import * as api from "../services/api";

interface GuestNavState {
  guestName?: string;
  passcode?: string;
}

function computeGainPan(mine: AvatarPosition, other: AvatarPosition): { gain: number; pan: number } {
  const dx = other.x - mine.x;
  const dy = other.y - mine.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const gain = Math.max(0, 1 - distance / VIRTUAL_OFFICE_HEARING_RADIUS);
  const pan = Math.max(-1, Math.min(1, dx / VIRTUAL_OFFICE_HEARING_RADIUS));
  return { gain, pan };
}

function CenteredScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-bg flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <Wordmark size="sm" />
      {children}
    </div>
  );
}

export function MeetingRoomPage() {
  const { meetingCode = "" } = useParams<{ meetingCode: string }>();
  const { user, accessToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const guestState = location.state as GuestNavState | null;
  const guestId = useMemo(() => (user ? null : getEffectiveGuestId()), [user]);
  const [meetingInfo, setMeetingInfo] = useState<api.MeetingInfo | null>(null);
  const [shouldJoin, setShouldJoin] = useState(false);
  const [chosenName, setChosenName] = useState(guestState?.guestName?.trim() ?? "");
  const [joinMicEnabled, setJoinMicEnabled] = useState(true);
  const [joinCameraEnabled, setJoinCameraEnabled] = useState(true);
  const lobbyStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    api.getMeeting(meetingCode).then(setMeetingInfo).catch(() => undefined);
  }, [meetingCode]);

  // Keep this referentially stable across renders — useMeeting's join
  // effect depends on it, and a fresh object every render would tear down
  // and reconnect the room in an infinite loop.
  const currentUser = useMemo(() => {
    if (user) return { id: user.id, name: user.name };
    if (shouldJoin && chosenName.trim() && guestId) {
      return { id: `guest-${guestId}`, name: chosenName.trim() };
    }
    return null;
  }, [user, shouldJoin, chosenName, guestId]);
  const [linkCopied, setLinkCopied] = useState(false);
  const [activePanel, setActivePanel] = useState<SidePanel>(null);
  const [showAdjustView, setShowAdjustView] = useState(false);
  const adjustViewTriggerRef = useRef<HTMLButtonElement>(null);
  const adjustView = useAdjustViewSettings();
  const {
    room,
    connected,
    remoteParticipants,
    participants,
    messages,
    isMuted,
    isCameraOn,
    isScreenSharing,
    screenShareParticipantIdentity,
    isRecording,
    recordingStartedAt,
    hourlyRate,
    startedAt,
    title,
    connectionQuality,
    activeView,
    setActiveView,
    meetingEnded,
    finalCost,
    error,
    paymentRequired,
    payAndJoin,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    toggleRecording,
    sendMessage,
    sendPrivateMessage,
    askAI,
    captionsEnabled,
    captionLanguage,
    captions,
    toggleCaptions,
    setCaptionLanguage,
    socket,
    ydoc,
    audioContext,
    avatarPositions,
    myAvatarPosition,
    whiteboardHistoryRef,
    moveAvatar,
    waitingForApproval,
    joinDenied,
    joinRequests,
    respondToJoinRequest,
    notifications,
    pushNotification,
    mediaRestrictions,
    setParticipantMedia,
    raisedHands,
    toggleHandRaise,
    reactions,
    sendReaction,
    pinnedUserId,
    setPinnedParticipant,
    kickParticipant,
    kicked,
    hostControls,
    updateHostControls,
    leave,
    endMeetingForAll,
  } = useMeeting(
    meetingCode,
    accessToken,
    currentUser,
    guestId,
    guestState?.passcode,
    shouldJoin,
    joinMicEnabled,
    joinCameraEnabled,
    lobbyStreamRef.current,
  );

  async function handleLeave() {
    await leave();
    navigate("/");
  }

  async function handleEndMeeting() {
    await endMeetingForAll();
  }

  const isHost = participants.find((p) => p.userId === currentUser?.id)?.role === "host";
  // The host's own actions are never restricted by their own delegated
  // toggles — these derived flags are what everyone else's UI reads.
  const canManageJoinRequests = isHost || hostControls.participantsCanAdmitOrRemove;
  const canChat = isHost || hostControls.participantsCanChat;
  const canReact = isHost || hostControls.participantsCanReact;

  async function handleCopyInviteLink() {
    const inviteLink = `${window.location.origin}/meeting/${meetingCode}`;
    const hostName = participants.find((p) => p.role === "host")?.name ?? currentUser?.name ?? "Someone";
    const { text, html } = buildInviteMessage({ title, hostName, link: inviteLink });
    await copyRichToClipboard(text, html);
    setLinkCopied(true);
    pushNotification("Invite link copied to clipboard");
    setTimeout(() => setLinkCopied(false), 2000);
  }

  if (!shouldJoin) {
    return (
      <PreJoinLobby
        meetingTitle={meetingInfo?.title ?? ""}
        initialName={user?.name ?? guestState?.guestName ?? ""}
        nameEditable={!user}
        submitting={false}
        onJoin={({ name, micEnabled, cameraEnabled, stream }) => {
          lobbyStreamRef.current = stream;
          setChosenName(name);
          setJoinMicEnabled(micEnabled);
          setJoinCameraEnabled(cameraEnabled);
          setShouldJoin(true);
        }}
      />
    );
  }

  if (waitingForApproval) {
    return (
      <CenteredScreen>
        <p className="text-brand-muted">Waiting for the host to let you in...</p>
      </CenteredScreen>
    );
  }

  if (joinDenied) {
    return (
      <CenteredScreen>
        <p className="text-brand-danger">The host declined your request to join.</p>
        <button
          onClick={() => navigate("/")}
          className="rounded-full bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-dark"
        >
          Back to imeet
        </button>
      </CenteredScreen>
    );
  }

  if (kicked) {
    return (
      <CenteredScreen>
        <p className="text-brand-danger">You were removed from the meeting by the host.</p>
        <button
          onClick={() => navigate("/")}
          className="rounded-full bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-dark"
        >
          Back to imeet
        </button>
      </CenteredScreen>
    );
  }

  if (meetingEnded) {
    return (
      <CenteredScreen>
        <h1 className="text-xl font-semibold text-brand-text">Meeting ended</h1>
        {finalCost !== null && finalCost > 0 && (
          <p className="text-lg text-brand-green">
            Total cost: <span className="font-mono">${finalCost.toFixed(2)}</span>
          </p>
        )}
        <button
          onClick={() => navigate("/")}
          className="rounded-full bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-dark"
        >
          Back to imeet
        </button>
      </CenteredScreen>
    );
  }

  if (paymentRequired) {
    return (
      <CenteredScreen>
        <p className="text-brand-text">
          This meeting requires a{" "}
          <span className="font-mono">${(paymentRequired.priceCents / 100).toFixed(2)}</span> payment to join.
        </p>
        <button
          onClick={payAndJoin}
          className="rounded-full bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-dark"
        >
          Pay & Join
        </button>
      </CenteredScreen>
    );
  }

  if (error) {
    return (
      <CenteredScreen>
        <p className="text-brand-danger">{error}</p>
      </CenteredScreen>
    );
  }

  if (!connected) {
    return (
      <CenteredScreen>
        <p className="text-brand-muted">Joining meeting...</p>
      </CenteredScreen>
    );
  }

  const localIdentity = room.localParticipant.identity;
  const isLocalScreenShare = screenShareParticipantIdentity === localIdentity;
  const screenShareRemoteParticipant = remoteParticipants.find(
    (p) => p.identity === screenShareParticipantIdentity,
  );
  const isVideoStrip = activeView === "whiteboard" || activeView === "code";
  // A host-pinned participant gets spotlighted (large tile) whenever there's
  // no screen share to compete with — screen share always takes visual
  // priority since that's usually the reason someone's presenting.
  const pinnedIsLocal = pinnedUserId !== null && pinnedUserId === currentUser?.id;
  const pinnedRemoteParticipant =
    pinnedUserId && !pinnedIsLocal ? remoteParticipants.find((p) => p.identity === pinnedUserId) : undefined;
  const showPinnedSpotlight =
    !screenShareParticipantIdentity && Boolean(pinnedUserId) && (pinnedIsLocal || Boolean(pinnedRemoteParticipant));
  const gridRemoteParticipants = pinnedUserId
    ? remoteParticipants.filter((p) => p.identity !== pinnedUserId)
    : remoteParticipants;
  const showLocalInGrid = !(showPinnedSpotlight && pinnedIsLocal);
  // Only the plain "video" tab needs the full Adjust View layout system —
  // Whiteboard/Code's compact strip and Virtual Office's hidden-but-mounted
  // (for its own spatial audio panning) grid keep their existing, simpler
  // rendering untouched.
  const isPlainVideoTab = activeView === "video";
  // A plain computation, not useMemo — this sits after several conditional
  // early `return`s above, where hooks can no longer be called.
  const participantNames = Object.fromEntries(participants.map((p) => [p.userId, p.name]));

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-2.5">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="truncate text-sm font-semibold uppercase tracking-wide text-brand-text">
            {title || "Untitled Meeting"}
          </span>
          <MeetingTimer />
          <CostCounter hourlyRate={hourlyRate} startedAt={startedAt} participantCount={participants.length} />
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {isRecording && <RecordingIndicator startedAt={recordingStartedAt} />}
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-border bg-white"
            title={`Connection quality: ${connectionQuality ?? "unknown"}`}
          >
            <ConnectionQualityIcon quality={connectionQuality} />
          </span>
          <span
            className="flex h-9 items-center gap-1.5 rounded-full border border-brand-border bg-white px-3 text-xs font-medium text-brand-text"
            title="Participants"
          >
            <Users className="h-4 w-4 text-brand-blue" />
            {participants.length}
          </span>
          <button
            onClick={handleCopyInviteLink}
            aria-label={linkCopied ? "Invite link copied" : "Copy invite link"}
            title={linkCopied ? "Copied!" : "Copy invite link"}
            className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
              linkCopied
                ? "border-brand-green bg-brand-green/10 text-brand-green"
                : "border-brand-border bg-white text-brand-text hover:bg-slate-50"
            }`}
          >
            {linkCopied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="relative flex flex-1 overflow-hidden">
        <IconRail activeView={activeView} onChangeView={setActiveView} isHost={isHost} onNotify={pushNotification} />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {activeView === "whiteboard" && (
            <div className="flex-1 overflow-hidden">
              <WhiteboardPanel socket={socket} meetingCode={meetingCode} historyRef={whiteboardHistoryRef} />
            </div>
          )}
          {activeView === "code" && (
            <div className="flex-1 overflow-hidden">
              <CodeEditorPanel ydoc={ydoc} />
            </div>
          )}
          {activeView === "virtual-office" && (
            <div className="flex-1 overflow-hidden">
              <VirtualOfficePanel
                myName={currentUser?.name ?? "You"}
                myPosition={myAvatarPosition}
                remoteAvatars={remoteParticipants.map((p) => ({
                  userId: p.identity,
                  name: participants.find((pp) => pp.userId === p.identity)?.name ?? p.identity,
                  position: avatarPositions[p.identity] ?? VIRTUAL_OFFICE_DEFAULT_POSITION,
                }))}
                onMove={moveAvatar}
              />
            </div>
          )}

          {/* Camera/screen-share stays mounted (and audible) at all times —
              full grid on the Video tab, a scrollable strip alongside
              Whiteboard/Code so presenting or sketching never hides
              everyone's video, and CSS-hidden (not unmounted, so Virtual
              Office's spatial audio panning keeps working) on that tab. */}
          <div
            className={
              activeView === "video"
                ? "relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-6 py-2"
                : activeView === "virtual-office"
                  ? "hidden"
                  : "relative flex h-28 flex-shrink-0 gap-2 overflow-x-auto border-t border-brand-border bg-white p-2"
            }
          >
            {activeView === "video" && user && <WatermarkOverlay name={user.name} email={user.email} />}
            {!isPlainVideoTab && screenShareParticipantIdentity && (
              <div className={isVideoStrip ? "h-full w-48 flex-shrink-0" : "flex-[3]"}>
                {isLocalScreenShare && (
                  <VideoTile
                    participant={room.localParticipant}
                    name={`${currentUser?.name} (You) — sharing screen`}
                    isLocal
                    videoSource={Track.Source.ScreenShare}
                  />
                )}
                {screenShareRemoteParticipant && (
                  <VideoTile
                    participant={screenShareRemoteParticipant}
                    name={`${
                      participants.find((p) => p.userId === screenShareRemoteParticipant.identity)?.name ??
                      screenShareRemoteParticipant.identity
                    } — sharing screen`}
                    videoSource={Track.Source.ScreenShare}
                  />
                )}
              </div>
            )}
            {!isPlainVideoTab && showPinnedSpotlight && (
              <div className={isVideoStrip ? "h-full w-48 flex-shrink-0" : "flex-[3]"}>
                {pinnedIsLocal ? (
                  <VideoTile
                    participant={room.localParticipant}
                    name={`${currentUser?.name} (You)`}
                    isLocal
                    isPinned
                    isHandRaised={raisedHands.includes(currentUser?.id ?? "")}
                  />
                ) : (
                  <VideoTile
                    participant={pinnedRemoteParticipant!}
                    name={
                      participants.find((p) => p.userId === pinnedRemoteParticipant!.identity)?.name ??
                      pinnedRemoteParticipant!.identity
                    }
                    audioContext={audioContext}
                    isPinned
                    isHandRaised={raisedHands.includes(pinnedRemoteParticipant!.identity)}
                  />
                )}
              </div>
            )}
            {isPlainVideoTab ? (
              <LayoutRenderer
                room={room}
                remoteParticipants={remoteParticipants}
                participantNames={participantNames}
                currentUserName={currentUser?.name ?? "You"}
                screenShareParticipantIdentity={screenShareParticipantIdentity}
                hostPinnedId={pinnedUserId}
                adjustView={adjustView}
                onOpenParticipantList={() => setActivePanel("participants")}
              />
            ) : isVideoStrip ? (
              <>
                {showLocalInGrid && (
                  <div className="h-full w-40 flex-shrink-0">
                    <VideoTile
                      participant={room.localParticipant}
                      name={`${currentUser?.name} (You)`}
                      isLocal
                      isHandRaised={raisedHands.includes(currentUser?.id ?? "")}
                    />
                  </div>
                )}
                {gridRemoteParticipants.map((participant) => (
                  <div key={participant.identity} className="h-full w-40 flex-shrink-0">
                    <VideoTile
                      participant={participant}
                      name={participants.find((p) => p.userId === participant.identity)?.name ?? participant.identity}
                      audioContext={audioContext}
                      isHandRaised={raisedHands.includes(participant.identity)}
                    />
                  </div>
                ))}
              </>
            ) : (
              <div
                className="mx-auto grid min-h-0 w-full max-w-[1150px] flex-1 auto-rows-fr gap-2"
                style={{
                  // CSS-driven column count instead of a fixed JS-computed
                  // one — naturally collapses to a single column on a
                  // narrow phone (portrait or landscape) and adds columns
                  // back as the available width grows, with no resize
                  // listener needed.
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
                }}
              >
                {showLocalInGrid && (
                  <VideoTile
                    participant={room.localParticipant}
                    name={`${currentUser?.name} (You)`}
                    isLocal
                    isHandRaised={raisedHands.includes(currentUser?.id ?? "")}
                  />
                )}
                {gridRemoteParticipants.map((participant) => {
                  const spatial =
                    activeView === "virtual-office"
                      ? computeGainPan(
                          myAvatarPosition,
                          avatarPositions[participant.identity] ?? VIRTUAL_OFFICE_DEFAULT_POSITION,
                        )
                      : { gain: 1, pan: 0 };
                  return (
                    <VideoTile
                      key={participant.identity}
                      participant={participant}
                      name={participants.find((p) => p.userId === participant.identity)?.name ?? participant.identity}
                      audioContext={audioContext}
                      gain={spatial.gain}
                      pan={spatial.pan}
                      isHandRaised={raisedHands.includes(participant.identity)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {/* Balances the icon rail's width on the other side so the camera
            sits truly centered on screen when no panel is open — without
            this, the rail alone would pull the video's centered position
            visibly left. Not shown once a panel is open, since then the
            video is meant to expand toward it instead. */}
        {/* Only on md+ — on a narrow phone screen there's no width to spare
            for pure centering, and the icon rail itself is a smaller
            fraction of the screen there anyway. */}
        {!activePanel && <div className="hidden flex-shrink-0 md:block md:w-[96px]" aria-hidden="true" />}
        <div
          className={`fixed inset-0 z-40 flex flex-col gap-3 bg-white p-3 transition-transform duration-300 ease-in-out md:relative md:inset-auto md:z-auto md:flex-shrink-0 md:overflow-hidden md:p-0 md:transition-[width,opacity] md:duration-300 md:ease-in-out ${
            activePanel
              ? "translate-x-0 md:w-[26rem] md:py-3 md:pl-2 md:pr-3 md:opacity-100"
              : "pointer-events-none translate-x-full md:w-0 md:opacity-0"
          }`}
        >
          <button
            type="button"
            onClick={() => setActivePanel(null)}
            aria-label="Close panel"
            className="flex h-8 w-8 items-center justify-center self-end rounded-full border border-brand-border bg-white text-brand-text hover:bg-slate-50 md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
          {activePanel === "participants" && (
            <div className="min-h-0 flex-1">
              <ParticipantList
                participants={participants}
                screenSharingUserId={screenShareParticipantIdentity}
                isHost={isHost}
                currentUserId={currentUser?.id}
                mediaRestrictions={mediaRestrictions}
                onSetParticipantMedia={setParticipantMedia}
                raisedHands={raisedHands}
                pinnedUserId={pinnedUserId}
                onPinParticipant={setPinnedParticipant}
                onKickParticipant={kickParticipant}
                canMuteOthers={hostControls.participantsCanMuteOthers}
                canAdmitOrRemove={hostControls.participantsCanAdmitOrRemove}
                personalSpotlightId={adjustView.pinnedId}
                onPersonalSpotlight={adjustView.togglePin}
              />
            </div>
          )}
          {activePanel === "chat" && (
            <div className="min-h-0 flex-1">
              <ChatPanel
                messages={messages}
                participants={participants}
                currentUserId={currentUser?.id}
                onSend={sendMessage}
                onSendPrivate={sendPrivateMessage}
                onAskAI={askAI}
                canSend={canChat}
              />
            </div>
          )}
          {activePanel === "requests" && (
            <div className="min-h-0 flex-1">
              <JoinRequestsPanel requests={joinRequests} onRespond={respondToJoinRequest} />
            </div>
          )}
          {activePanel === "hostControls" && (
            <div className="min-h-0 flex-1">
              <HostControlsPanel settings={hostControls} onChange={updateHostControls} />
            </div>
          )}
        </div>
      </div>
      <CaptionsOverlay captions={captions} language={captionLanguage} />
      <NotificationToast notifications={notifications} />
      <ReactionOverlay reactions={reactions} />
      {canManageJoinRequests && <JoinRequestPopup requests={joinRequests} onRespond={respondToJoinRequest} />}
      <Controls
        isMuted={isMuted}
        isCameraOn={isCameraOn}
        isScreenSharing={isScreenSharing}
        screenShareDisabled={
          (!isScreenSharing && screenShareParticipantIdentity !== null) ||
          Boolean(mediaRestrictions[currentUser?.id ?? ""]?.includes("screen_share"))
        }
        micDisabledByHost={Boolean(mediaRestrictions[currentUser?.id ?? ""]?.includes("microphone"))}
        cameraDisabledByHost={Boolean(mediaRestrictions[currentUser?.id ?? ""]?.includes("camera"))}
        isRecording={isRecording}
        isHost={isHost}
        canManageJoinRequests={canManageJoinRequests}
        canReact={canReact}
        isHandRaised={raisedHands.includes(currentUser?.id ?? "")}
        captionsEnabled={captionsEnabled}
        captionLanguage={captionLanguage}
        onCaptionLanguageChange={setCaptionLanguage}
        participantsCount={participants.length}
        joinRequestsCount={joinRequests.length}
        activePanel={activePanel}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onToggleScreenShare={toggleScreenShare}
        onToggleRecording={toggleRecording}
        onToggleCaptions={toggleCaptions}
        onToggleHandRaise={toggleHandRaise}
        onSendReaction={sendReaction}
        onToggleParticipants={() => setActivePanel((p) => (p === "participants" ? null : "participants"))}
        onToggleChat={() => setActivePanel((p) => (p === "chat" ? null : "chat"))}
        onToggleRequests={() => setActivePanel((p) => (p === "requests" ? null : "requests"))}
        onToggleHostControls={() => setActivePanel((p) => (p === "hostControls" ? null : "hostControls"))}
        onOpenAdjustView={() => setShowAdjustView(true)}
        moreButtonRef={adjustViewTriggerRef}
        onNotify={pushNotification}
        onLeave={handleLeave}
        onEndMeeting={handleEndMeeting}
      />
      <AdjustViewPanel
        open={showAdjustView}
        onClose={() => setShowAdjustView(false)}
        mode={adjustView.mode}
        onModeChange={adjustView.setMode}
        maxTiles={adjustView.maxTiles}
        onMaxTilesChange={adjustView.setMaxTiles}
        deviceNote={adjustView.deviceNote}
        triggerRef={adjustViewTriggerRef}
      />
    </div>
  );
}
