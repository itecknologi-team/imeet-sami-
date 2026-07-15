interface Point {
  x: number;
  y: number;
}

interface Stroke {
  id: string;
  color: string;
  points: Point[];
}

const histories = new Map<string, Stroke[]>();

export function startStroke(meetingCode: string, strokeId: string, color: string, point: Point): void {
  const history = histories.get(meetingCode) ?? [];
  history.push({ id: strokeId, color, points: [point] });
  histories.set(meetingCode, history);
}

export function addPoint(meetingCode: string, strokeId: string, point: Point): void {
  const history = histories.get(meetingCode);
  const stroke = history?.find((s) => s.id === strokeId);
  stroke?.points.push(point);
}

export function getHistory(meetingCode: string): Stroke[] {
  return histories.get(meetingCode) ?? [];
}

export function clear(meetingCode: string): void {
  histories.delete(meetingCode);
}
