interface Position {
  x: number;
  y: number;
}

const positions = new Map<string, Map<string, Position>>();

export function setPosition(meetingCode: string, userId: string, x: number, y: number): void {
  const meetingPositions = positions.get(meetingCode) ?? new Map<string, Position>();
  meetingPositions.set(userId, { x, y });
  positions.set(meetingCode, meetingPositions);
}

export function getPositions(meetingCode: string): Record<string, Position> {
  const meetingPositions = positions.get(meetingCode);
  if (!meetingPositions) {
    return {};
  }
  return Object.fromEntries(meetingPositions);
}

export function clear(meetingCode: string): void {
  positions.delete(meetingCode);
}
