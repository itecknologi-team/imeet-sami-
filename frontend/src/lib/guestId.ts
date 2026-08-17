import { generateId } from "./uuid";

const GUEST_ID_KEY = "imeet_guest_id";

// Stable per-browser identity for people using imeet without an account —
// lets a guest re-authenticate as "the meeting host" (end meeting) or resume
// their own participant row across a page reload, without a real user record.
export function getGuestId(): string {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = generateId();
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

// A meeting's "Save this link" host-recovery link carries the creating
// guest's id as ?hostKey=... — opening it (e.g. on another device/browser)
// restores host access there by adopting that id as this browser's guest id.
export function getEffectiveGuestId(): string {
  const hostKey = new URLSearchParams(window.location.search).get("hostKey");
  if (hostKey) {
    localStorage.setItem(GUEST_ID_KEY, hostKey);
    return hostKey;
  }
  return getGuestId();
}
