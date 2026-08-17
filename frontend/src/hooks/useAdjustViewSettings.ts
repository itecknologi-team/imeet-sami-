import { useCallback, useMemo, useState } from "react";
import {
  clampMaxTilesForDevice,
  getAdjustViewSettings,
  getSidebarCollapsed,
  setAdjustViewSettings,
  setSidebarCollapsed as persistSidebarCollapsed,
} from "../lib/adjustViewSettings";
import type { LayoutMode, MaxTilesStop } from "../lib/adjustViewSettings";

export function useAdjustViewSettings() {
  const [settings, setSettings] = useState(() => getAdjustViewSettings());
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(() => getSidebarCollapsed());
  // Session-only — see the comment on AdjustViewSettings for why this isn't
  // restored from a previous meeting.
  const [pinnedId, setPinnedIdState] = useState<string | null>(null);
  const [deviceNote, setDeviceNote] = useState<string | null>(null);

  const deviceClamp = useMemo(() => clampMaxTilesForDevice(settings.maxTiles), [settings.maxTiles]);

  const setMode = useCallback((mode: LayoutMode) => {
    setSettings(setAdjustViewSettings({ mode }));
  }, []);

  const setMaxTiles = useCallback((requested: MaxTilesStop) => {
    const { value, note } = clampMaxTilesForDevice(requested);
    setDeviceNote(note);
    setSettings(setAdjustViewSettings({ maxTiles: value }));
  }, []);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    persistSidebarCollapsed(collapsed);
    setSidebarCollapsedState(collapsed);
  }, []);

  const togglePin = useCallback((participantId: string) => {
    setPinnedIdState((prev) => (prev === participantId ? null : participantId));
  }, []);

  const clearPin = useCallback(() => setPinnedIdState(null), []);

  return {
    mode: settings.mode,
    maxTiles: deviceClamp.value,
    deviceNote: deviceNote ?? deviceClamp.note,
    sidebarCollapsed,
    pinnedId,
    setMode,
    setMaxTiles,
    setSidebarCollapsed,
    togglePin,
    clearPin,
  };
}

export type AdjustViewReturn = ReturnType<typeof useAdjustViewSettings>;
