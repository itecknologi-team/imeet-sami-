interface PendingRequest {
  userId: string;
  name: string;
  socketId: string;
}

const requests = new Map<string, Map<string, PendingRequest>>();

export function addRequest(meetingCode: string, requestId: string, request: PendingRequest): void {
  const meetingRequests = requests.get(meetingCode) ?? new Map<string, PendingRequest>();
  meetingRequests.set(requestId, request);
  requests.set(meetingCode, meetingRequests);
}

export function getRequest(meetingCode: string, requestId: string): PendingRequest | undefined {
  return requests.get(meetingCode)?.get(requestId);
}

export function removeRequest(meetingCode: string, requestId: string): void {
  requests.get(meetingCode)?.delete(requestId);
}

export function listRequests(meetingCode: string): Array<{ requestId: string; userId: string; name: string }> {
  const meetingRequests = requests.get(meetingCode);
  if (!meetingRequests) return [];
  return Array.from(meetingRequests.entries()).map(([requestId, r]) => ({
    requestId,
    userId: r.userId,
    name: r.name,
  }));
}

export function clear(meetingCode: string): void {
  requests.delete(meetingCode);
}
