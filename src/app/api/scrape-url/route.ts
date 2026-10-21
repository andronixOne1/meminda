import { NextRequest, NextResponse } from "next/server";
import { inferProductCategory, logAnalyticsEvent } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

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

function isBotOrErrorString(text: string | null | undefined): boolean {
  if (!text) return true;
  const lower = text.toLowerCase().trim();
  if (lower.length < 2) return true;
  // Flag generic stub titles like "Amazon.com", "Amazon.de", "eBay", "Zara"
  if (
    /^amazon(\.[a-z.]{2,6})?$/i.test(lower) ||
    lower === "amazon.com: online shopping" ||
    lower === "robot or human?" ||
    lower === "verify you are human"
  ) {
    return true;
  }
  return (
    lower.includes("attention required") ||
    lower.includes("cloudflare") ||
    lower.includes("just a moment") ||
    lower.includes("security service") ||
    lower.includes("security verification") ||
    lower.includes("access denied") ||
    lower.includes("robot check") ||
    lower.includes("automated access") ||
    lower.includes("522: connection timed out") ||
    lower.includes("403 forbidden") ||
    lower.includes("ddos-guard") ||
    lower.includes("pardon our interruption") ||
    lower.includes("captcha")
  );
}

function resolveAbsoluteUrl(
  candidate: string | null | undefined,
  baseUrl: string
): string | null {
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
    lower.includes("new-share-image") ||
    lower.includes("placeholder") ||
    lower.includes("default-share") ||
    lower.includes("og-default") ||
    lower.includes("1x1") ||
    lower.includes("pixel") ||
    lower.includes("nav-sprite") ||
    lower.includes("/sprites/") ||
    lower.includes("transparent-pixel") ||
    lower.includes("grey-pixel") ||
    lower.includes("fls-na.amazon.com") ||
    lower.includes("amazon_logo")
  );
}

/**
 * Normalizes an Amazon product image URL to high resolution (e.g. ._AC_SL1000_.jpg)
 */
function upgradeAmazonImageToHiRes(imgUrl: string): string {
  if (!imgUrl.includes("media-amazon.com/images/I/")) return imgUrl;
  return imgUrl.replace(
    /\._[A-Za-z0-9,_-]+_\.(jpg|jpeg|png|webp)$/i,
    "._AC_SL1000_.$1"
  );
}

/**
 * Cleans noisy tracking parameters and `/ref=...` path suffixes from Amazon & international product URLs.
 */
function normalizeTargetProductUrl(parsedUrl: URL, isAmazon: boolean): string {
  if (isAmazon) {
    // Match /dp/ASIN or /gp/product/ASIN
    const dpMatch = parsedUrl.pathname.match(
      /^(.*?\/(?:dp|gp\/product)\/[A-Z0-9]{10})(?:\/.*)?$/i
    );
    if (dpMatch?.[1]) {
      return `${parsedUrl.origin}${dpMatch[1]}`;
    }
  }
  const clean = new URL(parsedUrl.toString());
  const trackingParams = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
    "pd_rd_w",
    "content-id",
    "pf_rd_p",
    "pf_rd_r",
    "pd_rd_wg",
    "pd_rd_r",
    "ref_",
  ];
  for (const p of trackingParams) {
    clean.searchParams.delete(p);
  }
  return clean.toString();
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
  if (hostname.includes("amazon.co.uk") || hostname.endsWith(".co.uk"))
    return "GBP";
  if (
    hostname.includes("amazon.de") ||
    hostname.includes("amazon.fr") ||
    hostname.includes("amazon.it") ||
    hostname.includes("amazon.es") ||
    hostname.endsWith(".de") ||
    hostname.endsWith(".eu") ||
    hostname.endsWith(".fr") ||
    hostname.endsWith(".it") ||
    hostname.endsWith(".es")
  ) {
    return "EUR";
  }
  if (hostname.endsWith(".tr") || hostname.includes("trendyol")) return "TRY";
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
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
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
 * Extracts clean search keywords from a product URL slug.
 */
