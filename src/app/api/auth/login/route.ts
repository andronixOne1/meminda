import { NextRequest, NextResponse } from "next/server";
import { readDb, hashPassword } from "@/lib/db";
import { createSessionForUser, SESSION_COOKIE_NAME, toPublicUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const identifier = (body.identifier || "").trim().toLowerCase();
    const password = body.password || "";

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "შეიყვანეთ ელ-ფოსტა/username და პაროლი" },
        { status: 400 }
      );
    }

    const db = readDb();
    const user = db.users.find(
      (u) =>
        u.email.toLowerCase() === identifier ||
        u.username.toLowerCase() === identifier
    );

    if (!user || user.passwordHash !== hashPassword(password)) {
      return NextResponse.json(
        { error: "არასწორი მომხმარებელი ან პაროლი" },
        { status: 401 }
      );
    }

    const token = createSessionForUser(user.id);
    const res = NextResponse.json({
      user: toPublicUser(user, true),
    });

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
