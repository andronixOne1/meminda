import { NextResponse } from "next/server";
import { collection, getDocs } from "firebase/firestore";
import { firestoreDb } from "@/lib/firebase";
import {
  readDb,
  extractStoreDomain,
  inferProductCategory,
  DeletedWishItemRecord,
  AnalyticsEventRecord,
  ProductCategory,
} from "@/lib/db";

export async function GET() {
  try {
    const db = await readDb();

    // Also fetch archived deleted_items and recent analytics_events from Firestore
    let deletedItems: DeletedWishItemRecord[] = [];
    let analyticsEvents: AnalyticsEventRecord[] = [];

    try {
      const [delSnap, eventsSnap] = await Promise.all([
        getDocs(collection(firestoreDb, "deleted_items")),
        getDocs(collection(firestoreDb, "analytics_events")),
      ]);
      deletedItems = delSnap.docs.map(
        (d) => d.data() as DeletedWishItemRecord
      );
      analyticsEvents = eventsSnap.docs
        .map((d) => d.data() as AnalyticsEventRecord)
        .sort(
          (a, b) =>
            new Date(b.timestamp || 0).getTime() -
            new Date(a.timestamp || 0).getTime()
        );
    } catch (err) {
      console.error("Failed to fetch extended analytics collections:", err);
    }

    // 1. User Demographics Breakdown (Gender & Age Groups)
    const genderBreakdown: Record<string, number> = {
      female: 0,
      male: 0,
      other: 0,
      prefer_not_to_say: 0,
      unspecified: 0,
    };

    const ageGroups: Record<string, number> = {
      "under_18": 0,
      "18_24": 0,
      "25_34": 0,
      "35_44": 0,
      "45_plus": 0,
      unspecified: 0,
    };

    let totalAgeSum = 0;
    let usersWithAgeCount = 0;

    for (const u of db.users) {
      const g = u.gender || "unspecified";
      genderBreakdown[g] = (genderBreakdown[g] || 0) + 1;

      const age = u.age;
      if (typeof age === "number" && age > 0) {
        totalAgeSum += age;
        usersWithAgeCount += 1;
        if (age < 18) ageGroups["under_18"] += 1;
        else if (age <= 24) ageGroups["18_24"] += 1;
        else if (age <= 34) ageGroups["25_34"] += 1;
        else if (age <= 44) ageGroups["35_44"] += 1;
        else ageGroups["45_plus"] += 1;
      } else {
        ageGroups["unspecified"] += 1;
      }
    }

    // 2. Shops Linked & Product Categories Breakdown (across both active & deleted wishes)
    const shopsLinked: Record<
      string,
      {
        activeCount: number;
        deletedCount: number;
        reservedCount: number;
        totalValueGel: number;
        averagePriceGel: number;
      }
    > = {};

    const categoriesBreakdown: Record<
      string,
      {
        activeCount: number;
        deletedCount: number;
        reservedCount: number;
        totalValueGel: number;
        averagePriceGel: number;
      }
    > = {};

    for (const item of db.items) {
      const domain =
        item.storeDomain ||
        extractStoreDomain(item.productUrl, item.storeName) ||
        "manual_entry";
      const cat: ProductCategory =
        item.category ||
        inferProductCategory(
          item.title,
          item.description,
          item.storeName,
          item.productUrl
        );

      if (!shopsLinked[domain]) {
        shopsLinked[domain] = {
          activeCount: 0,
          deletedCount: 0,
          reservedCount: 0,
          totalValueGel: 0,
          averagePriceGel: 0,
        };
      }
      shopsLinked[domain].activeCount += 1;
      shopsLinked[domain].totalValueGel += item.price || 0;
      if (item.reservation) {
        shopsLinked[domain].reservedCount += 1;
      }

      if (!categoriesBreakdown[cat]) {
        categoriesBreakdown[cat] = {
          activeCount: 0,
          deletedCount: 0,
          reservedCount: 0,
          totalValueGel: 0,
          averagePriceGel: 0,
        };
      }
      categoriesBreakdown[cat].activeCount += 1;
      categoriesBreakdown[cat].totalValueGel += item.price || 0;
      if (item.reservation) {
        categoriesBreakdown[cat].reservedCount += 1;
      }
    }

    let totalLifespanSeconds = 0;
    let deletedWithLifespanCount = 0;

    for (const del of deletedItems) {
      const domain =
        del.storeDomain ||
        extractStoreDomain(del.productUrl, del.storeName) ||
        "manual_entry";
      const cat: ProductCategory =
        del.category ||
        inferProductCategory(
          del.title,
          del.description,
          del.storeName,
          del.productUrl
        );

      if (!shopsLinked[domain]) {
        shopsLinked[domain] = {
          activeCount: 0,
          deletedCount: 0,
          reservedCount: 0,
          totalValueGel: 0,
          averagePriceGel: 0,
        };
      }
      shopsLinked[domain].deletedCount += 1;

      if (!categoriesBreakdown[cat]) {
        categoriesBreakdown[cat] = {
          activeCount: 0,
          deletedCount: 0,
          reservedCount: 0,
          totalValueGel: 0,
          averagePriceGel: 0,
        };
      }
      categoriesBreakdown[cat].deletedCount += 1;

      if (typeof del.lifespanSeconds === "number" && del.lifespanSeconds >= 0) {
        totalLifespanSeconds += del.lifespanSeconds;
        deletedWithLifespanCount += 1;
      }
    }

    for (const domain of Object.keys(shopsLinked)) {
      const s = shopsLinked[domain];
      s.averagePriceGel =
        s.activeCount > 0 ? Math.round(s.totalValueGel / s.activeCount) : 0;
    }

    for (const cat of Object.keys(categoriesBreakdown)) {
      const c = categoriesBreakdown[cat];
      c.averagePriceGel =
        c.activeCount > 0 ? Math.round(c.totalValueGel / c.activeCount) : 0;
    }

    const activeReservedCount = db.items.filter((i) => Boolean(i.reservation)).length;

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      overview: {
        totalUsers: db.users.length,
        totalWishlists: db.wishlists.length,
        activeWishesCount: db.items.length,
        activeReservedCount,
        deletedWishesCount: deletedItems.length,
        totalEventsLogged: analyticsEvents.length,
        averageUserAge:
          usersWithAgeCount > 0
            ? Number((totalAgeSum / usersWithAgeCount).toFixed(1))
            : null,
        averageDeletedWishLifespanHours:
          deletedWithLifespanCount > 0
            ? Number(
                (totalLifespanSeconds / deletedWithLifespanCount / 3600).toFixed(2)
              )
            : null,
      },
      demographics: {
        byGender: genderBreakdown,
        byAgeGroup: ageGroups,
      },
      shopsLinked,
      productCategories: categoriesBreakdown,
      recentDeletedWishes: deletedItems
        .sort(
          (a, b) =>
            new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
        )
        .slice(0, 50),
      recentEvents: analyticsEvents.slice(0, 100),
    });
  } catch (err) {
    console.error("Error generating analytics summary:", err);
    return NextResponse.json(
      { error: "Failed to generate analytics summary" },
      { status: 500 }
    );
  }
}
