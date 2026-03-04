/**
 * Tokens Studio (formerly Figma Tokens) → BrandInput converter.
 *
 * Tokens Studio uses a legacy JSON format where tokens are nested objects
 * with a `value` property (instead of DTCG's `$value`) and optional
 * `type` (instead of `$type`). Groups are plain nested objects.
 *
 * Two common layouts are supported:
 *   1. Flat — top-level keys are token groups (e.g. "global", "brand", "semantic")
 *   2. Multi-file — a "$metadata" key lists `tokenSetOrder`; each set is a top-level key
 *
 * Extraction strategy:
 *   1. Walk the token tree, collecting every leaf `{ value, type }` node
 *   2. Classify tokens by their path segments (color vs. typography vs. spacing …)
 *   3. Map to BrandInput — primary color first, then secondary/accent
 *   4. Derive brand name from the filename or a top-level "brand.name" token
 *   5. Fall back to sensible defaults (Inter font, professional personality) when
 *      the source doesn't have enough information
 */

import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { BrandInput, BrandPersonality } from "../../types/brand.js";

// ─── Internal types ────────────────────────────────────────────────────────────

interface TokensStudioLeaf {
  /** Raw string or number value from the Tokens Studio file. */
  value: string | number;
  type?: string;
  description?: string;
}

interface FlatTokenMap {
  /** Dot-separated token path → leaf node */
  [path: string]: TokensStudioLeaf;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a Tokens Studio JSON file and return a BrandInput.
 *
 * @throws {Error} when the file cannot be read or has no recognizable color tokens.
 */
export async function tokensStudioIntake(filePath: string): Promise<BrandInput> {
  const raw = await readFile(filePath, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`tokens-studio: invalid JSON in "${filePath}"`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`tokens-studio: expected a JSON object, got ${typeof parsed}`);
  }

  const flat = flattenTokens(parsed as Record<string, unknown>);

  // ── Colors ────────────────────────────────────────────────────────────────
  const colorTokens = Object.entries(flat)
    .filter(([, leaf]) => isColorToken(leaf))
    .filter(([, leaf]) => isHex(String(leaf.value)));

  if (colorTokens.length === 0) {
    throw new Error(
      `tokens-studio: no color tokens found in "${filePath}". ` +
      `Ensure the file contains tokens with type "color" and hex values.`,
    );
  }

  // Rank colors: prefer tokens whose path contains primary/brand/interactive/main/accent
  const ranked = rankColors(colorTokens);
  // ranked is guaranteed non-empty (colorTokens.length > 0 checked above)
  const primaryEntry = ranked[0]!;
  const secondaryEntry = ranked[1];
  const accentEntry = ranked[2];

  // ── Typography ────────────────────────────────────────────────────────────
  const fontFamily = extractFontFamily(flat);

  // ── Brand name ────────────────────────────────────────────────────────────
  const brandName = extractBrandNameFromTokens(flat, filePath);

  // ── Personality — not present in Tokens Studio files, use professional ────
  const personality: BrandPersonality[] = ["professional"];

  // ── Description ───────────────────────────────────────────────────────────
  const descriptionToken = Object.entries(flat).find(
    ([path]) => /description|tagline|about/i.test(path),
  );
  const description =
    descriptionToken && typeof descriptionToken[1].value === "string"
      ? descriptionToken[1].value
      : undefined;

  return {
    name: brandName,
    personality,
    colors: {
      primary: String(primaryEntry[1].value),
      secondary: secondaryEntry ? String(secondaryEntry[1].value) : undefined,
      accent: accentEntry ? String(accentEntry[1].value) : undefined,
    },
    typography: {
      fontFamily: fontFamily ?? "Inter",
      monoFontFamily: extractMonoFontFamily(flat),
    },
    description,
  };
}

/**
 * Preview-mode: detect brand values without calling init().
 * Returns a structured object suitable for the MCP preview response.
 */
export async function tokensStudioPreview(filePath: string): Promise<{
  brandName: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  fontFamily: string | null;
  tokenCount: number;
  colorCount: number;
}> {
  const raw = await readFile(filePath, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`tokens-studio: invalid JSON in "${filePath}"`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`tokens-studio: expected a JSON object, got ${typeof parsed}`);
  }

  const flat = flattenTokens(parsed as Record<string, unknown>);
  const colorTokens = Object.entries(flat)
    .filter(([, leaf]) => isColorToken(leaf))
    .filter(([, leaf]) => isHex(String(leaf.value)));

  const ranked = rankColors(colorTokens);

  return {
    brandName: extractBrandNameFromTokens(flat, filePath),
    primaryColor: ranked[0] ? String(ranked[0][1].value) : null,
    secondaryColor: ranked[1] ? String(ranked[1][1].value) : null,
    accentColor: ranked[2] ? String(ranked[2][1].value) : null,
    fontFamily: extractFontFamily(flat),
    tokenCount: Object.keys(flat).length,
    colorCount: colorTokens.length,
  };
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Recursively walk a Tokens Studio JSON object and collect all leaf token nodes
 * as a flat map of dot-separated paths.
 *
 * Tokens Studio leaf nodes have a `value` property (string or number).
 * Group nodes are plain objects without a `value` key.
 *
 * The `$metadata` and `$themes` top-level keys (Tokens Studio metadata) are skipped.
 */