function extractProductSlugQueries(parsedUrl: URL): {
  readableTitle: string;
  fullQuery: string;
  coreQuery: string;
  keywords: string[];
} {
  const segments = parsedUrl.pathname
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);

  let targetSegment = "";
  const dpIdx = segments.findIndex(
    (s) => s.toLowerCase() === "dp" || s.toLowerCase() === "gp"
  );
  if (dpIdx > 0) {
    targetSegment = segments[dpIdx - 1];
  } else {
    const nonNumeric = segments.filter(
      (s) =>
        !/^\d+$/.test(s) &&
        !s.startsWith("ref=") &&
        s !== "product" &&
        s !== "details" &&
        s !== "p" &&
        s !== "item"
    );
    targetSegment =
      nonNumeric[nonNumeric.length - 1] || segments[segments.length - 1] || "";
  }

  const cleaned = decodeURIComponent(targetSegment)
    .replace(/\.(html?|php|aspx?)$/i, "")
    .replace(/-p\d+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ").filter((w) => w.length > 1);
  const stopWords = new Set([
    "sarbeni",
    "biliki",
    "tmis",
    "feni",
    "staileri",
    "termosi",
    "mobiluri",
    "telefoni",
    "fotoaparati",
    "treadmill",
  ]);
  const modelWords = words.filter((w) => !stopWords.has(w.toLowerCase()));
  const coreWords = (modelWords.length >= 2 ? modelWords : words).slice(0, 4);

  const readableTitle = cleaned.replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    readableTitle,
    fullQuery: words.slice(0, 6).join(" "),
    coreQuery: coreWords.join(" "),
    keywords: coreWords.map((w) => w.toLowerCase()),
  };
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
      typeVal === "IndividualProduct" ||
      typeVal === "ProductGroup" ||
      (Array.isArray(typeVal) &&
        (typeVal.includes("Product") || typeVal.includes("ProductGroup"))) ||
      (typeof typeVal === "string" &&
        typeVal.toLowerCase().includes("product"));

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

      if (
        typeof product.name === "string" &&
        !isBotOrErrorString(product.name) &&
        !result.title
      ) {
        result.title = decodeHtmlEntities(product.name);
      }
      if (
        typeof product.description === "string" &&
        !isBotOrErrorString(product.description) &&
        !result.description
      ) {
        result.description = decodeHtmlEntities(
          product.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
        );
      }

      if (!result.image && product.image) {
        let imgCandidate: string | null = null;
        if (typeof product.image === "string") {
          imgCandidate = product.image;
        } else if (Array.isArray(product.image) && product.image.length > 0) {
          const first = product.image[0];
          if (typeof first === "string") imgCandidate = first;
          else if (first && typeof first === "object" && "url" in first) {
            imgCandidate = String((first as { url: unknown }).url);
          } else if (
            first &&
            typeof first === "object" &&
            "contentUrl" in first
          ) {
            imgCandidate = String(
              (first as { contentUrl: unknown }).contentUrl
            );
          }
        } else if (
          typeof product.image === "object" &&
          "url" in product.image
        ) {
          imgCandidate = String((product.image as { url: unknown }).url);
        }
        const resolved = resolveAbsoluteUrl(imgCandidate, baseUrl);
        if (resolved && !isLikelyLogoOrPlaceholder(resolved)) {
          result.image = resolved;
        }
      }

      const rawOffers =
        product.offers ||
        (Array.isArray(product.hasVariant) &&
        product.hasVariant[0] &&
        typeof product.hasVariant[0] === "object"
          ? (product.hasVariant[0] as Record<string, unknown>).offers
          : undefined);

      if (rawOffers && !result.price) {
        const offersList = Array.isArray(rawOffers) ? rawOffers : [rawOffers];
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
 * Layer 2: Next.js __NEXT_DATA__ Extractor (Zoommer.ge, Veli.store, etc.)
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

    const shareData =
      pageProps.sharePageData || pageProps.pageProps?.sharePageData;
    const initProduct =
      pageProps.initialProductData?.product ||
      pageProps.pageProps?.initialProductData?.product ||
      pageProps.product ||
      pageProps.data?.product;

    if (shareData && typeof shareData === "object") {
      if (typeof shareData.name === "string" && shareData.name.trim()) {
        result.title = shareData.name.trim();
      }
      const p = parsePriceNumber(shareData.salePrice ?? shareData.price);
      if (p) result.price = p;
      if (typeof shareData.imageUrl === "string") {
        const resolved = resolveAbsoluteUrl(shareData.imageUrl, baseUrl);
        if (resolved && !isLikelyLogoOrPlaceholder(resolved)) {
          result.image = resolved;
        }
      }
      if (typeof shareData.metaDescription === "string") {
        result.description = shareData.metaDescription.trim();
      }
    }

    if (initProduct && typeof initProduct === "object") {
      if (!result.title && typeof initProduct.name === "string") {
        result.title = initProduct.name.trim();
      }
      if (!result.price) {
        const p = parsePriceNumber(
          initProduct.salePrice ??
            initProduct.discountedPrice ??
            initProduct.final_price ??
            initProduct.price
        );
        if (p) result.price = p;
      }
      if (!result.image) {
        const rawImg =
          initProduct.imageUrl ||
          initProduct.mainImage ||
          initProduct.image ||
          (Array.isArray(initProduct.images)
            ? initProduct.images[0]
            : undefined);
        const imgStr =
          typeof rawImg === "string"
            ? rawImg
            : rawImg && typeof rawImg === "object"
            ? String(rawImg.url || rawImg.src || "")
            : "";
        const resolved = resolveAbsoluteUrl(imgStr, baseUrl);
        if (resolved && !isLikelyLogoOrPlaceholder(resolved)) {
          result.image = resolved;
        }
      }
      if (
        !result.description &&
        typeof initProduct.description === "string"
      ) {
        result.description = initProduct.description
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      }
    }
  } catch {
    // Ignore parse error
  }

  return result;
}

