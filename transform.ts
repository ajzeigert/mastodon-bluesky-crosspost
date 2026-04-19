/**
 * Converts Mastodon HTML content to plain text suitable for Bluesky.
 *
 * Mastodon posts are HTML — we need to:
 * - Convert <br> to newlines
 * - Convert <p> boundaries to double newlines
 * - Extract link URLs from <a> tags
 * - Preserve mention and hashtag text
 * - Strip remaining HTML tags
 * - Decode HTML entities
 */
export function htmlToPlainText(html: string): string {
  let text = html;

  // Replace <br> variants with newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // Replace closing </p> followed by opening <p> with double newline
  text = text.replace(/<\/p>\s*<p>/gi, "\n\n");

  // Remove opening <p> and closing </p> at boundaries
  text = text.replace(/<\/?p[^>]*>/gi, "");

  // Handle links: extract the href URL
  // Mastodon wraps mentions in <a> with class "mention" — keep the visible text for those
  // For regular links, use the href URL
  text = text.replace(
    /<a\s[^>]*class="[^"]*mention[^"]*"[^>]*>(.+?)<\/a>/gi,
    (_match, innerHtml) => {
      // Strip inner spans to get the mention text
      return innerHtml.replace(/<[^>]+>/g, "");
    },
  );

  // For hashtag links, keep the visible text
  text = text.replace(
    /<a\s[^>]*class="[^"]*hashtag[^"]*"[^>]*>(.+?)<\/a>/gi,
    (_match, innerHtml) => {
      return innerHtml.replace(/<[^>]+>/g, "");
    },
  );

  // For regular links, extract href
  text = text.replace(
    /<a\s[^>]*href="([^"]*)"[^>]*>.*?<\/a>/gi,
    (_match, href) => href,
  );

  // Strip any remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  text = decodeHtmlEntities(text);

  // Clean up excessive whitespace (but preserve intentional newlines)
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n /g, "\n");
  text = text.replace(/ \n/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();

  return text;
}

function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&#x27;": "'",
    "&#x2F;": "/",
    "&nbsp;": " ",
    "&#8230;": "…",
    "&hellip;": "…",
    "&#8217;": "\u2019",
    "&rsquo;": "\u2019",
    "&#8216;": "\u2018",
    "&lsquo;": "\u2018",
    "&#8220;": "\u201C",
    "&ldquo;": "\u201C",
    "&#8221;": "\u201D",
    "&rdquo;": "\u201D",
    "&#8211;": "\u2013",
    "&ndash;": "\u2013",
    "&#8212;": "\u2014",
    "&mdash;": "\u2014",
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replaceAll(entity, char);
  }

  // Handle numeric entities
  result = result.replace(/&#(\d+);/g, (_match, dec) =>
    String.fromCodePoint(parseInt(dec, 10)),
  );
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) =>
    String.fromCodePoint(parseInt(hex, 16)),
  );

  return result;
}

/**
 * Truncate text to fit Bluesky's 300-grapheme limit.
 * If truncated, appends a link to the original post.
 */
export function truncateForBluesky(
  text: string,
  originalUrl: string,
): string {
  const MAX_GRAPHEMES = 300;

  // Use Intl.Segmenter for accurate grapheme counting
  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
  const graphemes = [...segmenter.segment(text)];

  if (graphemes.length <= MAX_GRAPHEMES) {
    return text;
  }

  const suffix = `\u2026 ${originalUrl}`;
  const suffixGraphemes = [...segmenter.segment(suffix)].length;
  const available = MAX_GRAPHEMES - suffixGraphemes;

  if (available <= 0) {
    return originalUrl;
  }

  const truncated = graphemes
    .slice(0, available)
    .map((s) => s.segment)
    .join("");

  return truncated.trimEnd() + suffix;
}