function flattenTokens(
  obj: Record<string, unknown>,
  prefix = "",
): FlatTokenMap {
  const result: FlatTokenMap = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip Tokens Studio metadata keys
    if (key.startsWith("$")) continue;

    const path = prefix ? `${prefix}.${key}` : key;

    if (isLeaf(value)) {
      result[path] = value as TokensStudioLeaf;
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenTokens(value as Record<string, unknown>, path));
    }
  }

  return result;
}

/** A leaf has a `value` property that is a string or number. */
function isLeaf(v: unknown): v is TokensStudioLeaf {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const obj = v as Record<string, unknown>;
  return "value" in obj && (typeof obj.value === "string" || typeof obj.value === "number");
}

/** Returns true when the leaf is a color token. */
function isColorToken(leaf: TokensStudioLeaf): boolean {
  if (leaf.type === "color") return true;
  // No explicit type — infer from value being a hex string
  if (!leaf.type && isHex(String(leaf.value))) return true;
  return false;
}

/** Returns true for CSS hex color strings: #RGB, #RRGGBB, #RRGGBBAA */
function isHex(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value.trim());
}

/** Returns true for Tokens Studio alias references like {color.brand.500} */
function isAlias(value: string): boolean {
  return /^\{[^}]+\}$/.test(value.trim());
}

/**
 * Rank color token entries by semantic signal strength.
 * Returns entries sorted: primary candidates first, then by path length (shorter = more generic).
 */
function rankColors(
  entries: [string, TokensStudioLeaf][],
): [string, TokensStudioLeaf][] {
  // Exclude alias tokens — they reference other tokens, not raw values
  const direct = entries.filter(([, leaf]) => !isAlias(String(leaf.value)));

  const scoreFor = (path: string): number => {
    const p = path.toLowerCase();
    // Highest priority: explicit primary/brand markers
    if (/\bprimary\b/.test(p)) return 100;
    if (/\bbrand\b/.test(p)) return 90;
    if (/\binteractive\b/.test(p)) return 85;
    if (/\bmain\b/.test(p)) return 80;
    if (/\bbase\b/.test(p)) return 75;
    // Secondary markers
    if (/\bsecondary\b/.test(p)) return 60;
    if (/\baccent\b/.test(p)) return 55;
    // Mid-scale steps that tend to be "main" colors
    if (/[._-](500|600)[._-]?/.test(p) || p.endsWith(".500") || p.endsWith(".600")) return 50;
    if (/[._-](400|700)[._-]?/.test(p) || p.endsWith(".400") || p.endsWith(".700")) return 40;
    // Deprioritize utility colors
    if (/\b(white|black|transparent|inherit|current)\b/.test(p)) return -10;
    // Deprioritize neutral/gray tokens
    if (/\b(neutral|gray|grey|slate|zinc|stone)\b/.test(p)) return 5;
    return 20;
  };

  return [...direct].sort((a, b) => {
    const diff = scoreFor(b[0]) - scoreFor(a[0]);
    if (diff !== 0) return diff;
    // Tie-break: shorter path = more generic = more likely the canonical token
    return a[0].length - b[0].length;
  });
}

/** Extract the primary sans-serif font family from the flat token map. */
function extractFontFamily(flat: FlatTokenMap): string | null {
  for (const [path, leaf] of Object.entries(flat)) {
    if (
      (leaf.type === "fontFamilies" || leaf.type === "fontFamily" || /font.?famil/i.test(path)) &&
      typeof leaf.value === "string" &&
      !/mono|code|consolas|fira|jetbrains|courier|menlo|inconsolata/i.test(leaf.value)
    ) {
      // Return just the first font name when the value is a comma-separated stack
      return leaf.value.split(",")[0]?.trim() ?? null;
    }
  }
  return null;
}

/** Extract the monospace font family, if any. */
function extractMonoFontFamily(flat: FlatTokenMap): string | undefined {
  for (const [path, leaf] of Object.entries(flat)) {
    if (
      (leaf.type === "fontFamilies" || leaf.type === "fontFamily" || /font.?famil/i.test(path)) &&
      typeof leaf.value === "string" &&
      /mono|code|consolas|fira|jetbrains|courier|menlo|inconsolata/i.test(leaf.value)
    ) {
      return leaf.value.split(",")[0]?.trim();
    }
  }
  return undefined;
}

/**
 * Derive a brand name from the token map or filename.
 *
 * Looks for:
 *   1. A token at path "brand.name" or "global.brand-name" with a string value
 *   2. The filename without extension (cleaned up)
 */
function extractBrandNameFromTokens(flat: FlatTokenMap, filePath: string): string {
  // Look for an explicit brand name token
  for (const [path, leaf] of Object.entries(flat)) {
    if (/\b(brand[_.-]?name|name[_.-]?brand)\b/i.test(path) && typeof leaf.value === "string") {
      return leaf.value.trim();
    }
  }

  // Fall back to filename
  const filename = basename(filePath, extname(filePath));
  return filename
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || "Brand";
}
