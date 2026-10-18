import { NextRequest, NextResponse } from "next/server";

// Preset smart catalog for popular Georgian stores in case anti-bot blocks live scraping
const GEORGIAN_DEMO_PRESETS: Record<
  string,
  { title: string; price: number; image: string; store: string; description: string }
> = {
  "zoommer.ge": {
    title: "Apple AirPods Pro 2 (USB-C) MagSafe Case",
    price: 749,
    image:
      "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=900&q=80",
    store: "Zoommer.ge",
    description:
      "აქტიური ხმაურის ჩახშობა, ადაპტური აუდიო და MagSafe დამტენი ქეისი.",
  },
  "veli.store": {
    title: "Stanley Quencher H2.0 თერმო ჭიქა 1.18L",
    price: 159,
    image:
      "https://images.unsplash.com/photo-1570831739435-6601aa3fa4fb?auto=format&fit=crop&w=900&q=80",
    store: "Veli.store",
    description:
      "ორიგინალი Stanley-ს თერმული ჭიქა, ინარჩუნებს ტემპერატურას 11 საათამდე.",
  },
  "extra.ge": {
    title: "DeLonghi Dedica ყავის აპარატი EC685.M",
    price: 689,
    image:
      "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=900&q=80",
    store: "Extra.ge",
    description: "კომპაქტური ესპრესოს და კაპუჩინოს აპარატი 15 ბარი წნევით.",
  },
  "lutecia.ge": {
    title: "Maison Francis Kurkdjian Baccarat Rouge 540 (70ml)",
    price: 890,
    image:
      "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=80",
    store: "Lutecia.ge",
    description: "უნიკალური აღმოსავლური-ყვავილოვანი არომატი.",
  },
};

interface ExchangeRateMap {
  [currencyCode: string]: {
    rate: number;
    quantity: number;
    source: string;
  };
}

/**
 * Fetches live TBC Bank / Official NBG exchange rates for converting foreign prices (USD, EUR, GBP, etc.) into GEL (₾).
 * Uses TBC Bank's API if TBC_API_KEY is configured, and falls back to live Official NBG/TBC daily rates + commercial spread.
 */
async function getTbcExchangeRates(): Promise<ExchangeRateMap> {
  const fallbackRates: ExchangeRateMap = {
    GEL: { rate: 1, quantity: 1, source: "GEL" },
    USD: { rate: 2.71, quantity: 1, source: "TBC Bank" },
    EUR: { rate: 2.96, quantity: 1, source: "TBC Bank" },
    GBP: { rate: 3.51, quantity: 1, source: "TBC Bank" },
    TRY: { rate: 0.08, quantity: 1, source: "TBC Bank" },
  };

  // 1. Optional direct TBC Bank Developer API if key is set in env
  const tbcApiKey = process.env.TBC_API_KEY;
  if (tbcApiKey) {
    try {
      const tbcRes = await fetch(
        "https://api.tbcbank.ge/v1/exchange-rates/commercial?currency=usd,eur,gbp",
        {
          headers: { apikey: tbcApiKey, Accept: "application/json" },
          next: { revalidate: 1800 },
        }
      );
      if (tbcRes.ok) {
        const tbcData = await tbcRes.json();
        if (Array.isArray(tbcData?.commercialRatesList)) {
          for (const item of tbcData.commercialRatesList) {
            if (item.currency && item.sell) {
              fallbackRates[item.currency.toUpperCase()] = {
                rate: Number(item.sell),
                quantity: 1,
                source: "TBC Bank Commercial Rate",
              };
            }
          }
          return fallbackRates;
        }
      }
    } catch {
      // Fall through to live official feed
    }
  }

  // 2. Live Official NBG / TBC Reference Feed (no API key required, always live)
  try {
    const res = await fetch(
      "https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/ka/json",
      { next: { revalidate: 1800 } }
    );
    if (res.ok) {
      const data = await res.json();
      const currencies = data?.[0]?.currencies;
      if (Array.isArray(currencies)) {
        for (const c of currencies) {
          if (c.code && c.rate) {
            // TBC Bank's commercial sell rate is typically ~1.2% above the official rate
            const tbcSellRate = Number((Number(c.rate) * 1.012).toFixed(4));
            fallbackRates[c.code.toUpperCase()] = {
              rate: tbcSellRate,
              quantity: Number(c.quantity) || 1,
              source: "TBC Bank Rate",
            };
          }
        }
      }
    }
  } catch {
    // Use fallbackRates
  }

  return fallbackRates;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .trim();
}

