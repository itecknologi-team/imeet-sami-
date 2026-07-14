import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { pool } from "../../config/db";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors";

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string | null;
  avatar_url: string | null;
  auth_provider: string;
}

const googleClient = new OAuth2Client(env.googleClientId || undefined);

function toPublicUser(user: UserRow) {
  return { id: user.id, name: user.name, email: user.email };
}

function signAccessToken(user: Pick<UserRow, "id" | "email">): string {
  return jwt.sign({ id: user.id, email: user.email }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

async function createSession(userId: string): Promise<string> {
  const refreshToken = crypto.randomBytes(40).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await pool.query(
    "INSERT INTO sessions (user_id, refresh_token, expires_at) VALUES ($1, $2, $3)",
    [userId, refreshToken, expiresAt],
  );
  return refreshToken;
}

export async function signup(name: string, email: string, password: string) {
  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows.length > 0) {
    throw new AppError(400, "Email already registered");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (name, email, password_hash, auth_provider)
     VALUES ($1, $2, $3, 'email')
     RETURNING id, name, email, password_hash, avatar_url, auth_provider`,
    [name, email, passwordHash],
  );
  const user = rows[0];
  const accessToken = signAccessToken(user);
  const refreshToken = await createSession(user.id);
  return { user: toPublicUser(user), accessToken, refreshToken };
}

export async function login(email: string, password: string) {
  const { rows } = await pool.query<UserRow>("SELECT * FROM users WHERE email = $1", [email]);
  const user = rows[0];
  if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
    throw new AppError(401, "Invalid email or password");
  }

  const accessToken = signAccessToken(user);
  const refreshToken = await createSession(user.id);
  return { user: toPublicUser(user), accessToken, refreshToken };
}

export async function loginWithGoogle(idToken: string) {
  if (!env.googleClientId) {
    throw new AppError(500, "Google login is not configured");
  }

  const ticket = await googleClient.verifyIdToken({ idToken, audience: env.googleClientId });
  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw new AppError(401, "Invalid Google token");
  }

  const { rows } = await pool.query<UserRow>("SELECT * FROM users WHERE email = $1", [payload.email]);
  let user = rows[0];
  if (!user) {
    const inserted = await pool.query<UserRow>(
      `INSERT INTO users (name, email, avatar_url, auth_provider)
       VALUES ($1, $2, $3, 'google')
       RETURNING id, name, email, password_hash, avatar_url, auth_provider`,
      [payload.name ?? payload.email, payload.email, payload.picture ?? null],
    );
    user = inserted.rows[0];
  }

  const accessToken = signAccessToken(user);
  const refreshToken = await createSession(user.id);
  return { user: toPublicUser(user), accessToken, refreshToken };
}

export async function refreshAccessToken(refreshToken: string) {
  const { rows } = await pool.query<{ id: string; email: string; expires_at: string }>(
    `SELECT u.id, u.email, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.refresh_token = $1`,
    [refreshToken],
  );
  const row = rows[0];
  if (!row || new Date(row.expires_at) < new Date()) {
    throw new AppError(401, "Invalid or expired refresh token");
  }

  const accessToken = signAccessToken(row);
  return { accessToken };
}

export async function getMe(userId: string) {
  const { rows } = await pool.query<UserRow>("SELECT * FROM users WHERE id = $1", [userId]);
  const user = rows[0];
  if (!user) {
    throw new AppError(401, "Unauthorized");
  }
  return { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatar_url };
}

export async function logout(refreshToken: string) {
  await pool.query("DELETE FROM sessions WHERE refresh_token = $1", [refreshToken]);
  return { success: true };
}
