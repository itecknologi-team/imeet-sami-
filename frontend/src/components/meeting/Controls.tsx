import {
  Captions,
  Circle,
  Flag,
  Hand,
  LifeBuoy,
  Maximize,
  MessageSquare,
  Mic,
  MicOff,
  Minimize,
  MonitorUp,
  MoreVertical,
  PhoneOff,
  PictureInPicture2,
  Power,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  SmilePlus,
  UserPlus,
  Users,
  Video,
  VideoOff,
  Wand2,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { CAPTION_LANGUAGES } from "../../lib/captionLanguages";

export type SidePanel = "participants" | "chat" | "requests" | "hostControls" | null;

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "👏", "😮"];

interface ControlsProps {
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  screenShareDisabled: boolean;
  micDisabledByHost?: boolean;
  cameraDisabledByHost?: boolean;
  isRecording: boolean;
  isHost: boolean;
  canManageJoinRequests?: boolean;
  canReact?: boolean;
  isHandRaised: boolean;
  captionsEnabled: boolean;
  captionLanguage: string;
  participantsCount: number;
  joinRequestsCount?: number;
  activePanel: SidePanel;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleRecording: () => void;
  onToggleCaptions: () => void;
  onCaptionLanguageChange: (language: string) => void;
  onToggleHandRaise: () => void;
  onSendReaction: (emoji: string) => void;
  onToggleParticipants: () => void;
  onToggleChat: () => void;
  onToggleRequests?: () => void;
  onToggleHostControls?: () => void;
  onOpenAdjustView?: () => void;
  moreButtonRef?: RefObject<HTMLButtonElement | null>;
  onNotify: (message: string) => void;
  onLeave: () => void;
  onEndMeeting: () => void;
}

function pillClasses(active: boolean, danger = false): string {
  if (danger) return "border-brand-danger/30 bg-brand-danger/10 text-brand-danger";
  return active
    ? "border-brand-blue/30 bg-brand-blue/10 text-brand-blue"
    : "border-brand-border bg-white text-brand-text hover:bg-slate-50";
}

const BUTTON_BASE =
  "flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-150 hover:scale-105 active:scale-95";

const MENU_ITEM_CLASS =
  "relative flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-brand-text transition-colors hover:bg-white/30";

function Divider() {
  return <div className="mx-1 h-9 w-px flex-shrink-0 bg-brand-border" aria-hidden="true" />;
}

