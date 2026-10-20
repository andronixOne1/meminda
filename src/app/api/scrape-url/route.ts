import { NextRequest, NextResponse } from "next/server";

interface ExchangeRateMap {
  [currencyCode: string]: {
    rate: number;
    quantity: number;
    source: string;
  };
}

/**
 * Fetches live TBC Bank / Official NBG exchange rates for converting foreign prices (USD, EUR, GBP, etc.) into GEL (₾).
 */
async function getTbcExchangeRates(): Promise<ExchangeRateMap> {
  const fallbackRates: ExchangeRateMap = {
    GEL: { rate: 1, quantity: 1, source: "GEL" },
    USD: { rate: 2.71, quantity: 1, source: "TBC Bank" },
    EUR: { rate: 2.96, quantity: 1, source: "TBC Bank" },
    GBP: { rate: 3.51, quantity: 1, source: "TBC Bank" },
    TRY: { rate: 0.08, quantity: 1, source: "TBC Bank" },
  };

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
      // Fall through to official NBG feed
    }
  }

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
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .trim();
}

function resolveAbsoluteUrl(candidate: string | null | undefined, baseUrl: string): string | null {
  if (!candidate || typeof candidate !== "string") return null;
  const trimmed = decodeHtmlEntities(candidate.trim());
  if (!trimmed || trimmed.startsWith("data:")) return trimmed || null;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function isLikelyLogoOrPlaceholder(imgUrl: string): boolean {
  const lower = imgUrl.toLowerCase();
  return (
    lower.endsWith(".svg") ||
    lower.includes("favicon") ||
    lower.includes("site-logo") ||
    lower.includes("/logo.") ||
    lower.includes("/logo-") ||
    lower.includes("placeholder") ||
    lower.includes("default-share") ||
    lower.includes("og-default") ||
    lower.includes("1x1") ||
    lower.includes("pixel")
  );
}

function extractMeta(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex1 = new RegExp(
    `<meta[^>]+(?:property|name|itemprop)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const regex2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${escaped}["']`,
    "i"
  );
  const m1 = html.match(regex1);
  if (m1?.[1]) return decodeHtmlEntities(m1[1]);
  const m2 = html.match(regex2);
  if (m2?.[1]) return decodeHtmlEntities(m2[1]);
  return null;
}

function detectDefaultCurrencyByDomain(hostname: string): string {
  if (
    hostname.endsWith(".ge") ||
    hostname.includes("veli.store") ||
    hostname.includes("zoommer") ||
    hostname.includes("extra") ||
    hostname.includes("alta") ||
    hostname.includes("vendoo") ||
    hostname.includes("lutecia") ||
    hostname.includes("dressup")
  ) {
    return "GEL";
  }
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

function parsePriceNumber(val: unknown): number | null {
  if (typeof val === "number") {
    return val > 0 && val < 500000 ? val : null;
  }
  if (typeof val !== "string") return null;
  const cleaned = val.replace(/[^\d.,]/g, "").trim();
  if (!cleaned) return null;

  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      // European format: 1.299,00
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // US format: 1,299.00
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(",")) {
    const parts = cleaned.split(",");
    if (parts[parts.length - 1].length === 2) {
      normalized = cleaned.replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  }

  const num = parseFloat(normalized);
  if (!isNaN(num) && num > 0 && num < 500000) {
    return num;
  }
  return null;
}

/**
 * Layer 1: Structured JSON-LD Product Parser (schema.org/Product)
 */
function extractFromJsonLd(html: string, baseUrl: string) {
  const result: {
    title?: string;
    description?: string;
    image?: string;
    price?: number;
    currency?: string;
  } = {};

  const scripts = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  const findProductNode = (node: unknown): Record<string, unknown> | null => {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = findProductNode(item);
        if (found) return found;
      }
      return null;
    }
    const obj = node as Record<string, unknown>;
    const typeVal = obj["@type"];
    const isProduct =
      typeVal === "Product" ||
      (Array.isArray(typeVal) && typeVal.includes("Product")) ||
      (typeof typeVal === "string" && typeVal.toLowerCase().includes("product"));

    if (isProduct) return obj;

    if (obj["@graph"] && Array.isArray(obj["@graph"])) {
      const found = findProductNode(obj["@graph"]);
      if (found) return found;
    }
    return null;
  };

  for (const match of scripts) {
    try {
      const rawJson = match[1].trim();
      if (!rawJson) continue;
      const parsed = JSON.parse(rawJson);
      const product = findProductNode(parsed);
      if (!product) continue;

      if (typeof product.name === "string" && !result.title) {
        result.title = decodeHtmlEntities(product.name);
      }
      if (typeof product.description === "string" && !result.description) {
        result.description = decodeHtmlEntities(
          product.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
        );
      }

      // Extract image from string, array, or ImageObject
      if (!result.image && product.image) {
        let imgCandidate: string | null = null;
        if (typeof product.image === "string") {
          imgCandidate = product.image;
        } else if (Array.isArray(product.image) && product.image.length > 0) {
          const first = product.image[0];
          if (typeof first === "string") imgCandidate = first;
          else if (first && typeof first === "object" && "url" in first) {
            imgCandidate = String((first as { url: unknown }).url);
          }
        } else if (typeof product.image === "object" && "url" in product.image) {
          imgCandidate = String((product.image as { url: unknown }).url);
        }
        const resolved = resolveAbsoluteUrl(imgCandidate, baseUrl);
        if (resolved && !isLikelyLogoOrPlaceholder(resolved)) {
          result.image = resolved;
        }
      }

      // Extract price and currency from offers
      if (product.offers && !result.price) {
        const offersList = Array.isArray(product.offers)
          ? product.offers
          : [product.offers];
        for (const offer of offersList) {
          if (!offer || typeof offer !== "object") continue;
          const off = offer as Record<string, unknown>;
          const rawP =
            off.price ??
            off.lowPrice ??
            off.highPrice ??
            (off.priceSpecification &&
            typeof off.priceSpecification === "object"
              ? (off.priceSpecification as Record<string, unknown>).price
              : undefined);
          const parsedP = parsePriceNumber(rawP);
          if (parsedP) {
            result.price = parsedP;
            if (typeof off.priceCurrency === "string") {
              result.currency = off.priceCurrency.toUpperCase();
            }
            break;
          }
        }
      }
    } catch {
      // Ignore malformed JSON-LD block
    }
  }

  return result;
}

