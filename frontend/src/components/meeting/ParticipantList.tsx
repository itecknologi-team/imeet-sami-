import { Focus, Hand, Mic, MicOff, MonitorUp, MonitorX, Pin, PinOff, UserX, Video, VideoOff } from "lucide-react";
import type { MediaKind, MeetingParticipantInfo } from "../../hooks/useMeeting";
import { InitialsAvatar } from "./InitialsAvatar";

interface ParticipantListProps {
  participants: MeetingParticipantInfo[];
  screenSharingUserId?: string | null;
  isHost?: boolean;
  currentUserId?: string;
  mediaRestrictions?: Record<string, MediaKind[]>;
  onSetParticipantMedia?: (targetUserId: string, kind: MediaKind, blocked: boolean) => void;
  raisedHands?: string[];
  pinnedUserId?: string | null;
  onPinParticipant?: (targetUserId: string | null) => void;
  onKickParticipant?: (targetUserId: string) => void;
  canMuteOthers?: boolean;
  canAdmitOrRemove?: boolean;
  /** Personal "Adjust View" spotlight — available to every viewer, independent of the host-only broadcast pin above. Toggles by id (calling it again with the same id clears it). */
  personalSpotlightId?: string | null;
  onPersonalSpotlight?: (targetUserId: string) => void;
}

function hostControlButtonClasses(blocked: boolean): string {
  return blocked
    ? "border-brand-danger/30 bg-brand-danger/10 text-brand-danger"
    : "border-brand-border bg-white text-brand-text hover:bg-slate-50";
}

export function ParticipantList({
  participants,
  screenSharingUserId,
  isHost = false,
  currentUserId,
  mediaRestrictions = {},
  onSetParticipantMedia,
  raisedHands = [],
  pinnedUserId = null,
  onPinParticipant,
  onKickParticipant,
  canMuteOthers = false,
  canAdmitOrRemove = false,
  personalSpotlightId = null,
  onPersonalSpotlight,
}: ParticipantListProps) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-brand-border bg-brand-surface shadow-soft">
      <div className="flex items-center gap-2 rounded-t-2xl bg-brand-blue px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Participants</h2>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-orange px-1.5 text-[11px] font-bold text-white">
          {participants.length}
        </span>
      </div>
      <ul className="flex-1 divide-y divide-brand-border overflow-y-auto">
        {participants.map((p) => {
          const isOther = p.userId !== currentUserId && p.role !== "host";
          const canControl = isHost && onSetParticipantMedia && p.userId !== currentUserId;
          const blocked = mediaRestrictions[p.userId] ?? [];
          // Delegated (non-host) powers — host always uses the full button
          // group above instead, so these only ever apply to someone else.
          const canDelegatedMute =
            !isHost && canMuteOthers && onSetParticipantMedia && isOther && !blocked.includes("microphone");
          const canDelegatedRemove = !isHost && canAdmitOrRemove && onKickParticipant && isOther;
          return (
            <li key={p.userId} className="flex items-center gap-2 px-4 py-2.5">
              <InitialsAvatar name={p.name} size="sm" />
              <span className="flex-1 truncate text-sm text-brand-text">{p.name}</span>
              {raisedHands.includes(p.userId) && (
                <Hand className="h-4 w-4 text-brand-orange" aria-label={`${p.name} raised their hand`} />
              )}
              {screenSharingUserId === p.userId && (
                <MonitorUp className="h-4 w-4 text-brand-blue" aria-label={`${p.name} is sharing their screen`} />
              )}
              {p.role === "host" && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-brand-muted">
                  Host
                </span>
              )}
              {onPersonalSpotlight && (
                <button
                  type="button"
                  onClick={() => onPersonalSpotlight(p.userId)}
                  aria-label={
                    personalSpotlightId === p.userId ? `Remove spotlight from ${p.name}` : `Spotlight ${p.name}`
                  }
                  title={personalSpotlightId === p.userId ? "Remove spotlight" : "Spotlight this participant"}
                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${hostControlButtonClasses(
                    personalSpotlightId === p.userId,
                  )}`}
                >
                  <Focus className="h-3.5 w-3.5" />
                </button>
              )}
              {canControl && (
                <div className="flex flex-shrink-0 items-center gap-1">
                  {onPinParticipant && (
                    <button
                      type="button"
                      onClick={() => onPinParticipant(pinnedUserId === p.userId ? null : p.userId)}
                      aria-label={pinnedUserId === p.userId ? `Unpin ${p.name}` : `Pin ${p.name}`}
                      title={pinnedUserId === p.userId ? "Unpin" : "Pin for everyone"}
                      className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${hostControlButtonClasses(
                        pinnedUserId === p.userId,
                      )}`}
                    >
                      {pinnedUserId === p.userId ? (
                        <PinOff className="h-3.5 w-3.5" />
                      ) : (
                        <Pin className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onSetParticipantMedia!(p.userId, "microphone", !blocked.includes("microphone"))}
                    aria-label={blocked.includes("microphone") ? `Allow ${p.name}'s microphone` : `Mute ${p.name}`}
                    title={blocked.includes("microphone") ? "Allow microphone" : "Mute"}
                    className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${hostControlButtonClasses(
                      blocked.includes("microphone"),
                    )}`}
                  >
                    {blocked.includes("microphone") ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetParticipantMedia!(p.userId, "camera", !blocked.includes("camera"))}
                    aria-label={blocked.includes("camera") ? `Allow ${p.name}'s camera` : `Turn off ${p.name}'s camera`}
                    title={blocked.includes("camera") ? "Allow camera" : "Turn off camera"}
                    className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${hostControlButtonClasses(
                      blocked.includes("camera"),
                    )}`}
                  >
                    {blocked.includes("camera") ? <VideoOff className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onSetParticipantMedia!(p.userId, "screen_share", !blocked.includes("screen_share"))
                    }
                    aria-label={
                      blocked.includes("screen_share") ? `Allow ${p.name} to share screen` : `Block ${p.name}'s screen share`
                    }
                    title={blocked.includes("screen_share") ? "Allow screen share" : "Block screen share"}
                    className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${hostControlButtonClasses(
                      blocked.includes("screen_share"),
                    )}`}
                  >
                    {blocked.includes("screen_share") ? (
                      <MonitorX className="h-3.5 w-3.5" />
                    ) : (
                      <MonitorUp className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {onKickParticipant && (
                    <button
                      type="button"
                      onClick={() => onKickParticipant(p.userId)}
                      aria-label={`Remove ${p.name} from the meeting`}
                      title="Remove from meeting"
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-brand-danger/30 bg-brand-danger/10 text-brand-danger transition-colors hover:bg-brand-danger/20"
                    >
                      <UserX className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
              {!canControl && (canDelegatedMute || canDelegatedRemove) && (
                <div className="flex flex-shrink-0 items-center gap-1">
                  {canDelegatedMute && (
                    <button
                      type="button"
                      onClick={() => onSetParticipantMedia!(p.userId, "microphone", true)}
                      aria-label={`Mute ${p.name}`}
                      title="Mute"
                      className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${hostControlButtonClasses(false)}`}
                    >
                      <Mic className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {canDelegatedRemove && (
                    <button
                      type="button"
                      onClick={() => onKickParticipant!(p.userId)}
                      aria-label={`Remove ${p.name} from the meeting`}
                      title="Remove from meeting"
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-brand-danger/30 bg-brand-danger/10 text-brand-danger transition-colors hover:bg-brand-danger/20"
                    >
                      <UserX className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
