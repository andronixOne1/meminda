import { NextRequest, NextResponse } from "next/server";
import { readDb, updateUserInDb, updateItemInDb, hashPassword } from "@/lib/db";
import { getCurrentUser, toPublicUser } from "@/lib/auth";

export async function PUT(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const db = await readDb();
    const userIndex = db.users.findIndex((u) => u.id === currentUser.id);
    if (userIndex === -1) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = db.users[userIndex];

    const newName =
      typeof body.name === "string" ? body.name.trim() : user.name;
    const newUsername =
      typeof body.username === "string"
        ? body.username
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "")
        : user.username;
    const newEmail =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : user.email;
    const newBio =
      typeof body.bio === "string" ? body.bio.trim() : user.bioKa;
    const newAvatarUrl =
      typeof body.avatarUrl === "string" && body.avatarUrl.trim()
        ? body.avatarUrl.trim()
        : user.avatarUrl;
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";

    if (!newName || !newUsername || !newEmail) {
      return NextResponse.json(
        { error: "სახელი, Username და ელ-ფოსტა სავალდებულოა" },
        { status: 400 }
      );
    }

    // Check username uniqueness if changed
    if (
      newUsername !== user.username.toLowerCase() &&
      db.users.some(
        (u) => u.id !== user.id && u.username.toLowerCase() === newUsername
      )
    ) {
      return NextResponse.json(
        { error: "ეს Username უკვე დაკავებულია სხვა მომხმარებლის მიერ" },
        { status: 409 }
      );
    }

    // Check email uniqueness if changed
    if (
      newEmail !== user.email.toLowerCase() &&
      db.users.some(
        (u) => u.id !== user.id && u.email.toLowerCase() === newEmail
      )
    ) {
      return NextResponse.json(
        { error: "ეს ელ-ფოსტა უკვე გამოყენებულია სხვა ანგარიშზე" },
        { status: 409 }
      );
    }

    if (newPassword && newPassword.length < 6) {
      return NextResponse.json(
        { error: "ახალი პაროლი უნდა შეიცავდეს მინიმუმ 6 სიმბოლოს" },
        { status: 400 }
      );
    }

    user.name = newName;
    user.username = newUsername;
    user.email = newEmail;
    user.avatarUrl = newAvatarUrl;
    user.bioKa = newBio || `${newName}-ს სურვილების სია ✨`;
    user.bioEn = newBio || `${newName}'s Wishlist Profile ✨`;

    if (newPassword) {
      user.passwordHash = hashPassword(newPassword);
    }

    await updateUserInDb(user);

    // Also update reservedByName on items this user reserved if they didn't reserve anonymously
    for (const item of db.items) {
      if (
        item.reservation &&
        item.reservation.reservedByUserId === user.id &&
        !item.reservation.isAnonymousToPublic
      ) {
        item.reservation.reservedByName = newName;
        item.reservation.reservedByUsername = newUsername;
        await updateItemInDb(item);
      }
    }

    return NextResponse.json({
      ok: true,
      user: toPublicUser(user, true),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to update profile settings" },
      { status: 500 }
    );
  }
}
