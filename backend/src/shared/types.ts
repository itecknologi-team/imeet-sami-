export interface HealthResponse {
  status: "ok" | "error";
  timestamp: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
