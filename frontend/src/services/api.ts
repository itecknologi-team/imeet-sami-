const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

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
