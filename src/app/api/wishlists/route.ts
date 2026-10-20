import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, WishlistRecord } from "@/lib/db";
import { getCurrentUser, toPublicUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const db = await readDb();
  const currentUser = await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const usernameParam = searchParams.get("username")?.toLowerCase();
  const wishlistIdParam = searchParams.get("wishlistId");

  const usersPublic = db.users.map((u) => toPublicUser(u, currentUser?.id === u.id));

  let wishlists = db.wishlists;
  if (usernameParam) {
    const owner = db.users.find((u) => u.username.toLowerCase() === usernameParam);
    wishlists = owner ? wishlists.filter((w) => w.ownerId === owner.id) : [];
  }
  if (wishlistIdParam) {
    wishlists = wishlists.filter(
      (w) => w.id === wishlistIdParam || w.slug === wishlistIdParam
    );
  }

  // Strip guestCancelTokenHash from public responses
  const sanitizedItems = db.items.map((item) => {
    if (!item.reservation) return item;
    const { guestCancelTokenHash, ...safeReservation } = item.reservation;
    void guestCancelTokenHash;
    return {
      ...item,
      reservation: safeReservation,
    };
  });

  return NextResponse.json({
    users: usersPublic,
    wishlists,
    items: sanitizedItems,
    currentUser: currentUser ? toPublicUser(currentUser, true) : null,
  });
}

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const title = (body.title || "").trim();
    const description = (body.description || "").trim();
    const occasion = body.occasion || "birthday";
    const eventDate = body.eventDate || undefined;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const db = await readDb();
    const id = `wl-${Date.now()}`;
    const slugBase = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const slug = `${currentUser.username}-${slugBase || Date.now()}`;

    const newWishlist: WishlistRecord = {
      id,
      slug,
      ownerId: currentUser.id,
      title,
      description:
        description || "აირჩიეთ და დაჯავშნეთ სასურველი საჩუქარი სიიდან 🎁",
      occasion,
      eventDate,
      isPublic: true,
      createdAt: new Date().toISOString(),
    };

    db.wishlists.unshift(newWishlist);
    await writeDb(db);

    return NextResponse.json({ wishlist: newWishlist });
  } catch {
    return NextResponse.json({ error: "Failed to create wishlist" }, { status: 500 });
  }
}
