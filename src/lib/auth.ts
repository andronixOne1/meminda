import { cookies } from "next/headers";
import crypto from "crypto";
import { readDb, UserRecord, UserGender } from "./db";

export const SESSION_COOKIE_NAME = "meminda_session";
const SESSION_SECRET =
  process.env.MEMINDA_SESSION_SECRET || "meminda_prod_secret_key_2026_ge";

export interface PublicUser {
  id: string;
  username: string;
  name: string;
  email?: string;
  gender?: UserGender;
  age?: number;
  birthYear?: number;
  bioKa: string;
  bioEn: string;
  avatarUrl: string;
  createdAt: string;
}

export function toPublicUser(user: UserRecord, includePrivate = false): PublicUser {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    ...(includePrivate
      ? {
          email: user.email,
          gender: user.gender,
          age: user.age,
          birthYear: user.birthYear,
        }
      : {}),
    bioKa: user.bioKa,
    bioEn: user.bioEn,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

function signUserId(userId: string): string {
  const payload = Buffer.from(userId, "utf-8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

function verifySignedToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  if (sig !== expectedSig) return null;
  try {
    return Buffer.from(payload, "base64url").toString("utf-8");
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<UserRecord | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const userId = verifySignedToken(token);
    if (!userId) return null;

    const db = await readDb();
    const user = db.users.find((u) => u.id === userId);
    return user || null;
  } catch {
    return null;
  }
}

export function createSessionForUser(userId: string): string {
  return signUserId(userId);
}

export function removeSessionToken(_token: string): void {
  void _token;
}
