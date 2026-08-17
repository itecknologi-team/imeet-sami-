const STORAGE_KEY = "imeet_media_preferences";

export interface MediaPreferences {
  audioDeviceId?: string;
  videoDeviceId?: string;
  defaultDurationMinutes?: number;
}

export function getMediaPreferences(): MediaPreferences {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as MediaPreferences;
  } catch {
    return {};
  }
}

export function setMediaPreferences(patch: Partial<MediaPreferences>): void {
  const next = { ...getMediaPreferences(), ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
