import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { PermissionKey } from "./permissions";

const JWT_SECRET = process.env.JWT_SECRET || "vatti-private-secret-key-2026";
const COOKIE_NAME = "vatti_session";

export interface UserSession {
  userId: string;
  username: string;
  role: string;
  name: string;
  partnerId?: string | null;
  permissions?: Record<PermissionKey, boolean> | null;
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function signToken(payload: UserSession): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): UserSession | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserSession;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<UserSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}

export async function setSessionCookie(session: UserSession) {
  const token = signToken(session);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function checkAppLock(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get("vatti_locked")?.value === "true";
  } catch {
    return false;
  }
}

export async function setAppLock(locked: boolean) {
  const cookieStore = await cookies();
  if (locked) {
    cookieStore.set("vatti_locked", "true", { path: "/", httpOnly: false });
  } else {
    cookieStore.delete("vatti_locked");
  }
}