/**
 * Layer 2: Next.js __NEXT_DATA__ Extractor (Used by Veli.store, Zoommer.ge, Extra.ge, etc.)
 */
function extractFromNextData(html: string, baseUrl: string) {
  const result: {
    title?: string;
    description?: string;
    image?: string;
    price?: number;
    currency?: string;
  } = {};

  const match = html.match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (!match?.[1]) return result;

  try {
    const nextData = JSON.parse(match[1]);
    const pageProps = nextData?.props?.pageProps;
    if (!pageProps || typeof pageProps !== "object") return result;

    // Recursively look for a product-like object in pageProps
    const visited = new Set<unknown>();
    const searchProductObject = (obj: unknown, depth = 0) => {
      if (!obj || typeof obj !== "object" || depth > 6 || visited.has(obj)) return;
      visited.add(obj);

      if (Array.isArray(obj)) {
        for (const item of obj.slice(0, 10)) {
          searchProductObject(item, depth + 1);
        }
        return;
      }

      const rec = obj as Record<string, unknown>;

      // Check if this object looks like the main product
      const hasName =
        typeof rec.name === "string" ||
        typeof rec.title === "string" ||
        typeof rec.productName === "string";
      const rawPriceCandidate =
        rec.discountedPrice ??
        rec.salePrice ??
        rec.final_price ??
        rec.finalPrice ??
        rec.sellPrice ??
        rec.currentPrice ??
        rec.price;

      if (hasName && rawPriceCandidate !== undefined) {
        let numericPrice: number | null = null;
        if (typeof rawPriceCandidate === "number" || typeof rawPriceCandidate === "string") {
          numericPrice = parsePriceNumber(rawPriceCandidate);
        } else if (
          rawPriceCandidate &&
          typeof rawPriceCandidate === "object"
        ) {
          const pObj = rawPriceCandidate as Record<string, unknown>;
          numericPrice = parsePriceNumber(
            pObj.discountedPrice ?? pObj.amount ?? pObj.value ?? pObj.price ?? pObj.final
          );
        }

        if (numericPrice && !result.price) {
          result.price = numericPrice;
        }

        if (!result.title) {
          const tCandidate = (rec.name || rec.title || rec.productName) as string;
          if (tCandidate && tCandidate.length > 2) {
            result.title = tCandidate;
          }
        }

        if (!result.image) {
          const imgField =
            rec.image ||
            rec.imageUrl ||
            rec.mainImage ||
            rec.thumbnail ||
            (Array.isArray(rec.images) ? rec.images[0] : undefined) ||
            (Array.isArray(rec.gallery) ? rec.gallery[0] : undefined) ||
            (Array.isArray(rec.media) ? rec.media[0] : undefined);

          let rawImg: string | null = null;
          if (typeof imgField === "string") rawImg = imgField;
          else if (imgField && typeof imgField === "object") {
            const iObj = imgField as Record<string, unknown>;
            rawImg = String(iObj.url || iObj.src || iObj.original || iObj.large || "");
          }

          const resolved = resolveAbsoluteUrl(rawImg, baseUrl);
          if (resolved && !isLikelyLogoOrPlaceholder(resolved)) {
            result.image = resolved;
          }
        }
      }

      for (const [k, v] of Object.entries(rec)) {
        // Skip unrelated lists like "relatedProducts", "similarProducts", "recommendations"
        if (/related|similar|recommend|upsell|crosssell|Accessories/i.test(k)) {
          continue;
        }
        searchProductObject(v, depth + 1);
      }
    };

    searchProductObject(pageProps);
  } catch {
    // Ignore parse error
  }

  return result;
}

