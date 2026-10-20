import { cookies } from "next/headers";
import crypto from "crypto";
import { readDb, writeDb, UserRecord } from "./db";

export const SESSION_COOKIE_NAME = "meminda_session";

export interface PublicUser {
  id: string;
  username: string;
  name: string;
  email?: string;
  bioKa: string;
  bioEn: string;
  avatarUrl: string;
  createdAt: string;
}

export function toPublicUser(user: UserRecord, includeEmail = false): PublicUser {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    ...(includeEmail ? { email: user.email } : {}),
    bioKa: user.bioKa,
    bioEn: user.bioEn,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

export async function getCurrentUser(): Promise<UserRecord | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const db = readDb();
    const session = db.sessions.find((s) => s.token === token);
    if (!session) return null;

    const user = db.users.find((u) => u.id === session.userId);
    return user || null;
  } catch {
    return null;
  }
}

export function createSessionForUser(userId: string): string {
  const db = readDb();
  const token = crypto.randomBytes(24).toString("hex");
  db.sessions.push({
    token,
    userId,
    createdAt: new Date().toISOString(),
  });
  writeDb(db);
  return token;
}

export function removeSessionToken(token: string): void {
  const db = readDb();
  db.sessions = db.sessions.filter((s) => s.token !== token);
  writeDb(db);
}
