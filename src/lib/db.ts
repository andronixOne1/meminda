import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { firestoreDb } from "./firebase";

export type UserGender = "female" | "male" | "other" | "prefer_not_to_say";

export type ProductCategory =
  | "tech"
  | "beauty"
  | "fashion"
  | "home"
  | "books_hobbies"
  | "sports_outdoors"
  | "kids_toys"
  | "jewelry_accessories"
  | "experiences"
  | "other";

export interface UserRecord {
  id: string;
  firebaseUid?: string;
  username: string;
  name: string;
  email: string;
  passwordHash: string;
  gender?: UserGender;
  age?: number;
  birthYear?: number;
  bioKa: string;
  bioEn: string;
  avatarUrl: string;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface ReservationInfo {
  id: string;
  reservedByUserId?: string;
  reservedByUsername?: string;
  reservedByName: string;
  isAnonymousToPublic: boolean;
  hideFromOwnerSpoilerFree: boolean;
  note?: string;
  guestCancelTokenHash?: string;
  reservedAt: string;
}

export interface WishItemRecord {
  id: string;
  wishlistId: string;
  ownerId: string;
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  originalCurrency?: string;
  imageUrl: string;
  productUrl?: string;
  storeName?: string;
  storeDomain?: string;
  category?: ProductCategory;
  priority: "high" | "medium" | "low";
  reservation: ReservationInfo | null;
  createdAt: string; // Exact timestamp when product was wishlisted
  wishlistedAt?: string;
}

export interface DeletedWishItemRecord extends WishItemRecord {
  deletedAt: string;
  deletedByUserId: string;
  wasReservedWhenDeleted: boolean;
  lifespanSeconds: number;
  ownerGender?: UserGender;
  ownerAge?: number;
}

export type AnalyticsEventType =
  | "user_registered"
  | "user_login"
  | "user_profile_updated"
  | "wishlist_created"
  | "product_scraped"
  | "wish_created"
  | "wish_deleted"
  | "wish_reserved"
  | "wish_unreserved";

export interface AnalyticsEventRecord {
  id: string;
  eventType: AnalyticsEventType;
  timestamp: string;
  userId?: string;
  username?: string;
  userGender?: UserGender;
  userAge?: number;
  wishlistId?: string;
  wishlistOccasion?: WishlistRecord["occasion"];
  itemId?: string;
  itemTitle?: string;
  category?: ProductCategory;
  productCategory?: ProductCategory;
  priceGel?: number;
  originalPrice?: number;
  originalCurrency?: string;
  storeName?: string;
  storeDomain?: string;
  productUrl?: string;
  priority?: "high" | "medium" | "low";
  wishlistedAt?: string;
  deletedAt?: string;
  lifespanSeconds?: number;
  wasReservedWhenDeleted?: boolean;
  reservedAt?: string;
  wasReserved?: boolean;
  isAnonymousReservation?: boolean;
  metadata?: Record<string, unknown>;
}

export interface WishlistRecord {
  id: string;
  slug: string;
  ownerId: string;
  title: string;
  description: string;
  occasion: "birthday" | "wedding" | "housewarming" | "baby" | "christmas" | "other";
  eventDate?: string;
  isPublic: boolean;
  createdAt: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
}

export interface DatabaseSchema {
  users: UserRecord[];
  wishlists: WishlistRecord[];
  items: WishItemRecord[];
  sessions: SessionRecord[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "meminda-db.json");

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(`meminda_salt_${password}`).digest("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(`meminda_cancel_${token}`).digest("hex");
}

function cleanForFirestore<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function getInitialSeedData(): DatabaseSchema {
  const niniId = "user-nini";
  const giorgiId = "user-giorgi";

  const users: UserRecord[] = [
    {
      id: niniId,
      username: "nini",
      name: "ნინი შენგელია",
      email: "nini@meminda.ge",
      passwordHash: hashPassword("demo123"),
      gender: "female",
      age: 25,
      birthYear: 2001,
      bioKa:
        "დიზაინერი თბილისიდან ✨ აქ ნახავთ ჩემი დაბადების დღისა და ახალმოსახლეობის სურვილების სიებს!",
      bioEn:
        "Product Designer in Tbilisi ✨ Here are my birthday & housewarming wishlists!",
      avatarUrl:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
      createdAt: "2026-10-01T10:00:00.000Z",
    },
    {
      id: giorgiId,
      username: "giorgi",
      name: "გიორგი კვარაცხელია",
      email: "giorgi@meminda.ge",
      passwordHash: hashPassword("demo123"),
      gender: "male",
      age: 26,
      birthYear: 2000,
      bioKa: "ტექნოლოგიების, ყავის და მთაში ლაშქრობის მოყვარული 🏔️☕",
      bioEn: "Tech, specialty coffee & mountain hiking enthusiast 🏔️☕",
      avatarUrl:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
      createdAt: "2026-10-02T10:00:00.000Z",
    },
  ];

  const wishlists: WishlistRecord[] = [
    {
      id: "wl-nini-bday",
      slug: "nini-birthday-25",
      ownerId: niniId,
      title: "ნინის 25 წლის დაბადების დღე 🎂",
      description:
        "საჩუქრები, რომლებიც ყველაზე მეტად გამიხარდება! დაჯავშნეთ ნებისმიერი ნივთი, რომ არ განმეორდეს.",
      occasion: "birthday",
      eventDate: "2026-11-15",
      isPublic: true,
      createdAt: "2026-10-05T12:00:00.000Z",
    },
    {
      id: "wl-nini-home",
      slug: "nini-new-home",
      ownerId: niniId,
      title: "ახალმოსახლეობის სია 🏡",
      description: "ნივთები ჩემი ახალი ბინისთვის და სამზარეულოსთვის.",
      occasion: "housewarming",
      eventDate: "2026-12-01",
      isPublic: true,
      createdAt: "2026-10-08T12:00:00.000Z",
    },
    {
      id: "wl-giorgi-bday",
      slug: "giorgi-wishlist",
      ownerId: giorgiId,
      title: "გიორგის სურვილების სია 🎧",
      description: "გაჯეტები, წიგნები და სალაშქრო აღჭურვილობა.",
      occasion: "birthday",
      eventDate: "2026-11-28",
      isPublic: true,
      createdAt: "2026-10-09T12:00:00.000Z",
    },
  ];

  const items: WishItemRecord[] = [
    {
      id: "item-101",
      wishlistId: "wl-nini-bday",
      ownerId: niniId,
      title: "Apple AirPods Pro 2 (USB-C) MagSafe Case",
      description:
        "უსადენო ყურსასმენი ხმაურის აქტიური ჩახშობით. იყიდება Zoommer-ში.",
      price: 749,
      imageUrl:
        "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=900&q=80",
      productUrl: "https://zoommer.ge",
      storeName: "Zoommer.ge",
      storeDomain: "zoommer.ge",
      category: "tech",
      priority: "high",
      reservation: null,
      createdAt: "2026-10-10T10:00:00.000Z",
      wishlistedAt: "2026-10-10T10:00:00.000Z",
    },
    {
      id: "item-102",
      wishlistId: "wl-nini-bday",
      ownerId: niniId,
      title: "Stanley Quencher H2.0 თერმო ჭიქა 1.18L (Rose Quartz)",
      description: "ვარდისფერი ან კრემისფერი მოდელი Veli.store-დან.",
      price: 159,
      imageUrl:
        "https://images.unsplash.com/photo-1570831739435-6601aa3fa4fb?auto=format&fit=crop&w=900&q=80",
      productUrl: "https://veli.store",
      storeName: "Veli.store",
      storeDomain: "veli.store",
      category: "home",
      priority: "medium",
      reservation: {
        id: "res-seed-1",
        reservedByUserId: giorgiId,
        reservedByUsername: "giorgi",
        reservedByName: "გიორგი კვარაცხელია",
        isAnonymousToPublic: false,
        hideFromOwnerSpoilerFree: false,
        note: "მე ვყიდულობ ამას დაბადების დღისთვის! 🎁",
        reservedAt: "2026-10-15T14:20:00.000Z",
      },
      createdAt: "2026-10-11T10:00:00.000Z",
      wishlistedAt: "2026-10-11T10:00:00.000Z",
    },
    {
      id: "item-103",
      wishlistId: "wl-nini-bday",
      ownerId: niniId,
      title: "Maison Francis Kurkdjian Baccarat Rouge 540 (35ml)",
      description: "სუნამო Lutecia-დან ან Voulez-Vous-დან.",
      price: 540,
      imageUrl:
        "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=80",
      productUrl: "https://lutecia.ge",
      storeName: "Lutecia.ge",
      storeDomain: "lutecia.ge",
      category: "beauty",
      priority: "high",
      reservation: null,
      createdAt: "2026-10-12T10:00:00.000Z",
      wishlistedAt: "2026-10-12T10:00:00.000Z",
    },
    {
      id: "item-104",
      wishlistId: "wl-nini-home",
      ownerId: niniId,
      title: "DeLonghi Dedica ესპრესოს აპარატი EC685.M",
      description: "ვერცხლისფერი ყავის აპარატი ახალი სამზარეულოსთვის.",
      price: 689,
      imageUrl:
        "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=900&q=80",
      productUrl: "https://extra.ge",
      storeName: "Extra.ge",
      storeDomain: "extra.ge",
      category: "home",
      priority: "high",
      reservation: null,
      createdAt: "2026-10-13T10:00:00.000Z",
      wishlistedAt: "2026-10-13T10:00:00.000Z",
    },
    {
      id: "item-105",
      wishlistId: "wl-nini-home",
      ownerId: niniId,
      title: "ხელნაკეთი ქართული კერამიკის ლარნაკი",
      description: "ლურჯი ან თეთრი თიხის ლარნაკი მისაღები ოთახისთვის.",
      price: 120,
      imageUrl:
        "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=900&q=80",
      productUrl: "https://instagram.com",
      storeName: "Ceramic Studio Tbilisi",
      storeDomain: "instagram.com",
      category: "home",
      priority: "medium",
      reservation: null,
      createdAt: "2026-10-14T10:00:00.000Z",
      wishlistedAt: "2026-10-14T10:00:00.000Z",
    },
    {
      id: "item-201",
      wishlistId: "wl-giorgi-bday",
      ownerId: giorgiId,
      title: "Kindle Paperwhite (16 GB) — შავი",
      description: "წყალგამძლე ელექტრონული წიგნი 6.8 ინჩიანი ეკრანით.",
      price: 495,
      imageUrl:
        "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=900&q=80",
      productUrl: "https://www.amazon.com/dp/B09TMN58KL",
      storeName: "Amazon",
      storeDomain: "amazon.com",
      category: "tech",
      priority: "high",
      reservation: null,
      createdAt: "2026-10-14T11:00:00.000Z",
      wishlistedAt: "2026-10-14T11:00:00.000Z",
    },
    {
      id: "item-202",
      wishlistId: "wl-giorgi-bday",
      ownerId: giorgiId,
      title: "AeroPress Clear ყავის მოსამზადებელი",
      description:
        "საუკეთესო ფილტრ-ყავის დასამზადებლად სახლში და ლაშქრობაში.",
      price: 145,
      imageUrl:
        "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=80",
      productUrl: "https://veli.store",
      storeName: "Veli.store",
      storeDomain: "veli.store",
      category: "home",
      priority: "medium",
      reservation: null,
      createdAt: "2026-10-15T11:00:00.000Z",
      wishlistedAt: "2026-10-15T11:00:00.000Z",
    },
  ];

  return {
    users,
    wishlists,
    items,
    sessions: [],
  };
}

function readLocalFallbackDb(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(raw) as DatabaseSchema;
    }
  } catch {
    // Ignore local read error
  }
  return getInitialSeedData();
}

