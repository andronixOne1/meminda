import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, WishItemRecord } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const wishlistId = body.wishlistId;
    const title = (body.title || "").trim();
    const description = (body.description || "").trim();
    const price = Math.max(1, Math.round(Number(body.price) || 100));
    const imageUrl =
      (body.imageUrl || "").trim() ||
      "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=900&q=80";
    const productUrl = (body.productUrl || "").trim() || undefined;
    const storeName = (body.storeName || "").trim() || undefined;
    const priority = body.priority || "high";

    if (!wishlistId || !title) {
      return NextResponse.json(
        { error: "Wishlist and item title are required" },
        { status: 400 }
      );
    }

    const db = await readDb();
    const wishlist = db.wishlists.find((w) => w.id === wishlistId);
    if (!wishlist || wishlist.ownerId !== currentUser.id) {
      return NextResponse.json(
        { error: "You can only add items to your own wishlist" },
        { status: 403 }
      );
    }

    const newItem: WishItemRecord = {
      id: `item-${Date.now()}`,
      wishlistId,
      ownerId: currentUser.id,
      title,
      description,
      price,
      originalPrice: body.originalPrice ? Number(body.originalPrice) : undefined,
      originalCurrency: body.originalCurrency || undefined,
      imageUrl,
      productUrl,
      storeName,
      priority,
      reservation: null,
      createdAt: new Date().toISOString(),
    };

    db.items.unshift(newItem);
    await writeDb(db);

    return NextResponse.json({ item: newItem });
  } catch {
    return NextResponse.json({ error: "Failed to add item" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("id");
  if (!itemId) {
    return NextResponse.json({ error: "Missing item id" }, { status: 400 });
  }

  const db = await readDb();
  const item = db.items.find((i) => i.id === itemId);
  if (!item || item.ownerId !== currentUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  db.items = db.items.filter((i) => i.id !== itemId);
  await writeDb(db);

  return NextResponse.json({ ok: true });
}
