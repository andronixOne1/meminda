import { NextRequest, NextResponse } from "next/server";
import {
  readDb,
  updateUserInDb,
  updateWishlistInDb,
  hashPassword,
  UserRecord,
  UserGender,
  logAnalyticsEvent,
} from "@/lib/db";
import { createSessionForUser, SESSION_COOKIE_NAME, toPublicUser } from "@/lib/auth";

const DEFAULT_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = (body.name || "").trim();
    const rawUsername = (body.username || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const bio = (body.bio || "").trim();

    if (!name || !rawUsername || !email || password.length < 4) {
      return NextResponse.json(
        { error: "გთხოვთ შეავსოთ ყველა სავალდებულო ველი (პაროლი მინ. 4 სიმბოლო)" },
        { status: 400 }
      );
    }

    const db = await readDb();

    if (db.users.some((u) => u.username.toLowerCase() === rawUsername)) {
      return NextResponse.json(
        { error: "ეს მომხმარებლის სახელი (username) უკვე დაკავებულია" },
        { status: 409 }
      );
    }

    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      return NextResponse.json(
        { error: "ამ ელ-ფოსტით ანგარიში უკვე არსებობს" },
        { status: 409 }
      );
    }

    const validGenders: UserGender[] = ["female", "male", "other", "prefer_not_to_say"];
    const parsedGender: UserGender | undefined = validGenders.includes(body.gender)
      ? body.gender
      : undefined;
    const rawAge = Number(body.age);
    const parsedAge =
      Number.isFinite(rawAge) && rawAge >= 5 && rawAge <= 120
        ? Math.round(rawAge)
        : undefined;
    const nowIso = new Date().toISOString();

    const userId = `user-${Date.now()}`;
    const newUser: UserRecord = {
      id: userId,
      username: rawUsername,
      name,
      email,
      passwordHash: hashPassword(password),
      bioKa: bio || `${name}-ს სურვილების სია ✨`,
      bioEn: bio || `${name}'s Wishlist Profile ✨`,
      avatarUrl:
        body.avatarUrl ||
        DEFAULT_AVATARS[db.users.length % DEFAULT_AVATARS.length],
      gender: parsedGender,
      age: parsedAge,
      birthYear: parsedAge ? new Date().getFullYear() - parsedAge : undefined,
      createdAt: nowIso,
      lastLoginAt: nowIso,
    };

    await updateUserInDb(newUser);

    // Automatically create a starter default wishlist for the new user
    const defaultWishlistId = `wl-${Date.now()}`;
    await updateWishlistInDb({
      id: defaultWishlistId,
      slug: `${rawUsername}-wishes`,
      ownerId: userId,
      title: `${name} — სურვილების სია 🎁`,
      description: "ჩემი სასურველი საჩუქრების სია. შეგიძლიათ დაჯავშნოთ ნებისმიერი ნივთი!",
      occasion: "birthday",
      isPublic: true,
      createdAt: nowIso,
    });

    await logAnalyticsEvent({
      eventType: "user_registered",
      userId: newUser.id,
      username: newUser.username,
      userGender: newUser.gender,
      userAge: newUser.age,
      wishlistId: defaultWishlistId,
      metadata: { provider: "password" },
    });

    const token = createSessionForUser(userId);
    const res = NextResponse.json({
      user: toPublicUser(newUser, true),
      defaultWishlistId,
    });

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch {
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
