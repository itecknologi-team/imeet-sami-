export type LayoutMode = "auto" | "tiled" | "legacy" | "spotlight" | "sidebar";

export const MAX_TILES_STOPS = [4, 6, 9, 12, 16, 25, 36, 49] as const;
export type MaxTilesStop = (typeof MAX_TILES_STOPS)[number];

// pinnedId is deliberately NOT part of the persisted slice, even though it's
// conceptually grouped with these settings — a pinned participant identity
// from a previous meeting has no meaning in a new one (that person likely
// isn't even in the room), so it always starts each session at null instead
// of being restored from storage.
export interface AdjustViewSettings {
  mode: LayoutMode;
  maxTiles: MaxTilesStop;
}

const STORAGE_KEY = "imeet_adjust_view";

const DEFAULT_SETTINGS: AdjustViewSettings = {
  mode: "auto",
  maxTiles: 16,
};

export function getAdjustViewSettings(): AdjustViewSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<AdjustViewSettings>;
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function setAdjustViewSettings(patch: Partial<AdjustViewSettings>): AdjustViewSettings {
  const next = { ...getAdjustViewSettings(), ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

const SIDEBAR_COLLAPSED_KEY = "imeet_adjust_view_sidebar_collapsed";

export function getSidebarCollapsed(): boolean {
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
}

export function setSidebarCollapsed(collapsed: boolean): void {
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
}

// Clamp maxTiles on low-end/small-viewport devices so a 49-tile grid never
// gets requested on a phone. Returns both the clamped value and, when it
// actually clamped something, a short explanation to show the user.
export function clampMaxTilesForDevice(requested: number): { value: MaxTilesStop; note: string | null } {
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency ?? 4 : 4;
  let cap = 49;
  if (viewportWidth < 480 || cores <= 2) {
    cap = 9;
  } else if (viewportWidth < 900 || cores <= 4) {
    cap = 25;
  }
  if (requested <= cap) return { value: requested as MaxTilesStop, note: null };
  const clamped = [...MAX_TILES_STOPS].reverse().find((stop) => stop <= cap) ?? MAX_TILES_STOPS[0];
  return { value: clamped, note: "Limited on this device for performance" };
}
