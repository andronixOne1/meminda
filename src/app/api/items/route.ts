import { NextRequest, NextResponse } from "next/server";
import {
  readDb,
  updateItemInDb,
  deleteItemFromDb,
  archiveDeletedItemInDb,
  logAnalyticsEvent,
  extractStoreDomain,
  inferProductCategory,
  ProductCategory,
  WishItemRecord,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const VALID_CATEGORIES: ProductCategory[] = [
  "tech",
  "beauty",
  "fashion",
  "home",
  "books_hobbies",
  "sports_outdoors",
  "kids_toys",
  "jewelry_accessories",
  "experiences",
  "other",
];

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
    const storeDomain = extractStoreDomain(productUrl, storeName);
    const category: ProductCategory = VALID_CATEGORIES.includes(body.category)
      ? body.category
      : inferProductCategory(title, description, storeName, productUrl);
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

    const nowIso = new Date().toISOString();
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
      storeDomain,
      category,
      priority,
      reservation: null,
      createdAt: nowIso,
      wishlistedAt: nowIso,
    };

    await updateItemInDb(newItem);

    await logAnalyticsEvent({
      eventType: "wish_created",
      userId: currentUser.id,
      username: currentUser.username,
      userGender: currentUser.gender,
      userAge: currentUser.age,
      itemId: newItem.id,
      wishlistId: newItem.wishlistId,
      itemTitle: newItem.title,
      priceGel: newItem.price,
      originalPrice: newItem.originalPrice,
      originalCurrency: newItem.originalCurrency,
      storeName: newItem.storeName,
      storeDomain: newItem.storeDomain,
      productUrl: newItem.productUrl,
      category: newItem.category,
      priority: newItem.priority,
    });

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

  const archived = await archiveDeletedItemInDb(item, currentUser);
  await deleteItemFromDb(itemId);

  await logAnalyticsEvent({
    eventType: "wish_deleted",
    userId: currentUser.id,
    username: currentUser.username,
    userGender: currentUser.gender,
    userAge: currentUser.age,
    itemId: item.id,
    wishlistId: item.wishlistId,
    itemTitle: item.title,
    priceGel: item.price,
    originalPrice: item.originalPrice,
    originalCurrency: item.originalCurrency,
    storeName: item.storeName,
    storeDomain: archived.storeDomain,
    productUrl: item.productUrl,
    category: archived.category,
    priority: item.priority,
    wishlistedAt: archived.wishlistedAt,
    deletedAt: archived.deletedAt,
    lifespanSeconds: archived.lifespanSeconds,
    wasReservedWhenDeleted: archived.wasReservedWhenDeleted,
  });

  return NextResponse.json({ ok: true });
}
