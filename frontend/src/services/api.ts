const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export interface HealthResponse {
  status: "ok";
  timestamp: string;
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with status ${res.status}`);
  }
  return res.json();
}