function writeLocalFallbackDb(data: DatabaseSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // Ignore on read-only environments
  }
}

let lastKnownItemIds = new Set<string>();
let lastKnownWishlistIds = new Set<string>();

/**
 * Reads all Users, Wishlists, and WishItems from Cloud Firestore.
 */
export async function readDb(): Promise<DatabaseSchema> {
  try {
    const [usersSnap, wishlistsSnap, itemsSnap] = await Promise.all([
      getDocs(collection(firestoreDb, "users")),
      getDocs(collection(firestoreDb, "wishlists")),
      getDocs(collection(firestoreDb, "items")),
    ]);

    if (usersSnap.empty) {
      const initialData = readLocalFallbackDb();
      await writeDb(initialData);
      return initialData;
    }

    const users: UserRecord[] = usersSnap.docs
      .map((d) => d.data() as UserRecord)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

    const wishlists: WishlistRecord[] = wishlistsSnap.docs
      .map((d) => d.data() as WishlistRecord)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    const items: WishItemRecord[] = itemsSnap.docs
      .map((d) => d.data() as WishItemRecord)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    lastKnownWishlistIds = new Set(wishlists.map((w) => w.id));
    lastKnownItemIds = new Set(items.map((i) => i.id));

    return {
      users,
      wishlists,
      items,
      sessions: [],
    };
  } catch (err) {
    console.error("Firestore read error, falling back to local DB:", err);
    return readLocalFallbackDb();
  }
}

