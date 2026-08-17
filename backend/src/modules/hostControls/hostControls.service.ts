export interface HostControlSettings {
  participantsCanAdmitOrRemove: boolean;
  participantsCanMuteOthers: boolean;
  participantsCanControlOwnMedia: boolean;
  participantsCanPresent: boolean;
  participantsCanChat: boolean;
  participantsCanReact: boolean;
}

// Permissive defaults for the media/chat/reaction basics (an untouched
// meeting behaves like before this feature existed); the two
// moderation-adjacent ones (admitting/removing people, muting others) default
// off since those are host-only powers until the host explicitly delegates
// them.
const DEFAULT_SETTINGS: HostControlSettings = {
  participantsCanAdmitOrRemove: false,
  participantsCanMuteOthers: false,
  participantsCanControlOwnMedia: true,
  participantsCanPresent: true,
  participantsCanChat: true,
  participantsCanReact: true,
};

const settings = new Map<string, HostControlSettings>();

export function getSettings(meetingCode: string): HostControlSettings {
  return settings.get(meetingCode) ?? DEFAULT_SETTINGS;
}

export function updateSettings(meetingCode: string, patch: Partial<HostControlSettings>): HostControlSettings {
  const next = { ...getSettings(meetingCode), ...patch };
  settings.set(meetingCode, next);
  return next;
}

export function clear(meetingCode: string): void {
  settings.delete(meetingCode);
}
