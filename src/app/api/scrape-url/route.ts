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

function isBotOrErrorString(text: string | null | undefined): boolean {
  if (!text) return true;
  const lower = text.toLowerCase().trim();
  if (lower.length < 2) return true;
  return (
    lower.includes("attention required") ||
    lower.includes("cloudflare") ||
    lower.includes("just a moment") ||
    lower.includes("security service") ||
    lower.includes("security verification") ||
    lower.includes("access denied") ||
    lower.includes("robot check") ||
    lower.includes("522: connection timed out") ||
    lower.includes("403 forbidden") ||
    lower.includes("ddos-guard") ||
    lower.includes("pardon our interruption")
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
 * e.g. "https://alta.ge/sarbeni-biliki/urevo-foldi-mini-2-treadmill-ur9tm0063-black-p40587"
 * -> fullSlug: "Urevo Foldi Mini 2 Treadmill Ur9tm0063 Black"
 * -> coreQuery: "urevo foldi mini 2"
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

  // Pick the most descriptive segment (longest slug, or segment before /dp/ on Amazon)
  let targetSegment = "";
  const dpIdx = segments.findIndex(
    (s) => s.toLowerCase() === "dp" || s.toLowerCase() === "gp"
  );
  if (dpIdx > 0) {
    targetSegment = segments[dpIdx - 1];
  } else {
    // Filter out purely numeric segments like "/207233" or "/111783/130768"
    const nonNumeric = segments.filter((s) => !/^\d+$/.test(s) && s !== "product" && s !== "details");
    targetSegment =
      nonNumeric[nonNumeric.length - 1] || segments[segments.length - 1] || "";
  }

  const cleaned = decodeURIComponent(targetSegment)
    .replace(/\.(html?|php|aspx?)$/i, "")
    .replace(/-p\d+$/i, "") // Strip Zoommer/Alta "-p40587" suffix
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ").filter((w) => w.length > 1);
  // Filter out generic Georgian transliterated category words often appended at the end
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
      (Array.isArray(typeVal) && typeVal.includes("Product")) ||
      (typeof typeVal === "string" && typeVal.toLowerCase() === "product");

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
          }
        } else if (typeof product.image === "object" && "url" in product.image) {
          imgCandidate = String((product.image as { url: unknown }).url);
        }
        const resolved = resolveAbsoluteUrl(imgCandidate, baseUrl);
        if (resolved && !isLikelyLogoOrPlaceholder(resolved)) {
          result.image = resolved;
        }
      }

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
 * Layer 2: Next.js __NEXT_DATA__ Extractor (Zoommer.ge, Veli.store, etc.)
 * Checks explicit product structures first so it never picks up menu/category items.
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

    // 1. Check Zoommer / Alta sharePageData & initialProductData.product
    const shareData = pageProps.sharePageData || pageProps.pageProps?.sharePageData;
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
          (Array.isArray(initProduct.images) ? initProduct.images[0] : undefined);
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
      if (!result.description && typeof initProduct.description === "string") {
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
  const productTitleMatch =
    html.match(/<span[^>]+id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i) ||
    html.match(/<h1[^>]+id=["']title["'][^>]*>([\s\S]*?)<\/h1>/i);
  const rawTitle = productTitleMatch?.[1]
    ? decodeHtmlEntities(productTitleMatch[1].replace(/<[^>]+>/g, "").trim())
    : extractMeta(html, "title") || extractMeta(html, "og:title");

  let image: string | null = null;

  const hiResMatch =
    html.match(/"hiRes"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/i) ||
    html.match(/"large"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/i);
  if (hiResMatch?.[1]) {
    image = hiResMatch[1];
  }

  if (!image) {
    const oldHires = html.match(/data-old-hires=["'](https:\/\/[^"']+)["']/i);
    if (oldHires?.[1]) image = oldHires[1];
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
      if (urlMatch?.[0]) image = urlMatch[0];
    }
  }

  if (!image) {
    const landingSrc =
      html.match(/id=["']landingImage["'][^>]+src=["'](https:\/\/[^"']+)["']/i) ||
      html.match(/id=["']imgBlkFront["'][^>]+src=["'](https:\/\/[^"']+)["']/i);
    if (landingSrc?.[1]) image = landingSrc[1];
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
    title: isBotOrErrorString(rawTitle) ? null : rawTitle,
    image,
    price,
    currency,
    description: isBotOrErrorString(description) ? null : description,
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
 * Layer 5: Smart Recovery for Cloudflare-Blocked Stores (alta.ge, veli.store, vendoo.ge, etc.)
 * Uses DuckDuckGo Search + Bing Image Search + Extra.ge SSR Catalog Cross-Lookup
 * to retrieve the exact product title, official image, and Georgian market price (₾).
 */
async function resolveCloudflareBlockedProduct(
  parsedUrl: URL,
  hostname: string
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

  // Run DuckDuckGo Search, Bing Image Search, and Extra.ge Catalog Search in parallel
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
      // Prefer image hosted on the store's own CDN if available
      const storeBase = hostname.split(".")[0];
      const storeCdnImg = validImages.find((u) =>
        u.toLowerCase().includes(storeBase)
      );
      return storeCdnImg || validImages[0] || null;
    })(),

    // 3. Extra.ge SSR Product Catalog Lookup for exact GEL price & product metadata
    (async () => {
      const primaryBrandWord = keywords[0] || "";
      const secondModelWord = keywords[1] || "";
      if (!primaryBrandWord || primaryBrandWord.length < 2) return null;

      // Try 3-word query first, then fallback to 2-word brand+model query (e.g., "stanley quencher")
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

        // Require the primary brand/model word (and second word if present) to match in the product slug
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

    // Step 1: Direct HTML Fetch + Multi-Layer Structured Parsing
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6500);

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
        const pageTitleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
        const isBotPage = isBotOrErrorString(pageTitleTag);

        if (!isBotPage) {
          // A. JSON-LD Product Schema (Extra.ge, Shopify, WooCommerce, etc.)
          const ld = extractFromJsonLd(html, fullUrl);
          if (ld.title) finalTitle = ld.title;
          if (ld.description) finalDescription = ld.description;
          if (ld.image) finalImage = ld.image;
          if (ld.price) {
            finalPrice = ld.price;
            if (ld.currency) finalCurrency = ld.currency;
          }

          // B. Next.js __NEXT_DATA__ (Zoommer.ge, etc.)
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
              pageTitleTag;
            if (ogTitle && !isBotOrErrorString(ogTitle)) {
              finalTitle = decodeHtmlEntities(ogTitle.trim());
            }
          }

          if (!finalDescription) {
            const ogDesc =
              extractMeta(html, "og:description") ||
              extractMeta(html, "twitter:description") ||
              extractMeta(html, "description");
            if (ogDesc && !isBotOrErrorString(ogDesc)) {
              finalDescription = ogDesc;
            }
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
      // Direct fetch timed out or blocked; proceed to Step 2
    }

    // Step 2: If Cloudflare blocked the store (e.g., alta.ge, veli.store) or price/image is missing
    if (!finalTitle || !finalImage || !finalPrice) {
      const recovered = await resolveCloudflareBlockedProduct(
        parsedUrl,
        hostname
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

    // Clean up store suffixes in title
    finalTitle = finalTitle
      .replace(/^Amazon\.[a-z.]+\s*:\s*/i, "")
      .replace(/^საუკეთესო ფასი\s*[│|-]\s*/i, "")
      .replace(
        /\s*[│|-]\s*(?:Zoommer|Veli\.store|Extra\.ge|Alta\.ge|alta\.ge|Amazon).*$/i,
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
