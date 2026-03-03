/**
 * Markdown/text file brand intake — extract brand values from documents.
 */

import { readFile } from "node:fs/promises";
import type { BrandInput, BrandPersonality } from "../../types/brand.js";

/** Common brand personality keywords */
const PERSONALITY_KEYWORDS: Record<BrandPersonality, string[]> = {
  professional: ["professional", "corporate", "enterprise", "business", "formal"],
  playful: ["playful", "fun", "cheerful", "energetic", "dynamic"],
  warm: ["warm", "welcoming", "approachable", "human", "caring"],
  bold: ["bold", "strong", "powerful", "confident", "impactful"],
  minimal: ["minimal", "clean", "simple", "understated", "sleek"],
  elegant: ["elegant", "luxury", "refined", "sophisticated", "premium"],
  technical: ["technical", "precise", "data", "analytical", "developer"],
  friendly: ["friendly", "casual", "conversational", "open", "accessible"],
};

/** Extract hex colors from text */
export function extractColors(text: string): string[] {
  const hexPattern = /#[0-9a-fA-F]{6}\b/g;
  const matches = text.match(hexPattern) ?? [];
  // Deduplicate
  return [...new Set(matches)];
}

/** Generic family names that aren't useful as brand font values */
const GENERIC_FONT_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "sans",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
]);

/** Looks like a description sentence rather than a font name */
function isFontDescription(text: string): boolean {
  return /\b(typeface|conveys|designed|readable|clean|modern|suited)\b/i.test(
    text,
  );
}

