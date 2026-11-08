/**
 * Georgian (ქართული + Latin transliteration) & International Profanity Filter
 * Used across usernames, display names, bios, wishlist titles/descriptions,
 * wish item titles/descriptions/stores, and reservation names/notes.
 */

// 1. Georgian-script roots that are unambiguous profanity anywhere in a word
const GEORGIAN_SUBSTRING_PROFANITY = [
  "ყლე",
  "ყლი",
  "ყლა",
  "ყლო",
  "მუტელ",
  "მუტლ",
  "მოტყნ",
  "მოტყვნ",
  "მოგტყ",
  "მოვტყ",
  "შევეც",
  "შეგეც",
  "შეუდ",
  "ნაბოზ",
  "ნაბიჭვ",
  "პროჭ",
  "განდონ",
  "პიდარასტ",
  "პედერასტ",
  "ფუჩუ",
  "ყვერებ",
  "დედამოტყ",
  "მამამოტყ",
  "კარგმოტყ",
  "სირთავ",
  "ყლისთავ",
  "მინეტ",
  "ჩათლახ",
  "პუტანკ",
];

// 2. Georgian-script words matched on word boundaries (to avoid false positives inside longer words)
const GEORGIAN_WORD_PROFANITY = [
  "ბოზი",
  "ბოზო",
  "ბოზს",
  "ბოზებ",
  "ბოზობა",
  "სირი",
  "სირო",
  "სირს",
  "სირებ",
  "ტრაკი",
  "ტრაკო",
  "ტრაკში",
  "ტრაკზე",
  "ტრაკს",
  "კუტუ",
  "ჭუჭუ",
  "ძუძუ",
  "ყვერი",
  "ჩუკენ",
  "მძრეველ",
  "ნძრევ",
];

// 3. Latin-transliterated Georgian & English/Russian unambiguous substring roots
const LATIN_SUBSTRING_PROFANITY = [
  "dedamotyn",
  "mamamotyn",
  "kargmotyn",
  "mogityan",
  "mogitynav",
  "movtyan",
  "motynul",
  "motyna",
  "motvna",
  "sheveci",
  "shegeci",
  "nabozar",
  "nabichvar",
  "chatlax",
  "chatlakh",
  "muteli",
  "mutel",
  "prochi",
  "prochshi",
  "gandon",
  "pidarast",
  "pederast",
  "fuchu",
  "chukeni",
  "mdzrevel",
  "ndzrev",
  "sirtav",
  "ylistav",
  "klistav",
  "yleo",
  "yleze",
  "yleshi",
  "ylis",
  "yvelamogityan",
  "fuck",
  "motherfuck",
  "bitch",
  "cunt",
  "asshole",
  "dickhead",
  "whore",
  "nigger",
  "faggot",
  "blyat",
  "pizdec",
  "xuynya",
];

// 4. Short Latin-transliterated Georgian & English words matched on token boundaries
// (Avoids false positives on English words like "style", "kyle", "sirius", etc.)
const LATIN_TOKEN_PROFANITY = new Set([
  "yle",
  "y1e",
  "kle",
  "k1e",
  "bozi",
  "bozo",
  "bozebi",
  "siri",
  "siro",
  "sirebi",
  "traki",
  "trakshi",
  "trakze",
  "proch",
  "kutu",
  "chuchu",
  "dzudzu",
  "yveri",
  "yverebi",
  "putanka",
  "mineti",
  "shit",
  "dick",
  "cock",
  "slut",
  "pussy",
  "suka",
  "blyad",
  "hui",
  "xui",
  "pizda",
]);

function collapseRepeatedChars(input: string): string {
  // Collapse 2+ identical Georgian letters into 1, and 3+ identical Latin letters into 1
  return input
    .replace(/([ა-ჰ])\1+/g, "$1")
    .replace(/([a-z])\1{2,}/g, "$1");
}

/**
 * Checks whether a single text string contains Georgian (script or Latin-transliterated)
 * or international profanity.
 */
export function containsProfanity(text?: string | null): boolean {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  const collapsed = collapseRepeatedChars(lower);

  // Strip punctuation/dots between letters (e.g., "ყ.ლ.ე" or "მ_უ_ტ_ე_ლ_ი")
  const strippedGeo = collapsed.replace(/[^ა-ჰ\s]/g, "");
  const compactGeo = collapsed.replace(/[^ა-ჰ]/g, "");

  // 1. Check unambiguous Georgian substring roots
  for (const root of GEORGIAN_SUBSTRING_PROFANITY) {
    if (
      lower.includes(root) ||
      collapsed.includes(root) ||
      strippedGeo.includes(root) ||
      compactGeo.includes(root)
    ) {
      return true;
    }
  }

  // 2. Check Georgian word-boundary roots
  const geoWords = lower
    .split(/[^ა-ჰ]+/)
    .map((w) => w.trim())
    .filter(Boolean);

  for (const word of geoWords) {
    const wordCollapsed = collapseRepeatedChars(word);
    for (const badWord of GEORGIAN_WORD_PROFANITY) {
      if (
        word === badWord ||
        wordCollapsed === badWord ||
        word.startsWith(badWord) ||
        wordCollapsed.startsWith(badWord)
      ) {
        return true;
      }
    }
  }

  // 3. Check unambiguous Latin substring roots
  const compactLatin = collapsed.replace(/[^a-z0-9]/g, "");
  for (const root of LATIN_SUBSTRING_PROFANITY) {
    if (
      lower.includes(root) ||
      collapsed.includes(root) ||
      compactLatin.includes(root)
    ) {
      return true;
    }
  }

  // 4. Check Latin tokens (split by non-letters and digits so usernames like "yle_123" or "bozi99" are caught)
  const latinTokens = lower
    .split(/[^a-z]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const token of latinTokens) {
    const tokenCollapsed = collapseRepeatedChars(token);
    if (
      LATIN_TOKEN_PROFANITY.has(token) ||
      LATIN_TOKEN_PROFANITY.has(tokenCollapsed)
    ) {
      return true;
    }
  }

  // Also check raw alphanumeric tokens for leet-speak like "y1e", "k1e"
  const alphaNumTokens = lower
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  for (const token of alphaNumTokens) {
    if (LATIN_TOKEN_PROFANITY.has(token)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks multiple fields at once and returns true if any field contains profanity.
 */
export function hasProfanityInFields(
  ...fields: Array<string | undefined | null>
): boolean {
  return fields.some((field) => containsProfanity(field));
}

export const PROFANITY_ERROR_KA =
  "ტექსტი შეიცავს არაკორექტულ ან უცენზურო სიტყვებს. გთხოვთ შეცვალოთ.";
export const PROFANITY_ERROR_EN =
  "Please remove inappropriate or offensive language.";