/**
 * Layer 3: Amazon Specialized Product Parser
 */
function extractAmazonDetails(html: string, hostname: string) {
  const pageTitleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  const productTitleMatch =
    html.match(/<span[^>]+id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i) ||
    html.match(/<h1[^>]+id=["']title["'][^>]*>([\s\S]*?)<\/h1>/i);

  const spanTitle = productTitleMatch?.[1]
    ? decodeHtmlEntities(productTitleMatch[1].replace(/<[^>]+>/g, "").trim())
    : null;
  const fullTitleTag = pageTitleTag
    ? decodeHtmlEntities(pageTitleTag.trim())
        .replace(/^Amazon\.[a-z.]+\s*:\s*/i, "")
        .replace(/\s*:\s*[^:]+$/i, "")
        .trim()
    : null;

  // Prefer the longer, more descriptive title (e.g. "Sanrio My Melody Mascot Holder 054861" vs "Sanrio Mascot Holder")
  let rawTitle = spanTitle || fullTitleTag || extractMeta(html, "title") || extractMeta(html, "og:title");
  if (
    spanTitle &&
    fullTitleTag &&
    !isBotOrErrorString(fullTitleTag) &&
    fullTitleTag.length > spanTitle.length + 4
  ) {
    rawTitle = fullTitleTag;
  }

  let image: string | null = null;

  const hiResMatch =
    html.match(
      /"hiRes"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/i
    ) ||
    html.match(
      /"large"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/i
    );
  if (hiResMatch?.[1]) {
    image = upgradeAmazonImageToHiRes(hiResMatch[1]);
  }

  if (!image) {
    const oldHires = html.match(/data-old-hires=["'](https:\/\/[^"']+)["']/i);
    if (oldHires?.[1]) image = upgradeAmazonImageToHiRes(oldHires[1]);
  }

  if (!image) {
    const dynMatch = html.match(
      /data-a-dynamic-image=["']([^"']*https:\/\/m\.media-amazon\.com\/images\/I\/[^"']+)["']/i
    );
    if (dynMatch?.[1]) {
      const decoded = decodeHtmlEntities(dynMatch[1]);
      const urlMatch = decoded.match(
        /https:\/\/m\.media-amazon\.com\/images\/I\/[^"'\s\\]+/
      );
      if (urlMatch?.[0]) image = upgradeAmazonImageToHiRes(urlMatch[0]);
    }
  }

  if (!image) {
    const landingSrc =
      html.match(
        /id=["']landingImage["'][^>]+src=["'](https:\/\/[^"']+)["']/i
      ) ||
      html.match(/id=["']imgBlkFront["'][^>]+src=["'](https:\/\/[^"']+)["']/i);
    if (landingSrc?.[1]) image = upgradeAmazonImageToHiRes(landingSrc[1]);
  }

  let price: number | null = null;
  let currency = detectDefaultCurrencyByDomain(hostname);

  const jsonCurrencyMatch =
    html.match(/"currencySymbol"\s*:\s*"([^"]+)"/i) ||
    html.match(
      /id=["']twister-plus-price-data-price-unit["'][^>]+value=["']([A-Z]{3})["']/i
    );

  if (jsonCurrencyMatch?.[1]) {
    const sym = jsonCurrencyMatch[1].trim().toUpperCase();
    if (sym === "$" || sym === "USD") currency = "USD";
    else if (sym === "€" || sym === "EUR") currency = "EUR";
    else if (sym === "£" || sym === "GBP") currency = "GBP";
  }

  // 1. Check explicit hidden input & JSON price fields first (most reliable on Amazon)
  const jsonPriceMatch =
    html.match(
      /id=["']twister-plus-price-data-price["'][^>]+value=["']([\d.]+)["']/i
    ) ||
    html.match(
      /name=["']items\[0\.base\]\[customerVisiblePrice\]\[amount\]["'][^>]+value=["']([\d.]+)["']/i
    ) ||
    html.match(/"priceAmount"\s*:\s*([\d.]+)/i);

  if (jsonPriceMatch?.[1]) {
    price = parsePriceNumber(jsonPriceMatch[1]);
  }

  // 2. Check a-price-whole + a-price-fraction inside priceToPay / corePrice
  if (!price) {
    const wholeFractionMatch = html.match(
      /class=["'][^"']*(?:priceToPay|apexPriceToPay)[^"']*["'][\s\S]{0,800}?class=["']a-price-whole["'][^>]*>\s*(\d[\d,]*)(?:<[^>]+>|\s|\.)*?class=["']a-price-fraction["'][^>]*>\s*(\d{2})/i
    );
    if (wholeFractionMatch?.[1] && wholeFractionMatch?.[2]) {
      price = parsePriceNumber(
        `${wholeFractionMatch[1].replace(/,/g, "")}.${wholeFractionMatch[2]}`
      );
    }
  }

  // 3. Check non-empty a-offscreen inside priceToPay or corePriceDisplay
  if (!price) {
    const priceToPayMatch =
      html.match(
        /class=["'][^"']*(?:priceToPay|apexPriceToPay)[^"']*["'][\s\S]{0,600}?<span[^>]+class=["'][^"']*a-offscreen[^"']*["'][^>]*>\s*([^<\s][^<]*)\s*<\/span>/i
      ) ||
      html.match(
        /id=["'](?:corePriceDisplay_desktop_feature_div|corePrice_feature_div|apex_desktop)["'][\s\S]{0,2500}?<span[^>]+class=["'][^"']*a-offscreen[^"']*["'][^>]*>\s*([$€£][\d.,]+)\s*<\/span>/i
      );

    if (priceToPayMatch?.[1]) {
      price = parsePriceNumber(decodeHtmlEntities(priceToPayMatch[1]));
    }
  }

  const featureBullets = html.match(
    /id=["']feature-bullets["'][\s\S]{0,2500}?<span[^>]+class=["']a-list-item["'][^>]*>([\s\S]*?)<\/span>/i
  );
  const description =
    (featureBullets?.[1]
      ? decodeHtmlEntities(featureBullets[1].replace(/<[^>]+>/g, "").trim())
      : null) ||
    extractMeta(html, "description") ||
    extractMeta(html, "og:description");

  return {
    title: isBotOrErrorString(rawTitle) ? null : rawTitle,
    image,
    price,
    currency,
    description: isBotOrErrorString(description) ? null : description,
  };
}

/**
 * Layer 4: Meta, OpenGraph & Common E-Commerce Price/Image Extractor
 */
function extractMetaPriceAndCurrency(
  html: string,
  hostname: string
): { price: number | null; currency: string } {
  let currency = detectDefaultCurrencyByDomain(hostname);

  const metaCurrency =
    extractMeta(html, "product:price:currency") ||
    extractMeta(html, "og:price:currency") ||
    extractMeta(html, "twitter:data2") ||
    extractMeta(html, "priceCurrency");
  if (metaCurrency && /^[A-Za-z]{3}$/.test(metaCurrency.trim())) {
    currency = metaCurrency.trim().toUpperCase();
  }

  const ogPrice =
    extractMeta(html, "product:price:amount") ||
    extractMeta(html, "og:price:amount") ||
    extractMeta(html, "product:sale_price:amount") ||
    extractMeta(html, "twitter:data1") ||
    extractMeta(html, "price");

  if (ogPrice) {
    const parsed = parsePriceNumber(ogPrice);
    if (parsed) {
      return { price: parsed, currency };
    }
  }

  const itempropPriceMatch =
    html.match(/itemprop=["']price["'][^>]+content=["']([\d.,]+)["']/i) ||
    html.match(/content=["']([\d.,]+)["'][^>]+itemprop=["']price["']/i) ||
    html.match(/itemprop=["']price["'][^>]*>\s*[$€£₾]?\s*([\d.,]+)\s*</i) ||
    html.match(/data-price=["']([\d.]+)["']/i) ||
    html.match(/"currentPrice"\s*:\s*([\d.]+)/i) ||
    html.match(/"salePrice"\s*:\s*"?([\d.]+)"?/i);

  if (itempropPriceMatch?.[1]) {
    const parsed = parsePriceNumber(itempropPriceMatch[1]);
    if (parsed) {
      return { price: parsed, currency };
    }
  }

  return { price: null, currency };
}

/**
 * Runs all structured HTML extractors (JSON-LD, NextData, Amazon, Meta/OG) on a given HTML document.
 */
function parseAllLayersFromHtml(
  html: string,
  fullUrl: string,
  hostname: string,
  isAmazon: boolean
) {
  let title = "";
  let description = "";
  let image = "";
  let price: number | null = null;
  let currency = detectDefaultCurrencyByDomain(hostname);

  // A. JSON-LD Product Schema (Extra.ge, Shopify, WooCommerce, eBay, ASOS, etc.)
  const ld = extractFromJsonLd(html, fullUrl);
  if (ld.title) title = ld.title;
  if (ld.description) description = ld.description;
  if (ld.image) image = ld.image;
  if (ld.price) {
    price = ld.price;
    if (ld.currency) currency = ld.currency;
  }

  // B. Next.js __NEXT_DATA__ (Zoommer.ge, etc.)
  const nextData = extractFromNextData(html, fullUrl);
  if (!title && nextData.title) title = nextData.title;
  if (!description && nextData.description) description = nextData.description;
  if (!image && nextData.image) image = nextData.image;
  if (!price && nextData.price) {
    price = nextData.price;
    if (nextData.currency) currency = nextData.currency;
  }

  // C. Amazon Specialized Extractor
  if (isAmazon) {
    const amz = extractAmazonDetails(html, hostname);
    if (!title && amz.title) title = amz.title;
    if (!description && amz.description) description = amz.description;
    if (amz.image) image = amz.image;
    if (amz.price) {
      price = amz.price;
      currency = amz.currency;
    }
  }

  // D. OpenGraph & Meta Tags
  const pageTitleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  if (!title) {
    const ogTitle =
      extractMeta(html, "og:title") ||
      extractMeta(html, "twitter:title") ||
      pageTitleTag;
    if (ogTitle && !isBotOrErrorString(ogTitle)) {
      title = decodeHtmlEntities(ogTitle.trim());
    }
  }

  if (!description) {
    const ogDesc =
      extractMeta(html, "og:description") ||
      extractMeta(html, "twitter:description") ||
      extractMeta(html, "description");
    if (ogDesc && !isBotOrErrorString(ogDesc)) {
      description = ogDesc;
    }
  }

  if (!image) {
    const rawOgImg =
      extractMeta(html, "og:image:secure_url") ||
      extractMeta(html, "og:image") ||
      extractMeta(html, "twitter:image");
    const resolvedOgImg = resolveAbsoluteUrl(rawOgImg, fullUrl);
    if (resolvedOgImg && !isLikelyLogoOrPlaceholder(resolvedOgImg)) {
      image = isAmazon
        ? upgradeAmazonImageToHiRes(resolvedOgImg)
        : resolvedOgImg;
    }
  }

  if (!price) {
    const metaP = extractMetaPriceAndCurrency(html, hostname);
    if (metaP.price) {
      price = metaP.price;
      currency = metaP.currency;
    }
  }

  return { title, description, image, price, currency };
}

/**
 * Layer 5: Universal Headless Reader Fallback (`https://r.jina.ai/`)
 * Bypasses Amazon, eBay, Etsy, Nike, Sephora, Zara, and international bot-blocks
 * by rendering the live product DOM and returning either raw HTML or structured Markdown/JSON.
 */
async function scrapeViaJinaReader(
  cleanUrl: string,
  hostname: string,
  isAmazon: boolean
): Promise<{
  title?: string;
  description?: string;
  image?: string;
  price?: number;
  currency?: string;
}> {
  const result: {
    title?: string;
    description?: string;
    image?: string;
    price?: number;
    currency?: string;
  } = {};

  // 1. Try Jina Reader HTML mode first so all our JSON-LD, Amazon & Meta extractors run on the full rendered DOM
  try {
    const htmlRes = await fetch(`https://r.jina.ai/${cleanUrl}`, {
      headers: {
        "X-Return-Format": "html",
        "X-No-Cache": "true",
      },
      signal: AbortSignal.timeout(9500),
    });

    if (htmlRes.ok) {
      const renderedHtml = await htmlRes.text();
      if (renderedHtml && renderedHtml.length > 500) {
        const parsed = parseAllLayersFromHtml(
          renderedHtml,
          cleanUrl,
          hostname,
          isAmazon
        );
        if (parsed.title && !isBotOrErrorString(parsed.title)) {
          result.title = parsed.title;
        }
        if (parsed.description && !isBotOrErrorString(parsed.description)) {
          result.description = parsed.description;
        }
        if (parsed.image && !isLikelyLogoOrPlaceholder(parsed.image)) {
          result.image = parsed.image;
        }
        if (parsed.price) {
          result.price = parsed.price;
          result.currency = parsed.currency;
        }
      }
    }
  } catch {
    // Proceed to JSON/Markdown mode if HTML mode times out
  }

  // 2. If price, image, or title is still missing, query Jina JSON mode
  if (!result.title || !result.image || !result.price) {
    try {
      const jsonRes = await fetch(`https://r.jina.ai/${cleanUrl}`, {
        headers: {
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8500),
      });

      if (jsonRes.ok) {
        const payload = await jsonRes.json();
        const data = payload?.data;
        if (data && typeof data === "object") {
          if (
            !result.title &&
            typeof data.title === "string" &&
            !isBotOrErrorString(data.title)
          ) {
            result.title = data.title.trim();
          }
          if (
            !result.description &&
            typeof data.description === "string" &&
            !isBotOrErrorString(data.description)
          ) {
            result.description = data.description.trim();
          }

          const md: string =
            typeof data.content === "string" ? data.content : "";

          if (!result.image && md) {
            if (isAmazon) {
              const amzImgs = [
                ...md.matchAll(
                  /https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9._+-]+\.jpg/gi
                ),
              ].map((m) => m[0]);
              const mainImg =
                amzImgs.find(
                  (u) =>
                    !u.includes("._AC_US40_") &&
                    !u.includes("._SS64_") &&
                    !u.includes("._SX38_") &&
                    !u.includes("._SY50_")
                ) || amzImgs[0];
              if (mainImg) {
                result.image = upgradeAmazonImageToHiRes(mainImg);
              }
            } else {
              const mdImgs = [
                ...md.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi),
              ]
                .map((m) => m[1])
                .filter((u) => !isLikelyLogoOrPlaceholder(u));
              if (mdImgs[0]) {
                result.image = mdImgs[0];
              }
            }
          }

          if (!result.price && md) {
            // Match currency + price in rendered markdown (e.g., $13.80, €49.95, £25.00, 129.00 ₾)
            const priceMatch =
              md.match(/\$\s*(\d{1,5}(?:,\d{3})*(?:\.\d{2}))/) ||
              md.match(/€\s*(\d{1,5}(?:[.,]\d{2}))/) ||
              md.match(/£\s*(\d{1,5}(?:\.\d{2}))/) ||
              md.match(/(\d{1,5}(?:\.\d{2})?)\s*₾/);

            if (priceMatch?.[1]) {
              const p = parsePriceNumber(priceMatch[1]);
              if (p) {
                result.price = p;
                const fullToken = priceMatch[0];
                if (fullToken.includes("$")) result.currency = "USD";
                else if (fullToken.includes("€")) result.currency = "EUR";
                else if (fullToken.includes("£")) result.currency = "GBP";
                else if (fullToken.includes("₾")) result.currency = "GEL";
              }
            }
          }
        }
      }
    } catch {
      // Ignore error
    }
  }

  return result;
}

/**
 * Layer 6: Smart Recovery for Cloudflare-Blocked Stores (alta.ge, veli.store, vendoo.ge, etc.)
 * Uses DuckDuckGo Search + Bing Image Search + Extra.ge SSR Catalog Cross-Lookup (for Georgian stores).
 */
async function resolveCloudflareBlockedProduct(
  parsedUrl: URL,
  hostname: string,
  isGeorgianStore: boolean
): Promise<{
  title?: string;
  description?: string;
  image?: string;
  price?: number;
}> {
  const { readableTitle, fullQuery, coreQuery, keywords } =
    extractProductSlugQueries(parsedUrl);

  const result: {
    title?: string;
    description?: string;
    image?: string;
    price?: number;
  } = {};

  if (!coreQuery || coreQuery.length < 2) {
    return result;
  }

  const browserHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ka,en-US;q=0.9,en;q=0.8",
  };

  const [ddgTask, bingImgTask, extraTask] = await Promise.allSettled([
    // 1. DuckDuckGo HTML search for exact store title & snippet
    (async () => {
      const q = `${hostname} ${coreQuery}`;
      const res = await fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
        { headers: browserHeaders, signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) return null;
      const html = await res.text();
      const titleMatch = html.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/i);
      const snippetMatch = html.match(
        /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i
      );
      const t = titleMatch
        ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, "").trim())
        : undefined;
      const s = snippetMatch
        ? decodeHtmlEntities(snippetMatch[1].replace(/<[^>]+>/g, "").trim())
        : undefined;
      return { title: t, description: s };
    })(),

    // 2. Bing Image Search for official store CDN image
    (async () => {
      const q = `${hostname} ${fullQuery}`;
      const res = await fetch(
        `https://www.bing.com/images/search?q=${encodeURIComponent(q)}&form=HDRSC2`,
        { headers: browserHeaders, signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) return null;
      const html = await res.text();
      const matches = [
        ...html.matchAll(/murl&quot;:&quot;(https?:\/\/[^&]+?)&quot;/gi),
      ].map((m) => decodeHtmlEntities(m[1]));

      const validImages = matches.filter((u) => !isLikelyLogoOrPlaceholder(u));
      const storeBase = hostname.split(".")[0];
      const storeCdnImg = validImages.find((u) =>
        u.toLowerCase().includes(storeBase)
      );
      return storeCdnImg || validImages[0] || null;
    })(),

    // 3. Extra.ge SSR Product Catalog Lookup (ONLY for Georgian stores so international prices aren't mismatched)
    (async () => {
      if (!isGeorgianStore) return null;
      const primaryBrandWord = keywords[0] || "";
      const secondModelWord = keywords[1] || "";
      if (!primaryBrandWord || primaryBrandWord.length < 2) return null;

      const candidateQueries = [
        keywords.slice(0, 3).join(" "),
        keywords.slice(0, 2).join(" "),
      ].filter((q, idx, arr) => q.length >= 3 && arr.indexOf(q) === idx);

      for (const searchQ of candidateQueries) {
        const res = await fetch(
          `https://extra.ge/search?k=${encodeURIComponent(searchQ)}`,
          { headers: browserHeaders, signal: AbortSignal.timeout(5000) }
        );
        if (!res.ok) continue;
        const searchHtml = await res.text();
        const prodLinks = [
          ...searchHtml.matchAll(/href=["'](\/product\/[^"']+)["']/gi),
        ].map((m) => m[1]);
        const uniqueLinks = [...new Set(prodLinks)];

        const bestLink = uniqueLinks.find((link) => {
          const slugPart = link.toLowerCase();
          const hasFirst = slugPart.includes(primaryBrandWord);
          const hasSecond =
            !secondModelWord ||
            secondModelWord.length < 2 ||
            slugPart.includes(secondModelWord);
          return hasFirst && hasSecond;
        });

        if (!bestLink) continue;

        const prodRes = await fetch(`https://extra.ge${bestLink}`, {
          headers: browserHeaders,
          signal: AbortSignal.timeout(5000),
        });
        if (!prodRes.ok) continue;
        const prodHtml = await prodRes.text();
        return extractFromJsonLd(prodHtml, `https://extra.ge${bestLink}`);
      }
      return null;
    })(),
  ]);

  if (ddgTask.status === "fulfilled" && ddgTask.value) {
    if (ddgTask.value.title && !isBotOrErrorString(ddgTask.value.title)) {
      result.title = ddgTask.value.title;
    }
    if (
      ddgTask.value.description &&
      !isBotOrErrorString(ddgTask.value.description)
    ) {
      result.description = ddgTask.value.description;
    }
  }

  if (bingImgTask.status === "fulfilled" && bingImgTask.value) {
    result.image = bingImgTask.value;
  }

  if (extraTask.status === "fulfilled" && extraTask.value) {
    const ex = extraTask.value;
    const exTitleLower = (ex.title || "").toLowerCase();
    const primaryBrandWord = keywords[0] || "";
    const isPrimaryMatch =
      !primaryBrandWord || exTitleLower.includes(primaryBrandWord);

    if (isPrimaryMatch) {
      if (!result.title && ex.title) result.title = ex.title;
      if (!result.description && ex.description)
        result.description = ex.description;
      if (ex.price) result.price = ex.price;
      if (!result.image && ex.image) result.image = ex.image;
    }
  }

  if (!result.title && readableTitle.length > 3) {
    result.title = readableTitle;
  }

  return result;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
    const hostname = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
    const isAmazon =
      hostname.includes("amazon.") ||
      hostname === "a.co" ||
      hostname === "amzn.to";
    const isGeorgianStore =
      hostname.endsWith(".ge") ||
      hostname.includes("veli.store") ||
      hostname.includes("zoommer") ||
      hostname.includes("extra") ||
      hostname.includes("alta") ||
      hostname.includes("vendoo") ||
      hostname.includes("lutecia") ||
      hostname.includes("dressup");

    const cleanUrl = normalizeTargetProductUrl(parsedUrl, isAmazon);

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

    // Step 1: Direct HTML Fetch + Multi-Layer Structured Parsing
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5500);

      const res = await fetch(cleanUrl, {
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
        const pageTitleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
        // Amazon bot-block pages are ~3.7KB with <title>Amazon.com</title>
        const isBotPage =
          isBotOrErrorString(pageTitleTag) ||
          (isAmazon && html.length < 15000);

        if (!isBotPage) {
          const parsed = parseAllLayersFromHtml(
            html,
            cleanUrl,
            hostname,
            isAmazon
          );
          if (parsed.title) finalTitle = parsed.title;
          if (parsed.description) finalDescription = parsed.description;
          if (parsed.image) finalImage = parsed.image;
          if (parsed.price) {
            finalPrice = parsed.price;
            finalCurrency = parsed.currency;
          }
        }
      }
    } catch {
      // Direct fetch timed out or blocked; proceed to Step 2
    }

    // Step 2: Universal Headless Reader Fallback (Jina Reader) for Amazon & International Websites
    // Runs whenever direct fetch was blocked by anti-bot protection or missed product details (skipped for Georgian stores which use Step 3)
    if (!isGeorgianStore && (!finalTitle || !finalImage || !finalPrice)) {
      const jinaData = await scrapeViaJinaReader(cleanUrl, hostname, isAmazon);
      if (!finalTitle && jinaData.title) finalTitle = jinaData.title;
      if (!finalDescription && jinaData.description)
        finalDescription = jinaData.description;
      if (!finalImage && jinaData.image) finalImage = jinaData.image;
      if (!finalPrice && jinaData.price) {
        finalPrice = jinaData.price;
        if (jinaData.currency) finalCurrency = jinaData.currency;
      }
    }

    // Step 3: Cloudflare-Blocked Store Recovery (DuckDuckGo + Bing Image + Extra.ge Catalog for Georgian stores)
    if (!finalTitle || !finalImage || !finalPrice) {
      const recovered = await resolveCloudflareBlockedProduct(
        parsedUrl,
        hostname,
        isGeorgianStore
      );
      if (!finalTitle && recovered.title) finalTitle = recovered.title;
      if (!finalDescription && recovered.description)
        finalDescription = recovered.description;
      if (!finalImage && recovered.image) finalImage = recovered.image;
      if (!finalPrice && recovered.price) {
        finalPrice = recovered.price;
        finalCurrency = "GEL";
      }
    }

    // Clean up store suffixes & prefixes in title
    finalTitle = finalTitle
      .replace(/^Amazon\.[a-z.]+\s*:\s*/i, "")
      .replace(/^საუკეთესო ფასი\s*[│|-]\s*/i, "")
      .replace(
        /\s*[│|-]\s*(?:Zoommer|Veli\.store|Extra\.ge|Alta\.ge|alta\.ge|Amazon|eBay|Etsy|Zara).*$/i,
        ""
      )
      .trim();

    if (!finalTitle || isBotOrErrorString(finalTitle)) {
      const { readableTitle } = extractProductSlugQueries(parsedUrl);
      finalTitle = readableTitle || hostname;
    }

    if (isBotOrErrorString(finalDescription)) {
      finalDescription = "";
    }

    const conv = convertPriceToGel(finalPrice, finalCurrency);
    const storeDisplay = isAmazon ? "Amazon" : hostname;
    const inferredCategory = inferProductCategory(
      finalTitle,
      finalDescription,
      storeDisplay,
      cleanUrl
    );
    const currentUser = await getCurrentUser().catch(() => null);

    await logAnalyticsEvent({
      eventType: "product_scraped",
      userId: currentUser?.id,
      username: currentUser?.username,
      userGender: currentUser?.gender,
      userAge: currentUser?.age,
      itemTitle: finalTitle.slice(0, 120),
      priceGel: conv.priceGel || undefined,
      originalPrice: conv.originalPrice,
      originalCurrency: conv.originalCurrency,
      storeName: storeDisplay,
      storeDomain: hostname,
      productUrl: cleanUrl,
      category: inferredCategory,
    });

    return NextResponse.json({
      title: finalTitle.slice(0, 120),
      description: finalDescription.slice(0, 240),
      image: finalImage || "",
      price: conv.priceGel,
      originalPrice: conv.originalPrice,
      originalCurrency: conv.originalCurrency,
      exchangeRateUsed: conv.exchangeRateUsed,
      rateSource: conv.rateSource,
      store: storeDisplay,
      storeDomain: hostname,
      category: inferredCategory,
    });
  } catch {
    return NextResponse.json({ error: "Could not parse URL" }, { status: 400 });
  }
}