/** Extract font family names from text */
export function extractFonts(text: string): string[] {
  const fonts: string[] = [];
  let match;

  // CSS-style "font-family: Inter, sans-serif"
  const cssFontPattern = /font[- ]?family[:\s]+["']?([^"'\n,;]+)/gi;
  while ((match = cssFontPattern.exec(text)) !== null) {
    const font = match[1]?.trim();
    if (font && font.length > 1 && !isFontDescription(font)) fonts.push(font);
  }

  // Proper-noun font name at start of a line followed by context:
  //   "Satoshi (sans-serif) for body text..."
  //   "JetBrains Mono for code blocks..."
  const namedFontPattern =
    /^([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)(?:\s*\(.*?\))?\s+(?:for|—|–|-|is|as)\b/gm;
  while ((match = namedFontPattern.exec(text)) !== null) {
    const font = match[1]?.trim();
    if (font && !GENERIC_FONT_FAMILIES.has(font.toLowerCase()))
      fonts.push(font);
  }

  // "font: InterVar" / "typeface: Recoleta" — proper-noun only, same line only.
  // Use [ \t] (not \s) to prevent capturing the next line (e.g. "Inter\nBody").
  const colonPattern =
    /(?:typeface|font)[:\s]+["']?([A-Z][a-zA-Z]+(?:[ \t][A-Z][a-zA-Z]+)*)/g;
  while ((match = colonPattern.exec(text)) !== null) {
    const font = match[1]?.trim();
    if (
      font &&
      !GENERIC_FONT_FAMILIES.has(font.toLowerCase()) &&
      !isFontDescription(font)
    ) {
      fonts.push(font);
    }
  }

  return [...new Set(fonts)];
}

/** Extract brand name from text */
export function extractBrandName(text: string): string | null {
  // Try "Brand Name:\nValue" or "## Brand Name\nValue" (value on next line)
  const nextLinePattern =
    /(?:^#{1,3}\s*)?(?:brand|company|organization)\s*(?:name)?\s*$/im;
  const nextLineMatch = text.match(nextLinePattern);
  if (nextLineMatch) {
    const afterIdx = (nextLineMatch.index ?? 0) + nextLineMatch[0].length;
    const rest = text.slice(afterIdx).replace(/^\n+/, "");
    const nextLine = rest.split("\n")[0]?.trim();
    if (nextLine && !nextLine.startsWith("#")) return nextLine;
  }

  // Try "Brand: Name" or "Brand Name: Name" with colon on same line
  const colonPattern =
    /(?:brand|company|organization)\s*(?:name)?\s*:\s*["']?([^\n"']+)/i;
  const colonMatch = text.match(colonPattern);
  if (colonMatch?.[1]) {
    const val = colonMatch[1].trim();
    // Avoid capturing descriptions like "Brand Guidelines"
    if (val.split(/\s+/).length <= 4) return val;
  }

  // First H1 heading — strip document-title noise in both directions:
  //   "Acme — Brand Guidelines"  → "Acme"   (suffix strip)
  //   "Brand Brief — nib"        → "nib"    (prefix strip)
  const h1Match = text.match(/^#\s+(.+)/m);
  if (h1Match?.[1]) {
    const h1 = h1Match[1].trim();
    const cleaned = h1
      // Strip suffix: "— Brand Guidelines", "- Brand Guide", "— Style Guide", etc.
      .replace(/\s*[—–-]\s*(?:brand|style|design).*$/i, "")
      // Strip prefix: "Brand Brief — ", "Brand Guide — ", "Style Guide — ", etc.
      .replace(/^(?:brand|style|design)\s+(?:brief|guide|guidelines|system|identity)\s*[—–-]\s*/i, "")
      .trim();
    if (cleaned) return cleaned;
  }

  return null;
}

/** Extract a section's body text by heading name */
function extractSection(text: string, heading: string): string | null {
  // Match "## Heading" or "### Heading" (case-insensitive)
  const pattern = new RegExp(
    `^#{1,3}\\s+${heading}\\s*$`,
    "im",
  );
  const match = text.match(pattern);
  if (!match) return null;

  const afterIdx = (match.index ?? 0) + match[0].length;
  const rest = text.slice(afterIdx).replace(/^\n+/, "");
  // Grab everything until the next heading or end of text
  const nextHeading = rest.search(/^#{1,3}\s/m);
  const body = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
  const trimmed = body.trim();
  return trimmed || null;
}

/** Extract a meaningful description from text */
function extractDescription(text: string): string | null {
  // Prefer explicit "## Description" section
  const descSection = extractSection(text, "Description");
  if (descSection) return descSection;

  // Try "## Tagline" section
  const tagline = extractSection(text, "Tagline");
  if (tagline) return tagline;

  // Fall back to first non-heading, non-empty paragraph
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith("-") &&
      trimmed.length > 20
    ) {
      return trimmed;
    }
  }

  return null;
}

/** Extract industry from text */
function extractIndustry(text: string): string | null {
  return extractSection(text, "Industry");
}

/**
 * Extract the raw personality words written in the source document's Personality
 * section, before mapping them to valid enum values.
 *
 * Used by the MCP preview handler to warn when a term like "trustworthy" appears
 * in the brief but has no valid BrandPersonality equivalent.
 */
export function extractRawPersonalityTerms(text: string): string[] {
  const section = extractSection(text, "Personality");
  if (!section) return [];
  return section
    .split(/[,\s\/|]+/)
    .map((t) => t.trim().toLowerCase().replace(/[^\w-]/g, ""))
    .filter((t) => t.length > 1);
}

/** Detect personality traits from text content */
export function detectPersonality(text: string): BrandPersonality[] {
  const lower = text.toLowerCase();
  const detected: BrandPersonality[] = [];

  for (const [trait, keywords] of Object.entries(PERSONALITY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      detected.push(trait as BrandPersonality);
    }
  }

  return detected.length > 0 ? detected : ["professional"];
}

/** Extract brand input from a markdown/text file */
export async function markdownIntake(filePath: string, brandNameOverride?: string): Promise<BrandInput> {
  const content = await readFile(filePath, "utf-8");

  const brandName = brandNameOverride ?? extractBrandName(content);
  const colors = extractColors(content);
  const fonts = extractFonts(content);
  const personality = detectPersonality(content);
  const description = extractDescription(content);
  const industry = extractIndustry(content);

  if (!brandName) {
    throw new Error(
      `Could not detect brand name from ${filePath}. Add a "Brand: YourName" line or a top-level heading.`,
    );
  }

  if (colors.length === 0) {
    throw new Error(
      `No hex colors found in ${filePath}. Add at least one hex color (e.g. #3b82f6).`,
    );
  }

  return {
    name: brandName,
    personality,
    description: description ?? undefined,
    industry: industry ?? undefined,
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
