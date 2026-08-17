const raisedHands = new Map<string, Set<string>>();

export function setRaised(meetingCode: string, userId: string, raised: boolean): void {
  const meetingHands = raisedHands.get(meetingCode) ?? new Set<string>();
  if (raised) {
    meetingHands.add(userId);
  } else {
    meetingHands.delete(userId);
  }
  raisedHands.set(meetingCode, meetingHands);
}

export function getRaised(meetingCode: string): string[] {
  return Array.from(raisedHands.get(meetingCode) ?? []);
}

export function clear(meetingCode: string): void {
  raisedHands.delete(meetingCode);
}
