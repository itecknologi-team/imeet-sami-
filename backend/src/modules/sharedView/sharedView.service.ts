export type SharedView = "video" | "whiteboard" | "code" | "virtual-office";

const views = new Map<string, SharedView>();

export function setView(meetingCode: string, view: SharedView): void {
  views.set(meetingCode, view);
}

export function getView(meetingCode: string): SharedView {
  return views.get(meetingCode) ?? "video";
}

export function clear(meetingCode: string): void {
  views.delete(meetingCode);
}