/**
 * Layer 3: Amazon Specialized Product Parser
 */
function extractAmazonDetails(html: string, hostname: string) {
  const productTitleMatch =
    html.match(/<span[^>]+id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i) ||
    html.match(/<h1[^>]+id=["']title["'][^>]*>([\s\S]*?)<\/h1>/i);
  const rawTitle = productTitleMatch?.[1]
    ? decodeHtmlEntities(productTitleMatch[1].replace(/<[^>]+>/g, "").trim())
    : extractMeta(html, "title") || extractMeta(html, "og:title");

  let image: string | null = null;

  // 1. Primary hiRes / large image in Amazon's colorImages JSON
  const hiResMatch =
    html.match(/"hiRes"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/i) ||
    html.match(/"large"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/i);
  if (hiResMatch?.[1]) {
    image = hiResMatch[1];
  }

  // 2. data-old-hires attribute on #landingImage
  if (!image) {
    const oldHires = html.match(/data-old-hires=["'](https:\/\/[^"']+)["']/i);
    if (oldHires?.[1]) image = oldHires[1];
  }

  // 3. data-a-dynamic-image JSON on #landingImage
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

  // 4. #landingImage or #imgBlkFront src
  if (!image) {
    const landingSrc =
      html.match(/id=["']landingImage["'][^>]+src=["'](https:\/\/[^"']+)["']/i) ||
      html.match(/id=["']imgBlkFront["'][^>]+src=["'](https:\/\/[^"']+)["']/i);
    if (landingSrc?.[1]) image = landingSrc[1];
  }

  // 5. Accurate Buy-Box Price on Amazon (prioritize priceToPay & corePriceDisplay)
  let price: number | null = null;
  let currency = detectDefaultCurrencyByDomain(hostname);

  const jsonCurrencyMatch =
    html.match(/"currencySymbol"\s*:\s*"([^"]+)"/i) ||
    html.match(/id=["']twister-plus-price-data-price-unit["'][^>]+value=["']([A-Z]{3})["']/i);

  if (jsonCurrencyMatch?.[1]) {
    const sym = jsonCurrencyMatch[1].trim().toUpperCase();
    if (sym === "$" || sym === "USD") currency = "USD";
    else if (sym === "€" || sym === "EUR") currency = "EUR";
    else if (sym === "£" || sym === "GBP") currency = "GBP";
  }

  // Priority A: Explicit twister / customerVisiblePrice hidden input or priceToPay span
  const priceToPayMatch =
    html.match(
      /class=["'][^"']*priceToPay[^"']*["'][\s\S]{0,600}?<span[^>]+class=["']a-offscreen["'][^>]*>([^<]+)<\/span>/i
    ) ||
    html.match(
      /class=["'][^"']*apexPriceToPay[^"']*["'][\s\S]{0,600}?<span[^>]+class=["']a-offscreen["'][^>]*>([^<]+)<\/span>/i
    );

  if (priceToPayMatch?.[1]) {
    price = parsePriceNumber(decodeHtmlEntities(priceToPayMatch[1]));
  }

  if (!price) {
    const jsonPriceMatch =
      html.match(/id=["']twister-plus-price-data-price["'][^>]+value=["']([\d.]+)["']/i) ||
      html.match(
        /name=["']items\[0\.base\]\[customerVisiblePrice\]\[amount\]["'][^>]+value=["']([\d.]+)["']/i
      ) ||
      html.match(/"priceAmount"\s*:\s*([\d.]+)/i);

    if (jsonPriceMatch?.[1]) {
      price = parsePriceNumber(jsonPriceMatch[1]);
    }
  }

  if (!price) {
    const corePriceBlock = html.match(
      /id=["'](?:corePriceDisplay_desktop_feature_div|corePrice_feature_div|apex_desktop)["'][\s\S]{0,2500}?<span[^>]+class=["'][^"']*a-offscreen[^"']*["'][^>]*>([^<]+)<\/span>/i
    );
    if (corePriceBlock?.[1]) {
      price = parsePriceNumber(decodeHtmlEntities(corePriceBlock[1]));
    }
  }

  const featureBullets = html.match(
    /id=["']feature-bullets["'][\s\S]{0,2000}?<span[^>]+class=["']a-list-item["'][^>]*>([\s\S]*?)<\/span>/i
  );
  const description =
    (featureBullets?.[1]
      ? decodeHtmlEntities(featureBullets[1].replace(/<[^>]+>/g, "").trim())
      : null) ||
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

/**
 * Layer 4: Meta & OpenGraph Price/Image Extractor
 */
function extractMetaPriceAndCurrency(
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

  const ogPrice =
    extractMeta(html, "product:price:amount") ||
    extractMeta(html, "og:price:amount") ||
    extractMeta(html, "product:sale_price:amount") ||
    extractMeta(html, "price");

  if (ogPrice) {
    const parsed = parsePriceNumber(ogPrice);
    if (parsed) {
      return { price: parsed, currency };
    }
  }

  // Check explicit itemprop="price" elements in HTML
  const itempropPriceMatch =
    html.match(/itemprop=["']price["'][^>]+content=["']([\d.,]+)["']/i) ||
    html.match(/content=["']([\d.,]+)["'][^>]+itemprop=["']price["']/i) ||
    html.match(/itemprop=["']price["'][^>]*>\s*([\d.,]+)\s*</i);

  if (itempropPriceMatch?.[1]) {
    const parsed = parsePriceNumber(itempropPriceMatch[1]);
    if (parsed) {
      return { price: parsed, currency };
    }
  }

  return { price: null, currency };
}

/**
 * Layer 5: Headless Browser Fallback via Microlink API for Cloudflare-protected or SPA sites
 */
async function fetchViaMicrolink(targetUrl: string): Promise<{
  title?: string;
  description?: string;
  image?: string;
  price?: number;
  currency?: string;
} | null> {
  try {
    const mlUrl = `https://api.microlink.io/?url=${encodeURIComponent(
      targetUrl
    )}&data.price.selector=${encodeURIComponent(
      '[itemprop="price"], [data-price], .price, .product-price'
    )}&data.price.attr=text`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);
    const res = await fetch(mlUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data;
    if (!data) return null;

    const imageCandidate = data.image?.url || data.logo?.url || undefined;
    const parsedPrice = parsePriceNumber(data.price);

    return {
      title: typeof data.title === "string" ? data.title : undefined,
      description:
        typeof data.description === "string" ? data.description : undefined,
      image:
        imageCandidate && !isLikelyLogoOrPlaceholder(imageCandidate)
          ? imageCandidate
          : undefined,
      price: parsedPrice ?? undefined,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
    const fullUrl = parsedUrl.toString();
    const hostname = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
    const isAmazon =
      hostname.includes("amazon.") || hostname === "a.co" || hostname === "amzn.to";

    const exchangeRates = await getTbcExchangeRates();

    const convertPriceToGel = (amount: number | null, currencyCode: string) => {
      if (amount === null || amount <= 0) {
        return {
          priceGel: null,
          originalPrice: undefined,
          originalCurrency: undefined,
          exchangeRateUsed: undefined,
          rateSource: undefined,
        };
      }
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

    let finalTitle = "";
    let finalDescription = "";
    let finalImage = "";
    let finalPrice: number | null = null;
    let finalCurrency = detectDefaultCurrencyByDomain(hostname);

    // Step 1: Direct HTML Fetch + Multi-Layer Parsing
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7500);

      const res = await fetch(fullUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "ka,en-US;q=0.9,en;q=0.8",
          "Cache-Control": "no-cache",
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const html = await res.text();
        const isBotPage =
          /robot check|just a moment|attention required|cf-browser-verification/i.test(
            html.slice(0, 4000)
          );

        if (!isBotPage) {
          // A. JSON-LD Product Schema (Most reliable across all stores)
          const ld = extractFromJsonLd(html, fullUrl);
          if (ld.title) finalTitle = ld.title;
          if (ld.description) finalDescription = ld.description;
          if (ld.image) finalImage = ld.image;
          if (ld.price) {
            finalPrice = ld.price;
            if (ld.currency) finalCurrency = ld.currency;
          }

          // B. Next.js __NEXT_DATA__ (Veli.store, Zoommer.ge, Extra.ge, etc.)
          const nextData = extractFromNextData(html, fullUrl);
          if (!finalTitle && nextData.title) finalTitle = nextData.title;
          if (!finalDescription && nextData.description)
            finalDescription = nextData.description;
          if (!finalImage && nextData.image) finalImage = nextData.image;
          if (!finalPrice && nextData.price) {
            finalPrice = nextData.price;
            if (nextData.currency) finalCurrency = nextData.currency;
          }

          // C. Amazon Specialized Extractor
          if (isAmazon) {
            const amz = extractAmazonDetails(html, hostname);
            if (!finalTitle && amz.title) finalTitle = amz.title;
            if (!finalDescription && amz.description)
              finalDescription = amz.description;
            if (amz.image) finalImage = amz.image;
            if (amz.price) {
              finalPrice = amz.price;
              finalCurrency = amz.currency;
            }
          }

          // D. OpenGraph & Meta Tags
          if (!finalTitle) {
            const ogTitle =
              extractMeta(html, "og:title") ||
              extractMeta(html, "twitter:title") ||
              html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
            if (ogTitle) finalTitle = decodeHtmlEntities(ogTitle.trim());
          }

          if (!finalDescription) {
            const ogDesc =
              extractMeta(html, "og:description") ||
              extractMeta(html, "twitter:description") ||
              extractMeta(html, "description");
            if (ogDesc) finalDescription = ogDesc;
          }

          if (!finalImage) {
            const rawOgImg =
              extractMeta(html, "og:image:secure_url") ||
              extractMeta(html, "og:image") ||
              extractMeta(html, "twitter:image");
            const resolvedOgImg = resolveAbsoluteUrl(rawOgImg, fullUrl);
            if (resolvedOgImg && !isLikelyLogoOrPlaceholder(resolvedOgImg)) {
              finalImage = resolvedOgImg;
            }
          }

          if (!finalPrice) {
            const metaP = extractMetaPriceAndCurrency(html, hostname);
            if (metaP.price) {
              finalPrice = metaP.price;
              finalCurrency = metaP.currency;
            }
          }
        }
      }
    } catch {
      // Proceed to Microlink fallback if direct fetch timed out or failed
    }

    // Step 2: If title or image is still missing (e.g. Cloudflare / SPA), use Microlink API
    if (!finalTitle || !finalImage || !finalPrice) {
      const ml = await fetchViaMicrolink(fullUrl);
      if (ml) {
        if (!finalTitle && ml.title) finalTitle = ml.title;
        if (!finalDescription && ml.description)
          finalDescription = ml.description;
        if (!finalImage && ml.image) finalImage = ml.image;
        if (!finalPrice && ml.price) finalPrice = ml.price;
      }
    }

    // Clean up store suffixes in title
    finalTitle = finalTitle
      .replace(/^Amazon\.[a-z.]+\s*:\s*/i, "")
      .replace(/\s*[|-]\s*(?:Zoommer|Veli\.store|Extra\.ge|Alta\.ge|Amazon).*$/i, "")
      .trim();

    // Fallback readable title from URL slug ONLY if title is still empty
    if (!finalTitle) {
      const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
      const dpIndex = pathSegments.findIndex(
        (s) => s.toLowerCase() === "dp" || s.toLowerCase() === "gp"
      );
      const slugCandidate =
        dpIndex > 0
          ? pathSegments[dpIndex - 1]
          : pathSegments[pathSegments.length - 1] || "";
      finalTitle = decodeURIComponent(slugCandidate)
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
    }

    const conv = convertPriceToGel(finalPrice, finalCurrency);

    return NextResponse.json({
      title: finalTitle.slice(0, 120),
      description: finalDescription.slice(0, 240),
      image: finalImage || "",
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
