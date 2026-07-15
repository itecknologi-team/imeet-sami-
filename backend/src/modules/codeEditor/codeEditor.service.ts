import * as Y from "yjs";

const docs = new Map<string, Y.Doc>();

function getOrCreateDoc(meetingCode: string): Y.Doc {
  let doc = docs.get(meetingCode);
  if (!doc) {
    doc = new Y.Doc();
    docs.set(meetingCode, doc);
  }
  return doc;
}

export function applyUpdate(meetingCode: string, update: Uint8Array): void {
  const doc = getOrCreateDoc(meetingCode);
  Y.applyUpdate(doc, update);
}

export function getStateAsUpdate(meetingCode: string): Uint8Array {
  return Y.encodeStateAsUpdate(getOrCreateDoc(meetingCode));
}

export function clear(meetingCode: string): void {
  docs.delete(meetingCode);
}