export function Controls({
  isMuted,
  isCameraOn,
  isScreenSharing,
  screenShareDisabled,
  micDisabledByHost = false,
  cameraDisabledByHost = false,
  isRecording,
  isHost,
  canManageJoinRequests = false,
  canReact = true,
  isHandRaised,
  captionsEnabled,
  captionLanguage,
  participantsCount,
  joinRequestsCount = 0,
  activePanel,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onToggleRecording,
  onToggleCaptions,
  onCaptionLanguageChange,
  onToggleHandRaise,
  onSendReaction,
  onToggleParticipants,
  onToggleChat,
  onToggleRequests,
  onToggleHostControls,
  onOpenAdjustView,
  moreButtonRef,
  onNotify,
  onLeave,
  onEndMeeting,
}: ControlsProps) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmEndMeeting, setConfirmEndMeeting] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function handleChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  function handleToggleFullscreen() {
    setShowMoreMenu(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else {
      document.documentElement.requestFullscreen().catch(() => onNotify("Could not enter full screen"));
    }
  }

  async function handleTogglePiP() {
    setShowMoreMenu(false);
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return;
      }
      // Prefer whoever else is on camera over your own tile — more useful
      // to keep watching them in the floating window while you multitask.
      const video =
        document.querySelector('video[data-video-tile="remote"]') ??
        document.querySelector('video[data-video-tile="local"]');
      if (!(video instanceof HTMLVideoElement)) {
        onNotify("No video available for picture-in-picture");
        return;
      }
      await video.requestPictureInPicture();
    } catch {
      onNotify("Picture-in-picture isn't supported here");
    }
  }

  function handleStub(label: string) {
    setShowMoreMenu(false);
    onNotify(`${label} — coming soon`);
  }

  return (
    <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 bg-white p-3">
      <div className="hidden w-[92px] sm:block" aria-hidden="true" />

      <div className="mx-auto flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onToggleMute}
          disabled={micDisabledByHost}
          aria-label={micDisabledByHost ? "Microphone muted by host" : isMuted ? "Unmute microphone" : "Mute microphone"}
          title={micDisabledByHost ? "Muted by host" : isMuted ? "Unmute" : "Mute"}
          className={`${BUTTON_BASE} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 ${pillClasses(!isMuted)}`}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={onToggleCamera}
          disabled={cameraDisabledByHost}
          aria-label={cameraDisabledByHost ? "Camera disabled by host" : isCameraOn ? "Turn off camera" : "Turn on camera"}
          title={cameraDisabledByHost ? "Disabled by host" : isCameraOn ? "Stop Camera" : "Start Camera"}
          className={`${BUTTON_BASE} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 ${pillClasses(isCameraOn)}`}
        >
          {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={onToggleScreenShare}
          disabled={screenShareDisabled}
          aria-label={isScreenSharing ? "Stop sharing screen" : "Share screen"}
          title={screenShareDisabled ? "Screen share disabled by host" : isScreenSharing ? "Stop Sharing" : "Share Screen"}
          className={`${BUTTON_BASE} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 ${pillClasses(isScreenSharing)}`}
        >
          <MonitorUp className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={onToggleCaptions}
          aria-label={captionsEnabled ? "Turn off live captions" : "Turn on live captions"}
          title={captionsEnabled ? "Live Captions: On" : "Live Captions: Off"}
          className={`${BUTTON_BASE} ${pillClasses(captionsEnabled)}`}
        >
          <Captions className="h-5 w-5" />
        </button>

        {captionsEnabled && (
          <select
            value={captionLanguage}
            onChange={(e) => onCaptionLanguageChange(e.target.value)}
            aria-label="Caption language"
            className="h-12 rounded-full border border-brand-border bg-white px-3 text-xs text-brand-text"
          >
            {CAPTION_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        )}

        <Divider />

        <button
          type="button"
          onClick={onToggleHandRaise}
          aria-label={isHandRaised ? "Lower hand" : "Raise hand"}
          title={isHandRaised ? "Lower hand" : "Raise hand"}
          className={`${BUTTON_BASE} ${isHandRaised ? "animate-avatar-float border-brand-orange/30 bg-brand-orange/10 text-brand-orange" : pillClasses(false)}`}
        >
          <Hand className="h-5 w-5" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowReactions((v) => !v)}
            disabled={!canReact}
            aria-label={canReact ? "Send a reaction" : "Reactions disabled by host"}
            title={canReact ? "Reactions" : "Disabled by host"}
            className={`${BUTTON_BASE} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 ${pillClasses(showReactions)}`}
          >
            <SmilePlus className="h-5 w-5" />
          </button>
          {showReactions && canReact && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowReactions(false)} />
              <div className="absolute bottom-full left-1/2 z-50 mb-2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-brand-border bg-white p-1.5 shadow-soft">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onSendReaction(emoji);
                      setShowReactions(false);
                    }}
                    aria-label={`Send ${emoji} reaction`}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-lg transition-transform hover:scale-125 hover:bg-slate-50"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <button
            ref={moreButtonRef}
            type="button"
            onClick={() => setShowMoreMenu((v) => !v)}
            aria-label="More options"
            title="More options"
            className={`${BUTTON_BASE} ${pillClasses(showMoreMenu)}`}
          >
            <MoreVertical className="h-5 w-5" />
          </button>
          {showMoreMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
              <div
                className="absolute bottom-full right-0 z-50 mb-2 w-64 overflow-hidden rounded-2xl border border-white/30 bg-white/25 py-1.5 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_0_0_1px_rgba(255,255,255,0.1),0_12px_40px_rgba(16,42,67,0.22)]"
              >
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/50 to-transparent"
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onOpenAdjustView?.();
                  }}
                  className={MENU_ITEM_CLASS}
                >
                  <SlidersHorizontal className="h-4 w-4" /> Adjust View
                </button>
                <button type="button" onClick={handleToggleFullscreen} className={MENU_ITEM_CLASS}>
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                  {isFullscreen ? "Exit full screen" : "Full screen"}
                </button>
                <button type="button" onClick={handleTogglePiP} className={MENU_ITEM_CLASS}>
                  <PictureInPicture2 className="h-4 w-4" /> Open picture in picture
                </button>
                <button type="button" onClick={() => handleStub("Background and effects")} className={MENU_ITEM_CLASS}>
                  <Wand2 className="h-4 w-4" /> Background and effects
                </button>

                {isHost && (
                  <>
                    <div className="my-1.5 h-px bg-white/25" />
                    <button
                      type="button"
                      onClick={() => {
                        onToggleRecording();
                        setShowMoreMenu(false);
                      }}
                      className={`${MENU_ITEM_CLASS} ${isRecording ? "text-brand-danger" : ""}`}
                    >
                      <Circle className="h-4 w-4" fill={isRecording ? "currentColor" : "none"} />
                      {isRecording ? "Stop recording" : "Start recording"}
                    </button>
                  </>
                )}

                <div className="my-1.5 h-px bg-white/25" />
                <button type="button" onClick={() => handleStub("Report a problem")} className={MENU_ITEM_CLASS}>
                  <Flag className="h-4 w-4" /> Report a problem
                </button>
                <button type="button" onClick={() => handleStub("Report abuse")} className={MENU_ITEM_CLASS}>
                  <ShieldAlert className="h-4 w-4" /> Report abuse
                </button>
                <button type="button" onClick={() => handleStub("Troubleshooting and help")} className={MENU_ITEM_CLASS}>
                  <LifeBuoy className="h-4 w-4" /> Troubleshooting and help
                </button>
                <button type="button" onClick={() => handleStub("Settings")} className={MENU_ITEM_CLASS}>
                  <Settings className="h-4 w-4" /> Settings
                </button>
              </div>
            </>
          )}
        </div>

        <Divider />

        <button
          type="button"
          onClick={() => setConfirmLeave(true)}
          aria-label="Leave call"
          title="Leave"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-danger text-white transition-all duration-150 hover:scale-105 hover:bg-red-600 active:scale-95"
        >
          <PhoneOff className="h-6 w-6" />
        </button>

        {isHost && (
          <button
            type="button"
            onClick={() => setConfirmEndMeeting(true)}
            aria-label="End meeting for all"
            title="End meeting for all"
            className={`${BUTTON_BASE} border-brand-danger/30 bg-brand-danger/10 text-brand-danger hover:bg-brand-danger/20`}
          >
            <Power className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isHost && onToggleHostControls && (
          <button
            type="button"
            onClick={onToggleHostControls}
            aria-label="Toggle host controls panel"
            title="Host controls"
            className={`${BUTTON_BASE} ${pillClasses(activePanel === "hostControls")}`}
          >
            <ShieldCheck className="h-5 w-5" />
          </button>
        )}
        {canManageJoinRequests && onToggleRequests && (
          <button
            type="button"
            onClick={onToggleRequests}
            aria-label="Toggle join requests panel"
            title="Waiting to join"
            className={`relative ${BUTTON_BASE} ${pillClasses(activePanel === "requests")}`}
          >
            <UserPlus className="h-5 w-5" />
            {joinRequestsCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-semibold leading-none text-white">
                {joinRequestsCount}
              </span>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={onToggleParticipants}
          aria-label="Toggle participants panel"
          title="Participants"
          className={`relative ${BUTTON_BASE} ${pillClasses(activePanel === "participants")}`}
        >
          <Users className="h-5 w-5" />
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-semibold leading-none text-white">
            {participantsCount}
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleChat}
          aria-label="Toggle chat panel"
          title="Chat"
          className={`${BUTTON_BASE} ${pillClasses(activePanel === "chat")}`}
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      </div>

      {confirmLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-brand-text">Leave meeting?</h2>
            <p className="mt-2 text-sm text-brand-muted">
              You can rejoin this meeting anytime using the same link.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                className="rounded-[10px] border border-brand-border px-4 py-2 text-sm font-medium text-brand-text hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onLeave}
                className="rounded-[10px] bg-brand-danger px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmEndMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-brand-text">End meeting for everyone?</h2>
            <p className="mt-2 text-sm text-brand-muted">
              Everyone currently in the call will be disconnected right away.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmEndMeeting(false)}
                className="rounded-[10px] border border-brand-border px-4 py-2 text-sm font-medium text-brand-text hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onEndMeeting}
                className="rounded-[10px] bg-brand-danger px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
              >
                End meeting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
