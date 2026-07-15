export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

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
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
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
    throw new Error(body?.error ?? `Request failed with status ${res.status}`);
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
  hostId: string;
  status: string;
  hourlyRate: number;
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

function authHeader(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function createMeeting(
  accessToken: string,
  title?: string,
  hourlyRate?: number,
): Promise<CreateMeetingResponse> {
  return request<CreateMeetingResponse>("/api/meetings", {
    method: "POST",
    headers: authHeader(accessToken),
    body: JSON.stringify({ title, hourlyRate }),
  });
}

export async function getMeeting(meetingCode: string): Promise<MeetingInfo> {
  return request<MeetingInfo>(`/api/meetings/${meetingCode}`);
}

export async function joinMeeting(accessToken: string, meetingCode: string): Promise<JoinMeetingResponse> {
  return request<JoinMeetingResponse>(`/api/meetings/${meetingCode}/join`, {
    method: "POST",
    headers: authHeader(accessToken),
  });
}

export async function leaveMeeting(accessToken: string, meetingCode: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/api/meetings/${meetingCode}/leave`, {
    method: "POST",
    headers: authHeader(accessToken),
  });
}

export async function endMeeting(
  accessToken: string,
  meetingCode: string,
): Promise<{ success: boolean; status: string; totalCost: number }> {
  return request(`/api/meetings/${meetingCode}/end`, {
    method: "POST",
    headers: authHeader(accessToken),
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