/**
 * Persists Users, Wishlists, and WishItems into Cloud Firestore collections.
 */
export async function writeDb(data: DatabaseSchema): Promise<void> {
  writeLocalFallbackDb(data);

  try {
    const batch = writeBatch(firestoreDb);

    for (const user of data.users) {
      const ref = doc(firestoreDb, "users", user.id);
      batch.set(ref, cleanForFirestore(user));
    }

    const currentWlIds = new Set<string>();
    for (const wl of data.wishlists) {
      currentWlIds.add(wl.id);
      const ref = doc(firestoreDb, "wishlists", wl.id);
      batch.set(ref, cleanForFirestore(wl));
    }
    for (const oldWlId of lastKnownWishlistIds) {
      if (!currentWlIds.has(oldWlId)) {
        batch.delete(doc(firestoreDb, "wishlists", oldWlId));
      }
    }

    const currentItemIds = new Set<string>();
    for (const item of data.items) {
      currentItemIds.add(item.id);
      const ref = doc(firestoreDb, "items", item.id);
      batch.set(ref, cleanForFirestore(item));
    }
    for (const oldItemId of lastKnownItemIds) {
      if (!currentItemIds.has(oldItemId)) {
        batch.delete(doc(firestoreDb, "items", oldItemId));
      }
    }

    await batch.commit();

    lastKnownWishlistIds = currentWlIds;
    lastKnownItemIds = currentItemIds;
  } catch (err) {
    console.error("Failed to write to Firestore:", err);
  }
}

