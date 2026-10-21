import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { readDb, updateItemInDb, hashToken } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || "reserve"; // "reserve" | "unreserve"
    const itemId = body.itemId;

    if (!itemId) {
      return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
    }

    const db = await readDb();
    const itemIndex = db.items.findIndex((i) => i.id === itemId);
    if (itemIndex === -1) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const item = db.items[itemIndex];
    const parentWishlist = db.wishlists.find((w) => w.id === item.wishlistId);
    const currentUser = await getCurrentUser();
    const isItemOwner = Boolean(
      currentUser &&
        (currentUser.id === item.ownerId ||
          (parentWishlist && currentUser.id === parentWishlist.ownerId))
    );

    if (action === "unreserve") {
      if (!item.reservation) {
        return NextResponse.json({ ok: true, item });
      }

      // Wishlist owners are NEVER allowed to remove reservations on their own wishlist
      if (isItemOwner) {
        return NextResponse.json(
          { error: "საკუთარ სიაში სხვისი ჯავშნის გაუქმება არ შეიძლება" },
          { status: 403 }
        );
      }

      const guestToken = body.guestCancelToken || "";
      const isReserverUser =
        currentUser &&
        item.reservation.reservedByUserId &&
        currentUser.id === item.reservation.reservedByUserId;
      const isGuestTokenMatch =
        guestToken &&
        item.reservation.guestCancelTokenHash &&
        hashToken(guestToken) === item.reservation.guestCancelTokenHash;

      if (!isReserverUser && !isGuestTokenMatch) {
        return NextResponse.json(
          { error: "ჯავშნის გაუქმება შეუძლია მხოლოდ იმ ადამიანს, ვინც საჩუქარი დაჯავშნა" },
          { status: 403 }
        );
      }

      item.reservation = null;
      await updateItemInDb(item);

      return NextResponse.json({ ok: true, item });
    }

    // Reserve action: Users cannot reserve their own wishes
    if (isItemOwner) {
      return NextResponse.json(
        { error: "საკუთარი სურვილის დაჯავშნა არ შეიძლება" },
        { status: 403 }
      );
    }

    if (item.reservation) {
      return NextResponse.json(
        { error: "ეს საჩუქარი უკვე დაჯავშნილია" },
        { status: 409 }
      );
    }

    const isAnonymousForAll = Boolean(body.isAnonymousForAll);

    const reservedByName = isAnonymousForAll
      ? "ანონიმური"
      : currentUser
      ? (body.reservedByName || "").trim() || currentUser.name
      : (body.reservedByName || "").trim();

    if (!reservedByName) {
      return NextResponse.json(
        { error: "გთხოვთ მიუთითოთ თქვენი სახელი ან აირჩიოთ ანონიმური დაჯავშნა" },
        { status: 400 }
      );
    }

    const guestCancelToken = crypto.randomBytes(16).toString("hex");

    item.reservation = {
      id: `res-${Date.now()}`,
      reservedByUserId: currentUser?.id,
      reservedByUsername: currentUser?.username,
      reservedByName,
      isAnonymousToPublic: isAnonymousForAll,
      hideFromOwnerSpoilerFree: isAnonymousForAll,
      note: (body.note || "").trim() || undefined,
      guestCancelTokenHash: hashToken(guestCancelToken),
      reservedAt: new Date().toISOString(),
    };

    await updateItemInDb(item);

    const { guestCancelTokenHash, ...safeReservation } = item.reservation;
    void guestCancelTokenHash;

    return NextResponse.json({
      ok: true,
      item: {
        ...item,
        reservation: safeReservation,
      },
      guestCancelToken,
    });
  } catch {
    return NextResponse.json({ error: "Reservation failed" }, { status: 500 });
  }
}
