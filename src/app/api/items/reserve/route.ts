import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { readDb, writeDb, hashToken } from "@/lib/db";
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
    const currentUser = await getCurrentUser();

    if (action === "unreserve") {
      if (!item.reservation) {
        return NextResponse.json({ ok: true, item });
      }

      const guestToken = body.guestCancelToken || "";
      const isOwner = currentUser && currentUser.id === item.ownerId;
      const isReserverUser =
        currentUser &&
        item.reservation.reservedByUserId &&
        currentUser.id === item.reservation.reservedByUserId;
      const isGuestTokenMatch =
        guestToken &&
        item.reservation.guestCancelTokenHash &&
        hashToken(guestToken) === item.reservation.guestCancelTokenHash;

      if (!isOwner && !isReserverUser && !isGuestTokenMatch) {
        return NextResponse.json(
          { error: "ჯავშნის გაუქმება შეუძლია მხოლოდ დამჯავშნელს ან სიის მფლობელს" },
          { status: 403 }
        );
      }

      db.items[itemIndex].reservation = null;
      await writeDb(db);

      return NextResponse.json({ ok: true, item: db.items[itemIndex] });
    }

    // Reserve action
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

    db.items[itemIndex].reservation = {
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

    await writeDb(db);

    const { guestCancelTokenHash, ...safeReservation } =
      db.items[itemIndex].reservation!;
    void guestCancelTokenHash;

    return NextResponse.json({
      ok: true,
      item: {
        ...db.items[itemIndex],
        reservation: safeReservation,
      },
      guestCancelToken,
    });
  } catch {
    return NextResponse.json({ error: "Reservation failed" }, { status: 500 });
  }
}