/**
 * Atomically upserts a single WishItemRecord in Cloud Firestore (and local fallback).
 */
export async function updateItemInDb(item: WishItemRecord): Promise<void> {
  try {
    const ref = doc(firestoreDb, "items", item.id);
    await setDoc(ref, cleanForFirestore(item));
    lastKnownItemIds.add(item.id);
  } catch (err) {
    console.error("Failed to update item in Firestore:", err);
  }

  try {
    const localData = readLocalFallbackDb();
    const idx = localData.items.findIndex((i) => i.id === item.id);
    if (idx !== -1) {
      localData.items[idx] = item;
    } else {
      localData.items.unshift(item);
    }
    writeLocalFallbackDb(localData);
  } catch {
    // Ignore local fallback error
  }
}

/**
 * Atomically deletes a single WishItemRecord from Cloud Firestore (and local fallback).
 */
export async function deleteItemFromDb(itemId: string): Promise<void> {
  try {
    const ref = doc(firestoreDb, "items", itemId);
    await deleteDoc(ref);
    lastKnownItemIds.delete(itemId);
  } catch (err) {
    console.error("Failed to delete item from Firestore:", err);
  }

  try {
    const localData = readLocalFallbackDb();
    localData.items = localData.items.filter((i) => i.id !== itemId);
    writeLocalFallbackDb(localData);
  } catch {
    // Ignore local fallback error
  }
}

