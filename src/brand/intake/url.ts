/**
 * URL-based brand intake — fetch a web page and extract brand values.
 *
 * Strategy:
 * 1. Fetch the HTML page.
 * 2. Parse inline <style> blocks (works for simple/static sites).
 * 3. Fetch every <link rel="stylesheet"> file (handles Next.js, React SSR/SSG,
 *    and any site where styles live in external CSS assets).
 * 4. Prefer colors defined in CSS custom properties at :root — these are the
 *    most reliable signal for brand tokens vs generic utility colors.
 */

import type { BrandInput } from "../../types/brand.js";

/**
 * Rank CSS custom property hex colors by semantic signal strength.
 *
 * Priority 1 — semantic names (primary, brand, accent, base, interactive, main):
 *   These are almost certainly intentional brand tokens.
 *
 * Priority 2 — usage frequency across the whole CSS text:
 *   Colors that appear many times are more likely to be brand colors
 *   than palette scale entries that appear once as a variable definition.
 *
 * Colors that look like palette scale steps (e.g. `--color-red-500`) are
 * deprioritized because they represent a full scale, not a brand choice.
 */
function extractRankedColors(css: string): string[] {
  // Count raw hex usage across entire CSS (excluding the definition line itself)
  const allHex = css.match(/#[0-9a-fA-F]{6}\b/gi) ?? [];
  const usageCount = new Map<string, number>();
  for (const h of allHex) {
    const k = h.toLowerCase();
    usageCount.set(k, (usageCount.get(k) ?? 0) + 1);
  }

  // Extract CSS variable definitions with their names
  const varPattern = /--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/gi;
  const semanticColors: string[] = [];
  const scaleColors: string[] = [];
  let match;

  while ((match = varPattern.exec(css)) !== null) {
    const name = match[1]!.toLowerCase();
    const hex = match[2]!.toLowerCase();

    // Skip near-white / near-black utility colors as primary candidates
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const isNearWhite = r > 240 && g > 240 && b > 240;
    const isNearBlack = r < 15 && g < 15 && b < 15;
    if (isNearWhite || isNearBlack) continue;

    // Palette scale pattern: color-{name}-{number} (e.g. color-red-500)
    const isScaleEntry = /^color-\w+-\d+$/.test(name) || /^tw-/.test(name);

    if (/primary|brand|accent|base|interactive|main|secondary/.test(name)) {
      semanticColors.push(hex);
    } else if (!isScaleEntry) {
      scaleColors.push(hex);
    }
  }

  // Merge: semantic first, then non-scale sorted by usage, then all by usage
  const nonScaleSorted = [...new Set(scaleColors)].sort(
    (a, b) => (usageCount.get(b) ?? 0) - (usageCount.get(a) ?? 0),
  );

  // Fall back to all hex colors by usage if nothing semantic was found
  const allByUsage = [...usageCount.entries()]
    .filter(([h]) => {
      const r = parseInt(h.slice(1, 3), 16);
      const g = parseInt(h.slice(3, 5), 16);
      const b = parseInt(h.slice(5, 7), 16);
      return !(r > 240 && g > 240 && b > 240) && !(r < 15 && g < 15 && b < 15);
    })
    .sort(([, a], [, b]) => b - a)
    .map(([h]) => h);

  const ranked = [
    ...new Set([...semanticColors, ...nonScaleSorted, ...allByUsage]),
  ];
  return ranked;
}

/** Extract all hex colors from any CSS text */
function extractCssColors(css: string): string[] {
  const hexPattern = /#[0-9a-fA-F]{6}\b/g;
  const matches = css.match(hexPattern) ?? [];
  return [...new Set(matches)];
}

/** Extract font families from CSS */
function extractCssFonts(css: string): string[] {
  const fontPattern = /font-family[:\s]+["']?([^"';}\n]+)/gi;
  const fonts: string[] = [];
  let match;
  while ((match = fontPattern.exec(css)) !== null) {
    const families = match[1]!
      .split(",")
      .map((f) => f.trim().replace(/["']/g, ""))
      .filter(
        (f) =>
          !["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "inherit"].includes(
            f.toLowerCase(),
          ),
      );
    fonts.push(...families);
  }
  return [...new Set(fonts)];
}

/**
 * Fetch all <link rel="stylesheet"> CSS files referenced in the HTML.
 * This is the key fix for JS-rendered sites — Next.js, React SSG, etc. emit
 * their styles as static CSS assets even though the HTML body is empty.
 */
async function fetchLinkedStylesheets(html: string, pageUrl: string): Promise<string> {
  const base = new URL(pageUrl);
  const hrefs = new Set<string>();

  // Match <link rel="stylesheet" href="..."> in either attribute order
  for (const pattern of [
    /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi,
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["']/gi,
  ]) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(html)) !== null) {
      hrefs.add(match[1]!);
    }
  }

  if (hrefs.size === 0) return "";

  const cssTexts = await Promise.all(
    [...hrefs].map(async (href) => {
      try {
        const url = new URL(href, base).toString();
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (res.ok) return await res.text();
      } catch {
        // Skip unreachable or timed-out stylesheets
      }
      return "";
    }),
  );

  return cssTexts.join("\n");
}

/** Extract brand input from a website URL */
export async function urlIntake(url: string): Promise<BrandInput> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  // Brand name: prefer og:site_name, fall back to <title>, then hostname
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const ogNameMatch = html.match(/<meta[^>]*property="og:site_name"[^>]*content="([^"]+)"/i);
  const brandName =
    ogNameMatch?.[1] ??
    titleMatch?.[1]?.split(/[|–—-]/)[0]?.trim() ??
    new URL(url).hostname;

  // Inline <style> blocks (static sites, SSR'd critical CSS)
  const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) ?? [];
  const inlineStyles = styleMatches.map((s) => s.replace(/<\/?style[^>]*>/gi, "")).join("\n");

  // Linked CSS files (Next.js, React SSG, Tailwind builds, etc.)
  const linkedCss = await fetchLinkedStylesheets(html, url);

  const allCss = inlineStyles + "\n" + linkedCss;

  // Colors: ranked by semantic signal — semantic var names first, then by usage frequency
  const colors = extractRankedColors(allCss).length > 0
    ? extractRankedColors(allCss)
    : extractCssColors(allCss);

  // Fonts: scan full HTML + all CSS
  const fonts = extractCssFonts(html + "\n" + allCss);

  // Google Fonts link in HTML head
  const googleFontMatch = html.match(/fonts\.googleapis\.com\/css2?\?family=([^"&]+)/);
  if (googleFontMatch) {
    const fontName = decodeURIComponent(googleFontMatch[1]!).split(":")[0]!.replace(/\+/g, " ");
    if (!fonts.includes(fontName)) fonts.unshift(fontName);
  }

  // Meta description
  const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
  const description = descMatch?.[1];

  if (colors.length === 0) {
    throw new Error(
      `No colors could be extracted from ${url}. ` +
        `Both the HTML and all linked stylesheets contained no hex color values. ` +
        `Call nib_brand_init without 'from' and provide brand values directly: ` +
        `brandName, primaryColor (hex), personality.`,
    );
  }

  return {
    name: brandName,
    description,
    colors: {
      primary: colors[0]!,
      secondary: colors[1],
      accent: colors[2],
    },
    typography: {
      fontFamily: fonts[0] ?? "Inter",
      monoFontFamily: fonts.find((f) => /mono|code|consolas|fira|jetbrains/i.test(f)),
    },
  };
}
