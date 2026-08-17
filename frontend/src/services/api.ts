// Derived from whatever host actually loaded this page instead of a
// hardcoded "localhost" — a device on the LAN loads the frontend via this
// machine's LAN IP, and "localhost" in its browser would mean itself, not
// this server. The protocol is derived too (not hardcoded to http) since the
// backend now speaks https — a page loaded over https can't call out to a
// plain http API (blocked as mixed content). VITE_API_URL still wins if
// explicitly set (e.g. behind a reverse proxy or tunnel with its own
// hostname).
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? `${window.location.protocol}//${window.location.hostname}:4000`;

export interface HealthResponse {
  status: "ok";
  timestamp: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface MeResponse {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  crmWebhookUrl: string | null;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? `Request failed with status ${res.status}`, body);
  }
  return body as T;
}

export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/api/health");
}

export async function signup(name: string, email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getMe(accessToken: string): Promise<MeResponse> {
  return request<MeResponse>("/api/auth/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function logout(refreshToken: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
}

export interface CreateMeetingResponse {
  id: string;
  title: string;
  meetingCode: string;
  hostId: string | null;
  status: string;
  hourlyRate: number;
  priceCents: number | null;
  scheduledAt: string | null;
  durationMinutes: number | null;
}

export interface MeetingInfo {
  id: string;
  title: string;
  meetingCode: string;
  status: string;
  hostName: string;
  hourlyRate: number;
  startedAt: string | null;
  totalCost: number | null;
  priceCents: number | null;
  scheduledAt: string | null;
  durationMinutes: number | null;
}

export interface MyMeeting {
  id: string;
  title: string;
  meetingCode: string;
  status: string;
  hourlyRate: number;
  startedAt: string | null;
  endedAt: string | null;
  scheduledAt: string | null;
  durationMinutes: number | null;
  createdAt: string;
}

export interface JoinMeetingResponse {
  meeting: { id: string; title: string; status: string; hourlyRate: number; startedAt: string | null };
  livekitToken: string;
  livekitUrl: string;
}

export interface Participant {
  userId: string;
  name: string;
  role: string;
  joinedAt: string;
}

export interface GuestIdentity {
  guestId: string;
  guestName: string;
}

function authHeader(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function createMeeting(
  accessToken: string | null,
  title?: string,
  hourlyRate?: number,
  priceCents?: number,
  guest?: GuestIdentity,
  passcode?: string,
  scheduledAt?: string,
  durationMinutes?: number,
): Promise<CreateMeetingResponse> {
  return request<CreateMeetingResponse>("/api/meetings", {
    method: "POST",
    headers: accessToken ? authHeader(accessToken) : {},
    body: JSON.stringify({
      title,
      hourlyRate,
      priceCents,
      passcode,
      guestId: guest?.guestId,
      guestName: guest?.guestName,
      scheduledAt,
      durationMinutes,
    }),
  });
}

export async function getMyMeetings(accessToken: string): Promise<{ meetings: MyMeeting[] }> {
  return request<{ meetings: MyMeeting[] }>("/api/meetings/mine", {
    headers: authHeader(accessToken),
  });
}

export async function createCheckoutSession(
  accessToken: string,
  meetingCode: string,
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string }> {
  return request<{ url: string }>(`/api/meetings/${meetingCode}/checkout`, {
    method: "POST",
    headers: authHeader(accessToken),
    body: JSON.stringify({ successUrl, cancelUrl }),
  });
}

export async function confirmPayment(
  accessToken: string,
  meetingCode: string,
  sessionId: string,
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/api/meetings/${meetingCode}/confirm-payment`, {
    method: "POST",
    headers: authHeader(accessToken),
    body: JSON.stringify({ sessionId }),
  });
}

export async function updateCrmWebhook(
  accessToken: string,
  webhookUrl: string | null,
): Promise<{ crmWebhookUrl: string | null }> {
  return request<{ crmWebhookUrl: string | null }>("/api/auth/me/crm-webhook", {
    method: "PUT",
    headers: authHeader(accessToken),
    body: JSON.stringify({ webhookUrl }),
  });
}

export async function getMeeting(meetingCode: string): Promise<MeetingInfo> {
  return request<MeetingInfo>(`/api/meetings/${meetingCode}`);
}

export async function joinMeeting(
  accessToken: string | null,
  meetingCode: string,
  guest?: GuestIdentity & { passcode?: string },
): Promise<JoinMeetingResponse> {
  return request<JoinMeetingResponse>(`/api/meetings/${meetingCode}/join`, {
    method: "POST",
    headers: accessToken ? authHeader(accessToken) : {},
    body: JSON.stringify({ guestId: guest?.guestId, guestName: guest?.guestName, passcode: guest?.passcode }),
  });
}

export async function leaveMeeting(
  accessToken: string | null,
  meetingCode: string,
  guestId?: string,
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/api/meetings/${meetingCode}/leave`, {
    method: "POST",
    headers: accessToken ? authHeader(accessToken) : {},
    body: JSON.stringify({ guestId }),
  });
}

export async function endMeeting(
  accessToken: string | null,
  meetingCode: string,
  guestId?: string,
): Promise<{ success: boolean; status: string; totalCost: number }> {
  return request(`/api/meetings/${meetingCode}/end`, {
    method: "POST",
    headers: accessToken ? authHeader(accessToken) : {},
    body: JSON.stringify({ guestId }),
  });
}

export async function getParticipants(meetingCode: string): Promise<{ participants: Participant[] }> {
  return request<{ participants: Participant[] }>(`/api/meetings/${meetingCode}/participants`);
}

export interface Recording {
  id: string;
  fileUrl: string | null;
  duration: number | null;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  deletedAt: string | null;
}

export async function startRecording(
  accessToken: string,
  meetingCode: string,
): Promise<{ id: string; egressId: string; status: string }> {
  return request(`/api/meetings/${meetingCode}/recording/start`, {
    method: "POST",
    headers: authHeader(accessToken),
  });
}

export async function stopRecording(accessToken: string, meetingCode: string): Promise<{ success: boolean }> {
  return request(`/api/meetings/${meetingCode}/recording/stop`, {
    method: "POST",
    headers: authHeader(accessToken),
  });
}

export async function getRecordings(meetingCode: string): Promise<{ recordings: Recording[] }> {
  return request<{ recordings: Recording[] }>(`/api/meetings/${meetingCode}/recordings`);
}

export async function deleteRecording(
  accessToken: string,
  meetingCode: string,
  recordingId: string,
): Promise<{ success: boolean }> {
  return request(`/api/meetings/${meetingCode}/recordings/${recordingId}`, {
    method: "DELETE",
    headers: authHeader(accessToken),
  });
}

export interface Highlight {
  id: string;
  kind: "note" | "key_moment";
  startSeconds: number;
  endSeconds: number | null;
  label: string;
}

export interface RecapResponse {
  transcript: { status: string; content: string | null; recordingId: string } | null;
  summary: { status: string; summaryText: string | null; actionItems: string[] | null } | null;
  highlights: Highlight[];
}

export async function getRecap(meetingCode: string): Promise<RecapResponse> {
  return request<RecapResponse>(`/api/meetings/${meetingCode}/recap`);
}

export async function uploadCaptionChunk(
  accessToken: string,
  meetingCode: string,
  blob: Blob,
): Promise<void> {
  await request(`/api/meetings/${meetingCode}/caption-chunk`, {
    method: "POST",
    headers: { ...authHeader(accessToken), "Content-Type": "audio/webm" },
    body: blob,
  });
}

export interface AsyncVideo {
  id: string;
  title: string;
  fileUrl: string;
  duration: number | null;
  createdAt: string;
}

export async function uploadAsyncVideo(
  accessToken: string,
  title: string,
  blob: Blob,
  durationSeconds: number,
): Promise<AsyncVideo> {
  const params = new URLSearchParams({ title, duration: String(durationSeconds) });
  return request<AsyncVideo>(`/api/videos?${params.toString()}`, {
    method: "POST",
    headers: { ...authHeader(accessToken), "Content-Type": "video/webm" },
    body: blob,
  });
}

export async function listMyVideos(accessToken: string): Promise<{ videos: AsyncVideo[] }> {
  return request<{ videos: AsyncVideo[] }>("/api/videos/mine", {
    headers: authHeader(accessToken),
  });
}

export async function getAsyncVideo(videoId: string): Promise<AsyncVideo> {
  return request<AsyncVideo>(`/api/videos/${videoId}`);
}