/**
 * Atomically upserts a single WishlistRecord in Cloud Firestore (and local fallback).
 */
export async function updateWishlistInDb(wl: WishlistRecord): Promise<void> {
  try {
    const ref = doc(firestoreDb, "wishlists", wl.id);
    await setDoc(ref, cleanForFirestore(wl));
    lastKnownWishlistIds.add(wl.id);
  } catch (err) {
    console.error("Failed to update wishlist in Firestore:", err);
  }

  try {
    const localData = readLocalFallbackDb();
    const idx = localData.wishlists.findIndex((w) => w.id === wl.id);
    if (idx !== -1) {
      localData.wishlists[idx] = wl;
    } else {
      localData.wishlists.unshift(wl);
    }
    writeLocalFallbackDb(localData);
  } catch {
    // Ignore local fallback error
  }
}

/**
 * Atomically upserts a single UserRecord in Cloud Firestore (and local fallback).
 */
export async function updateUserInDb(user: UserRecord): Promise<void> {
  try {
    const ref = doc(firestoreDb, "users", user.id);
    await setDoc(ref, cleanForFirestore(user));
  } catch (err) {
    console.error("Failed to update user in Firestore:", err);
  }

  try {
    const localData = readLocalFallbackDb();
    const idx = localData.users.findIndex((u) => u.id === user.id);
    if (idx !== -1) {
      localData.users[idx] = user;
    } else {
      localData.users.push(user);
    }
    writeLocalFallbackDb(localData);
  } catch {
    // Ignore local fallback error
  }
}

/**
 * Extracts normalized store domain from a product URL or store name.
 */
export function extractStoreDomain(
  productUrl?: string,
  storeName?: string
): string | undefined {
  if (productUrl) {
    try {
      const u = new URL(
        productUrl.startsWith("http") ? productUrl : `https://${productUrl}`
      );
      return u.hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      // Fall through
    }
  }
  if (storeName) {
    return storeName.trim().toLowerCase();
  }
  return undefined;
}

/**
 * Automatically infers a ProductCategory from product title, description, store name, or URL
 * when not explicitly specified.
 */
