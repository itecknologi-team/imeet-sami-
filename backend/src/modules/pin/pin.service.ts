const pinned = new Map<string, string | null>();

export function setPinned(meetingCode: string, userId: string | null): void {
  pinned.set(meetingCode, userId);
}

export function getPinned(meetingCode: string): string | null {
  return pinned.get(meetingCode) ?? null;
}

export function clear(meetingCode: string): void {
  pinned.delete(meetingCode);
}
