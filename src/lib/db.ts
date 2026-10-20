import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  collection,
  getDocs,
  doc,
  writeBatch,
} from "firebase/firestore";
import { firestoreDb } from "./firebase";

export interface UserRecord {
  id: string;
  firebaseUid?: string;
  username: string;
  name: string;
  email: string;
  passwordHash: string;
  bioKa: string;
  bioEn: string;
  avatarUrl: string;
  createdAt: string;
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
  priority: "high" | "medium" | "low";
  reservation: ReservationInfo | null;
  createdAt: string;
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
      priority: "high",
      reservation: null,
      createdAt: "2026-10-10T10:00:00.000Z",
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
      priority: "high",
      reservation: null,
      createdAt: "2026-10-12T10:00:00.000Z",
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
      priority: "high",
      reservation: null,
      createdAt: "2026-10-13T10:00:00.000Z",
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
      priority: "medium",
      reservation: null,
      createdAt: "2026-10-14T10:00:00.000Z",
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
      priority: "high",
      reservation: null,
      createdAt: "2026-10-14T11:00:00.000Z",
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
      priority: "medium",
      reservation: null,
      createdAt: "2026-10-15T11:00:00.000Z",
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

// Track known document IDs so deletions are also committed to Firestore
let lastKnownItemIds = new Set<string>();
let lastKnownWishlistIds = new Set<string>();

/**
 * Reads all Users, Wishlists, and WishItems from Cloud Firestore.
 * If Firestore is empty on first run, seeds it with any existing local DB data or initial seed data.
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

    // Upsert users
    for (const user of data.users) {
      const ref = doc(firestoreDb, "users", user.id);
      batch.set(ref, cleanForFirestore(user));
    }

    // Upsert wishlists & delete removed wishlists
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

    // Upsert items & delete removed items
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