export function inferProductCategory(
  title = "",
  description = "",
  storeName = "",
  productUrl = ""
): ProductCategory {
  const combined = `${title} ${description} ${storeName} ${productUrl}`.toLowerCase();

  if (
    /iphone|macbook|airpods|samsung|galaxy|xiaomi|playstation|xbox|nintendo|laptop|notebook|monitor|mouse|keyboard|headphone|earbuds|speaker|camera|kindle|ipad|tablet|watch|smartwatch|dyson|ტელეფონი|ლეპტოპი|ყურსასმენი|მაუსი|კლავიატურა|ფოტოაპარატი|საათი|zoommer|alta/.test(
      combined
    )
  ) {
    return "tech";
  }
  if (
    /perfume|parfum|fragrance|eau de|cosmetic|makeup|lipstick|skincare|serum|cream|shampoo|hair|dyson airwrap|lutecia|voulez|ici paris|sephora|სუნამო|კოსმეტიკა|თავის მოვლა|ტუჩსაცხი|კრემი/.test(
      combined
    )
  ) {
    return "beauty";
  }
  if (
    /dress|shirt|jacket|hoodie|jeans|sneakers|shoes|boots|bag|handbag|backpack|coat|zara|asos|nike|adidas|dressup|ტანსაცმელი|ფეხსაცმელი|ჩანთა|ქურთუკი|კაბა|ბოტასი/.test(
      combined
    )
  ) {
    return "fashion";
  }
  if (
    /coffee|espresso|delonghi|kitchen|blender|air fryer|vacuum|lamp|decor|vase|candle|bedding|mug|tumbler|stanley|aeropress|ყავის|სამზარეულო|ლარნაკი|ჭიქა|თერმოსი|სახლის|დეკორი/.test(
      combined
    )
  ) {
    return "home";
  }
  if (
    /treadmill|fitness|yoga|dumbbell|tent|camping|bicycle|bike|sport|სარბენი|ბილიკი|სპორტ|ჰანტელი|ველოსიპედი|კარავი/.test(
      combined
    )
  ) {
    return "sports_outdoors";
  }
  if (
    /sanrio|plush|mascot|lego|toy|doll|puzzle|board game|baby|stroller|სათამაშო|ლეგო|თოჯინა|ბავშვ/.test(
      combined
    )
  ) {
    return "kids_toys";
  }
  if (
    /ring|necklace|bracelet|earring|gold|silver|pandora|swarovski|sunglasses|სამკაული|ბეჭედი|ყელსაბამი|სამაჯური|სათვალე/.test(
      combined
    )
  ) {
    return "jewelry_accessories";
  }
  if (
    /book|novel|vinyl|record|guitar|piano|art|paint|წიგნი|ფირფიტა|გიტარა|ხატვა/.test(
      combined
    )
  ) {
    return "books_hobbies";
  }
  if (
    /voucher|gift card|spa|massage|ticket|concert|hotel|trip|ვაუჩერი|სასაჩუქრე ბარათი|ბილეთი|სპა/.test(
      combined
    )
  ) {
    return "experiences";
  }

  return "other";
}

/**
 * Archives a deleted WishItemRecord into the permanent `deleted_items` Firestore collection
 * so deleted wishes, their lifespan, and whether they were reserved remain available for analytics.
 */
export async function archiveDeletedItemInDb(
  item: WishItemRecord,
  deletedByUser?: UserRecord | null
): Promise<DeletedWishItemRecord> {
  const deletedAt = new Date().toISOString();
  const createdMs = new Date(item.createdAt).getTime() || Date.now();
  const lifespanSeconds = Math.max(
    0,
    Math.round((Date.now() - createdMs) / 1000)
  );

  const archived: DeletedWishItemRecord = {
    ...item,
    storeDomain:
      item.storeDomain || extractStoreDomain(item.productUrl, item.storeName),
    category:
      item.category ||
      inferProductCategory(
        item.title,
        item.description,
        item.storeName,
        item.productUrl
      ),
    wishlistedAt: item.wishlistedAt || item.createdAt,
    deletedAt,
    deletedByUserId: deletedByUser?.id || item.ownerId,
    wasReservedWhenDeleted: Boolean(item.reservation),
    lifespanSeconds,
    ownerGender: deletedByUser?.gender,
    ownerAge: deletedByUser?.age,
  };

  try {
    const ref = doc(firestoreDb, "deleted_items", `${item.id}_${Date.now()}`);
    await setDoc(ref, cleanForFirestore(archived));
  } catch (err) {
    console.error("Failed to archive deleted item in Firestore:", err);
  }

  return archived;
}

/**
 * Logs a structured analytics event to the `analytics_events` Firestore collection.
 */
export async function logAnalyticsEvent(
  event: Omit<AnalyticsEventRecord, "id" | "timestamp"> & { timestamp?: string }
): Promise<void> {
  const id = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const fullEvent: AnalyticsEventRecord = {
    ...event,
    id,
    timestamp: event.timestamp || new Date().toISOString(),
  };

  try {
    const ref = doc(firestoreDb, "analytics_events", id);
    await setDoc(ref, cleanForFirestore(fullEvent));
  } catch (err) {
    console.error("Failed to log analytics event in Firestore:", err);
  }
}
