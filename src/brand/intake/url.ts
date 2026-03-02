/**
 * URL-based brand intake — fetch a web page and extract brand values.
 */

import type { BrandInput } from "../../types/brand.js";

/** Extract hex colors from CSS text */
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
      .filter((f) => !["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "inherit"].includes(f.toLowerCase()));
    fonts.push(...families);
  }
  return [...new Set(fonts)];
}

/** Extract brand input from a website URL */
export async function urlIntake(url: string): Promise<BrandInput> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  // Extract title for brand name
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const ogNameMatch = html.match(/<meta[^>]*property="og:site_name"[^>]*content="([^"]+)"/i);
  const brandName = ogNameMatch?.[1] ?? titleMatch?.[1]?.split(/[|–—-]/)[0]?.trim() ?? new URL(url).hostname;

  // Extract inline styles and style tags
  const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) ?? [];
  const inlineStyles = styleMatches.map((s) => s.replace(/<\/?style[^>]*>/gi, "")).join("\n");

  // Also check for CSS custom properties in :root
  const cssVarPattern = /--[a-z][\w-]*:\s*#[0-9a-fA-F]{6}/gi;
  const cssVarMatches = inlineStyles.match(cssVarPattern) ?? [];

  // Extract colors from CSS
  const colors = extractCssColors(inlineStyles + " " + cssVarMatches.join(" "));

  // Extract fonts
  const fonts = extractCssFonts(html);

  // Look for Google Fonts links
  const googleFontMatch = html.match(/fonts\.googleapis\.com\/css2?\?family=([^"&]+)/);
  if (googleFontMatch) {
    const fontName = decodeURIComponent(googleFontMatch[1]!).split(":")[0]!.replace(/\+/g, " ");
    if (!fonts.includes(fontName)) fonts.unshift(fontName);
  }

  // Extract meta description
  const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
  const description = descMatch?.[1];

  if (colors.length === 0) {
    throw new Error(
      `No colors could be extracted from ${url}. The site likely requires JavaScript rendering ` +
      `(Next.js, React SPA, etc.) — static HTML fetch returned no inline styles or CSS variables. ` +
      `Call nib_brand_init without the 'from' param and pass brand values directly instead: ` +
      `brandName, primaryColor (hex), secondaryColor (hex), personality.`,
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
      monoFontFamily: fonts.find((f) =>
        /mono|code|consolas|fira|jetbrains/i.test(f),
      ),
    },
  };
}