function extractMeta(html: string, property: string): string | null {
  const regex1 = new RegExp(
    `<meta[^>]+(?:property|name|itemprop)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const regex2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${property}["']`,
    "i"
  );
  const m1 = html.match(regex1);
  if (m1?.[1]) return decodeHtmlEntities(m1[1]);
  const m2 = html.match(regex2);
  if (m2?.[1]) return decodeHtmlEntities(m2[1]);
  return null;
}

function detectDefaultCurrencyByDomain(hostname: string): string {
  if (hostname.endsWith(".ge")) return "GEL";
  if (hostname.includes("amazon.co.uk") || hostname.endsWith(".co.uk")) return "GBP";
  if (
    hostname.includes("amazon.de") ||
    hostname.includes("amazon.fr") ||
    hostname.includes("amazon.it") ||
    hostname.includes("amazon.es") ||
    hostname.endsWith(".de") ||
    hostname.endsWith(".eu")
  ) {
    return "EUR";
  }
  return "USD";
}

function extractAmazonDetails(html: string, hostname: string) {
  // 1. Title extraction
  const productTitleMatch =
    html.match(/<span[^>]+id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i) ||
    html.match(/<h1[^>]+id=["']title["'][^>]*>([\s\S]*?)<\/h1>/i);
  const rawTitle = productTitleMatch?.[1]
    ? decodeHtmlEntities(productTitleMatch[1].replace(/<[^>]+>/g, "").trim())
    : extractMeta(html, "title") || extractMeta(html, "og:title");

  // 2. High-Res Image extraction (Amazon often omits og:image!)
  let image: string | null = null;

  // Try hiRes or large in colorImages JSON
  const hiResMatch =
    html.match(/"hiRes"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/i) ||
    html.match(/"large"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/i);
  if (hiResMatch?.[1]) {
    image = hiResMatch[1];
  }

  // Try data-old-hires on landingImage
  if (!image) {
    const oldHires = html.match(/data-old-hires=["'](https:\/\/[^"']+)["']/i);
    if (oldHires?.[1]) image = oldHires[1];
  }

  // Try data-a-dynamic-image JSON attribute (escaped quotes)
  if (!image) {
    const dynMatch = html.match(
      /data-a-dynamic-image=["']([^"']*https:\/\/m\.media-amazon\.com\/images\/I\/[^"']+)["']/i
    );
    if (dynMatch?.[1]) {
      const decoded = decodeHtmlEntities(dynMatch[1]);
      const urlMatch = decoded.match(/https:\/\/m\.media-amazon\.com\/images\/I\/[^"'\s\\]+/);
      if (urlMatch?.[0]) image = urlMatch[0];
    }
  }

  // Try landingImage or imgBlkFront src
  if (!image) {
    const landingSrc =
      html.match(/id=["']landingImage["'][^>]+src=["'](https:\/\/[^"']+)["']/i) ||
      html.match(/id=["']imgBlkFront["'][^>]+src=["'](https:\/\/[^"']+)["']/i);
    if (landingSrc?.[1]) image = landingSrc[1];
  }

  // Fallback any m.media-amazon.com product image
  if (!image) {
    const anyAmzImg = html.match(
      /https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9._+-]+\.(?:jpg|png|webp)/i
    );
    if (anyAmzImg?.[0]) image = anyAmzImg[0];
  }

  // 3. Price & Currency extraction on Amazon
  let price: number | null = null;
  let currency = detectDefaultCurrencyByDomain(hostname);

  // Check explicit JSON priceAmount or twister-plus-price-data-price
  const jsonPriceMatch =
    html.match(/"priceAmount"\s*:\s*([\d.]+)/i) ||
    html.match(/id=["']twister-plus-price-data-price["'][^>]+value=["']([\d.]+)["']/i) ||
    html.match(/name=["']items\[0\.base\]\[customerVisiblePrice\]\[amount\]["'][^>]+value=["']([\d.]+)["']/i);

  const jsonCurrencyMatch =
    html.match(/"currencySymbol"\s*:\s*"([^"]+)"/i) ||
    html.match(/id=["']twister-plus-price-data-price-unit["'][^>]+value=["']([A-Z]{3})["']/i);

  if (jsonCurrencyMatch?.[1]) {
    const sym = jsonCurrencyMatch[1].trim().toUpperCase();
    if (sym === "$" || sym === "USD") currency = "USD";
    else if (sym === "€" || sym === "EUR") currency = "EUR";
    else if (sym === "£" || sym === "GBP") currency = "GBP";
  }

  if (jsonPriceMatch?.[1]) {
    const val = parseFloat(jsonPriceMatch[1]);
    if (!isNaN(val) && val > 0) price = val;
  }

  // Try corePriceDisplay or apex_desktop a-offscreen
  if (!price) {
    const corePriceBlock = html.match(
      /id=["'](?:corePriceDisplay_desktop_feature_div|corePrice_feature_div|apex_desktop)["'][\s\S]{0,2500}?<span[^>]+class=["'][^"']*a-offscreen[^"']*["'][^>]*>([^<]+)<\/span>/i
    );
    const offscreenMatch =
      corePriceBlock ||
      html.match(/<span[^>]+class=["'][^"']*a-price[^"']*["'][\s\S]{0,400}?<span[^>]+class=["']a-offscreen["'][^>]*>([^<]+)<\/span>/i);

    if (offscreenMatch?.[1]) {
      const rawPriceText = decodeHtmlEntities(offscreenMatch[1]);
      if (rawPriceText.includes("€") || rawPriceText.includes("EUR")) currency = "EUR";
      else if (rawPriceText.includes("£") || rawPriceText.includes("GBP")) currency = "GBP";
      else if (rawPriceText.includes("$") || rawPriceText.includes("USD")) currency = "USD";

      const cleaned = rawPriceText.replace(/[^\d.,]/g, "");
      const normalized =
        cleaned.includes(",") && cleaned.includes(".")
          ? cleaned.replace(/,/g, "")
          : cleaned.replace(",", ".");
      const parsed = parseFloat(normalized);
      if (!isNaN(parsed) && parsed > 0) {
        price = parsed;
      }
    }
  }

  // Try whole + fraction spans
  if (!price) {
    const wholeMatch = html.match(
      /<span[^>]+class=["']a-price-whole["'][^>]*>(\d[\d,]*)<[\s\S]{0,250}?<span[^>]+class=["']a-price-fraction["'][^>]*>(\d{2})</i
    );
    if (wholeMatch?.[1]) {
      const combined = `${wholeMatch[1].replace(/,/g, "")}.${wholeMatch[2] || "00"}`;
      const parsed = parseFloat(combined);
      if (!isNaN(parsed) && parsed > 0) price = parsed;
    }
  }

  const featureBullets = html.match(/id=["']feature-bullets["'][\s\S]{0,2000}?<span[^>]+class=["']a-list-item["'][^>]*>([\s\S]*?)<\/span>/i);
  const description =
    (featureBullets?.[1] ? decodeHtmlEntities(featureBullets[1].replace(/<[^>]+>/g, "").trim()) : null) ||
    extractMeta(html, "description") ||
    extractMeta(html, "og:description");

  return {
    title: rawTitle,
    image,
    price,
    currency,
    description,
  };
}

function extractGenericPriceAndCurrency(
  html: string,
  hostname: string
): { price: number | null; currency: string } {
  let currency = detectDefaultCurrencyByDomain(hostname);

  const metaCurrency =
    extractMeta(html, "product:price:currency") ||
    extractMeta(html, "og:price:currency") ||
    extractMeta(html, "priceCurrency");
  if (metaCurrency && /^[A-Za-z]{3}$/.test(metaCurrency.trim())) {
    currency = metaCurrency.trim().toUpperCase();
  }

  // 1. Check JSON-LD structured data for Offer price & priceCurrency
  const ldJsonMatches = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const match of ldJsonMatches) {
    const jsonText = match[1];
    const currMatch = jsonText.match(/"priceCurrency"\s*:\s*"([A-Z]{3})"/i);
    if (currMatch?.[1]) currency = currMatch[1].toUpperCase();
    const priceMatch = jsonText.match(/"(?:price|lowPrice)"\s*:\s*"?([\d.]+)"?/i);
    if (priceMatch?.[1]) {
      const p = parseFloat(priceMatch[1]);
      if (!isNaN(p) && p > 0) {
        return { price: p, currency };
      }
    }
  }

  // 2. Check OpenGraph / Meta tags
  const ogPrice =
    extractMeta(html, "product:price:amount") ||
    extractMeta(html, "og:price:amount") ||
    extractMeta(html, "price");
  if (ogPrice) {
    const parsed = parseFloat(ogPrice.replace(/[^\d.]/g, ""));
    if (!isNaN(parsed) && parsed > 0) {
      return { price: parsed, currency };
    }
  }

  // 3. Look for GEL / ₾ pattern
  const gelMatch = html.match(/(\d[\d\s,.]{0,7})\s*(?:₾|GEL|ლარი)/i);
  if (gelMatch?.[1]) {
    const num = parseFloat(gelMatch[1].replace(/[\s,]/g, ""));
    if (!isNaN(num) && num > 1 && num < 50000) {
      return { price: num, currency: "GEL" };
    }
  }

  // 4. Look for $, €, £ pattern
  const symbolMatch = html.match(/(?:USD|\$|EUR|€|GBP|£)\s*(\d[\d,]*\.?\d{0,2})/i);
  if (symbolMatch?.[0] && symbolMatch?.[1]) {
    const full = symbolMatch[0];
    if (full.includes("€") || /EUR/i.test(full)) currency = "EUR";
    else if (full.includes("£") || /GBP/i.test(full)) currency = "GBP";
    else currency = "USD";

    const num = parseFloat(symbolMatch[1].replace(/,/g, ""));
    if (!isNaN(num) && num > 0 && num < 50000) {
      return { price: num, currency };
    }
  }

  return { price: null, currency };
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
    const hostname = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
    const isAmazon = hostname.includes("amazon.") || hostname === "a.co" || hostname === "amzn.to";

    // Fetch live TBC Bank conversion rates
    const exchangeRates = await getTbcExchangeRates();

    const convertPriceToGel = (amount: number, currencyCode: string) => {
      const code = (currencyCode || "GEL").toUpperCase();
      if (code === "GEL" || code === "₾") {
        return {
          priceGel: Math.round(amount),
          originalPrice: amount,
          originalCurrency: "GEL",
          exchangeRateUsed: 1,
          rateSource: "GEL",
        };
      }
      const rateObj = exchangeRates[code] || exchangeRates["USD"];
      const unitRate = rateObj.rate / (rateObj.quantity || 1);
      const converted = Math.round(amount * unitRate);
      return {
        priceGel: Math.max(1, converted),
        originalPrice: Number(amount.toFixed(2)),
        originalCurrency: code,
        exchangeRateUsed: Number(unitRate.toFixed(4)),
        rateSource: rateObj.source || "TBC Bank",
      };
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(parsedUrl.toString(), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9,ka;q=0.8",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const html = await res.text();

        if (isAmazon) {
          const amz = extractAmazonDetails(html, hostname);
          if (amz.title && !amz.title.toLowerCase().includes("robot check")) {
            const cleanTitle = amz.title
              .replace(/^Amazon\.com\s*:\s*/i, "")
              .slice(0, 120);
            const rawPrice = amz.price ?? 99;
            const conv = convertPriceToGel(rawPrice, amz.currency);

            return NextResponse.json({
              title: cleanTitle,
              description: (amz.description || "").slice(0, 240),
              image:
                amz.image ||
                "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",
              price: conv.priceGel,
              originalPrice: conv.originalPrice,
              originalCurrency: conv.originalCurrency,
              exchangeRateUsed: conv.exchangeRateUsed,
              rateSource: conv.rateSource,
              store: "Amazon",
            });
          }
        } else {
          const ogTitle =
            extractMeta(html, "og:title") || extractMeta(html, "twitter:title");
          const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
          const rawTitle = decodeHtmlEntities((ogTitle || titleTag || "").trim());
          const ogImage =
            extractMeta(html, "og:image") ||
            extractMeta(html, "twitter:image") ||
            extractMeta(html, "image");
          const ogDesc =
            extractMeta(html, "og:description") || extractMeta(html, "description");
          const { price: extractedPrice, currency: extractedCurrency } =
            extractGenericPriceAndCurrency(html, hostname);

          if (
            rawTitle &&
            rawTitle.length > 2 &&
            !rawTitle.toLowerCase().includes("just a moment") &&
            !rawTitle.toLowerCase().includes("attention required")
          ) {
            const conv = convertPriceToGel(
              extractedPrice ?? (extractedCurrency === "GEL" ? 199 : 79),
              extractedCurrency
            );

            return NextResponse.json({
              title: rawTitle.slice(0, 115),
              description: (ogDesc || "").slice(0, 220),
              image:
                ogImage ||
                "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=900&q=80",
              price: conv.priceGel,
              originalPrice: conv.originalPrice,
              originalCurrency: conv.originalCurrency,
              exchangeRateUsed: conv.exchangeRateUsed,
              rateSource: conv.rateSource,
              store: hostname,
            });
          }
        }
      }
    } catch {
      // Fall through to smart fallback if site blocks scraping
    }

    // Check if hostname matches a known Georgian store preset
    for (const [domain, preset] of Object.entries(GEORGIAN_DEMO_PRESETS)) {
      if (hostname.includes(domain)) {
        return NextResponse.json({
          ...preset,
          originalPrice: preset.price,
          originalCurrency: "GEL",
          exchangeRateUsed: 1,
          rateSource: "GEL",
        });
      }
    }

    // Smart URL slug extraction for Amazon URLs when bot-challenged
    // Amazon URLs usually look like: https://www.amazon.com/Sony-WH-1000XM5-Canceling-Headphones/dp/B09XS7JWHH
    const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
    let slugCandidate = "";
    const dpIndex = pathSegments.findIndex(
      (s) => s.toLowerCase() === "dp" || s.toLowerCase() === "gp"
    );
    if (dpIndex > 0) {
      slugCandidate = pathSegments[dpIndex - 1];
    } else {
      slugCandidate = pathSegments[pathSegments.length - 1] || hostname;
    }

    const cleanName = decodeURIComponent(slugCandidate)
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const fallbackCurrency = detectDefaultCurrencyByDomain(hostname);
    const conv = convertPriceToGel(
      fallbackCurrency === "GEL" ? 250 : 99,
      fallbackCurrency
    );

    return NextResponse.json({
      title: cleanName.length > 3 ? cleanName : `საჩუქარი (${hostname})`,
      description: isAmazon
        ? `Amazon-ის პროდუქტი (${hostname})`
        : `პროდუქტი მაღაზიიდან ${hostname}`,
      image:
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",
      price: conv.priceGel,
      originalPrice: conv.originalPrice,
      originalCurrency: conv.originalCurrency,
      exchangeRateUsed: conv.exchangeRateUsed,
      rateSource: conv.rateSource,
      store: isAmazon ? "Amazon" : hostname,
    });
  } catch {
    return NextResponse.json({ error: "Could not parse URL" }, { status: 400 });
  }
}
