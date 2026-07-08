import sharp from "sharp";

/**
 * Renders 1200x630 Open Graph card images for shared alerts.
 *
 * Cards are built as SVG and rasterized with sharp, then cached in memory
 * keyed by hazard id + updatedAt so a card is rendered at most once per
 * alert revision. The cache is small (alerts expire) and bounded.
 */

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const CACHE_MAX_ENTRIES = 500;

const cache = new Map<string, Buffer>();

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Greedy word-wrap sized for the card's title font. SVG has no native text
 * wrapping, so lines are pre-computed; the last kept line gets an ellipsis
 * when the title overflows.
 */
const wrapText = (
  text: string,
  maxCharsPerLine: number,
  maxLines: number,
): string[] => {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current =
      word.length > maxCharsPerLine
        ? `${word.slice(0, maxCharsPerLine - 1)}…`
        : word;
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    const last = lines[maxLines - 1]!;
    lines[maxLines - 1] = last.length > 2 ? `${last.replace(/[ .,]*$/, "")}…` : last;
  }
  return lines;
};

export type ShareCardInput = {
  id: string;
  updatedAt: Date;
  title: string;
  severity: string;
  severityLabel: string;
  severityColor: string;
  locationName?: string | null;
  issuedAtLabel: string;
  sourceName?: string | null;
};

const cardSvg = (input: ShareCardInput): string => {
  const color = input.severityColor;
  const titleLines = wrapText(input.title, 30, 3);
  const titleSpans = titleLines
    .map(
      (line, index) =>
        `<text x="80" y="${300 + index * 78}" font-family="DejaVu Sans, Arial, sans-serif" font-size="62" font-weight="700" fill="#ffffff">${escapeXml(line)}</text>`,
    )
    .join("\n  ");

  const metaParts: string[] = [];
  if (input.locationName) metaParts.push(input.locationName);
  metaParts.push(`Issued ${input.issuedAtLabel}`);
  const meta = escapeXml(metaParts.join("  ·  ").slice(0, 90));

  const badgeText = escapeXml(
    (input.sourceName
      ? `${input.sourceName}  ·  ${input.severityLabel}`
      : input.severityLabel
    ).toUpperCase(),
  );
  // Approximate badge pill width from character count at 26px uppercase.
  const badgeWidth = Math.min(1040, badgeText.length * 17 + 56);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}"/>
      <stop offset="1" stop-color="${color}" stop-opacity="0.82"/>
    </linearGradient>
  </defs>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="#16161a"/>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#bg)"/>
  <circle cx="1080" cy="90" r="220" fill="#ffffff" opacity="0.06"/>
  <circle cx="120" cy="600" r="160" fill="#ffffff" opacity="0.05"/>

  <text x="80" y="118" font-family="DejaVu Sans, Arial, sans-serif" font-size="40" font-weight="800" fill="#ffffff">Safety ALRT</text>

  <rect x="80" y="160" width="${badgeWidth}" height="52" rx="26" fill="#ffffff" opacity="0.22"/>
  <text x="108" y="195" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" font-weight="700" letter-spacing="1.5" fill="#ffffff">${badgeText}</text>

  ${titleSpans}

  <text x="80" y="540" font-family="DejaVu Sans, Arial, sans-serif" font-size="30" fill="#ffffff" opacity="0.92">${meta}</text>

  <rect x="0" y="${CARD_HEIGHT - 8}" width="${CARD_WIDTH}" height="8" fill="#ffffff" opacity="0.25"/>
</svg>`;
};

/** Renders (or returns the cached) PNG card for a shareable hazard. */
export const renderShareCard = async (
  input: ShareCardInput,
): Promise<Buffer> => {
  const cacheKey = `${input.id}:${input.updatedAt.getTime()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const png = await sharp(Buffer.from(cardSvg(input))).png().toBuffer();

  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Drop the oldest entry — insertion order is enough here.
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(cacheKey, png);
  return png;
};
