import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, hashPassword, UserRecord } from "@/lib/db";
import { createSessionForUser, SESSION_COOKIE_NAME, toPublicUser } from "@/lib/auth";
import { firebaseConfig } from "@/lib/firebase";

const DEFAULT_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80",
];

interface FirebaseLookupUser {
  localId: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
  emailVerified?: boolean;
}

async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseLookupUser | null> {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const fbUser = data?.users?.[0];
    if (!fbUser || !fbUser.localId) return null;
    return fbUser as FirebaseLookupUser;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const idToken = body.idToken;
    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json({ error: "Missing Firebase ID token" }, { status: 400 });
    }

    const fbUser = await verifyFirebaseIdToken(idToken);
    if (!fbUser) {
      return NextResponse.json(
        { error: "Invalid or expired Firebase authentication token" },
        { status: 401 }
      );
    }

    if (fbUser.emailVerified === false) {
      return NextResponse.json(
        {
          error:
            "გთხოვთ დაადასტუროთ თქვენი ელ-ფოსტა (შეამოწმეთ Inbox ან Spam საქაღალდე)",
          code: "EMAIL_NOT_VERIFIED",
        },
        { status: 403 }
      );
    }

    const db = await readDb();
    const email = (fbUser.email || body.email || "").trim().toLowerCase();

    // 1. Check if user already exists by firebaseUid or email
    let existingUser = db.users.find(
      (u) =>
        (u.firebaseUid && u.firebaseUid === fbUser.localId) ||
        (email && u.email.toLowerCase() === email)
    );

    let defaultWishlistId: string | undefined;

    if (existingUser) {
      // Link firebaseUid if not linked yet
      if (!existingUser.firebaseUid) {
        existingUser.firebaseUid = fbUser.localId;
      }
      if (fbUser.photoUrl && existingUser.avatarUrl.includes("unsplash.com")) {
        existingUser.avatarUrl = fbUser.photoUrl;
      }
      await writeDb(db);
    } else {
      // 2. First-time user (via Firebase Register or Google Sign-In) -> Create Profile & Starter Wishlist
      const name =
        (body.name || fbUser.displayName || email.split("@")[0] || "მომხმარებელი").trim();
      const requestedUsername = (body.username || email.split("@")[0] || "user")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "");

      let finalUsername = requestedUsername || `user${Date.now().toString().slice(-4)}`;
      if (db.users.some((u) => u.username.toLowerCase() === finalUsername)) {
        finalUsername = `${finalUsername}${Math.floor(100 + Math.random() * 899)}`;
      }

      const bio = (body.bio || "").trim();
      const userId = `user-${Date.now()}`;

      const newUser: UserRecord = {
        id: userId,
        firebaseUid: fbUser.localId,
        username: finalUsername,
        name,
        email: email || `${finalUsername}@meminda.ge`,
        passwordHash: hashPassword(`firebase_${fbUser.localId}`),
        bioKa: bio || `${name}-ს სურვილების სია ✨`,
        bioEn: bio || `${name}'s Wishlist Profile ✨`,
        avatarUrl:
          fbUser.photoUrl ||
          DEFAULT_AVATARS[db.users.length % DEFAULT_AVATARS.length],
        createdAt: new Date().toISOString(),
      };

      db.users.push(newUser);
      existingUser = newUser;

      defaultWishlistId = `wl-${Date.now()}`;
      db.wishlists.unshift({
        id: defaultWishlistId,
        slug: `${finalUsername}-wishes`,
        ownerId: userId,
        title: `${name} — სურვილების სია 🎁`,
        description:
          "ჩემი სასურველი საჩუქრების სია. შეგიძლიათ დაჯავშნოთ ნებისმიერი ნივთი!",
        occasion: "birthday",
        isPublic: true,
        createdAt: new Date().toISOString(),
      });

      await writeDb(db);
    }

    const sessionToken = createSessionForUser(existingUser.id);
    const res = NextResponse.json({
      user: toPublicUser(existingUser, true),
      defaultWishlistId,
    });

    res.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch (err) {
    console.error("Firebase auth sync error:", err);
    return NextResponse.json(
      { error: "Failed to authenticate with Firebase" },
      { status: 500 }
    );
  }
}
