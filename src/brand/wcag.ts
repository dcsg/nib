/**
 * WCAG contrast ratio calculation and AA/AAA checking.
 *
 * Implements the WCAG 2.1 relative luminance and contrast ratio algorithms.
 */

import type { WcagAuditReport, WcagCheckResult } from "../types/brand.js";

/** Parse hex color to linear RGB components (0–1) */
function hexToLinearRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;

  // sRGB to linear
  const linearize = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return [linearize(r), linearize(g), linearize(b)];
}

/** Compute relative luminance per WCAG 2.1 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToLinearRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Compute contrast ratio between two colors (always >= 1) */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Check a single foreground/background pair */
export function checkContrast(
  foreground: string,
  background: string,
  foregroundToken: string,
  backgroundToken: string,
): WcagCheckResult {
  const ratio = contrastRatio(foreground, background);
  return {
    foreground,
    background,
    foregroundToken,
    backgroundToken,
    ratio: Math.round(ratio * 100) / 100,
    passAA: ratio >= 4.5,
    passAAA: ratio >= 7,
    passAALarge: ratio >= 3,
  };
}

/** Semantic text/background pairs to audit */
const AUDIT_PAIRS: [string, string][] = [
  ["text.primary", "background.primary"],
  ["text.primary", "background.secondary"],
  ["text.secondary", "background.primary"],
  ["text.secondary", "background.secondary"],
  ["text.tertiary", "background.primary"],
  ["interactive.default", "background.primary"],
  ["interactive.default", "background.secondary"],
  ["feedback.success", "feedback.success-bg"],
  ["feedback.warning", "feedback.warning-bg"],
  ["feedback.error", "feedback.error-bg"],
  ["feedback.info", "feedback.info-bg"],
];

/**
 * Resolve a DTCG token reference to a hex value.
 * Handles references like `{color.neutral.900}` by looking up in primitives.
 */
function resolveTokenValue(
  tokenValue: string,
  primitives: Record<string, Record<string, Record<string, { $value: string }>>>,
): string | null {
  // If already a hex value, return it
  if (tokenValue.startsWith("#")) return tokenValue;

  // Parse reference like {color.neutral.900}
  const match = tokenValue.match(/^\{(.+)\}$/);
  if (!match) return null;

  const parts = match[1]!.split(".");
  let current: unknown = primitives;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }

  if (current && typeof current === "object" && "$value" in current) {
    return (current as { $value: string }).$value;
  }
  if (typeof current === "string") return current;

  return null;
}

/** Recursively extract token values from a semantic file */
function extractSemanticTokens(
  obj: Record<string, unknown>,
  prefix: string = "",
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith("$")) continue;

    const path = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === "object" && "$value" in value) {
      result[path] = (value as { $value: string }).$value;
    } else if (value && typeof value === "object") {
      Object.assign(result, extractSemanticTokens(value as Record<string, unknown>, path));
    }
  }

  return result;
}

/** Run a full WCAG audit on semantic tokens against primitives */
export function auditTokens(
  semanticTokens: Record<string, unknown>,
  primitiveTokens: Record<string, unknown>,
): WcagAuditReport {
  const resolved = extractSemanticTokens(semanticTokens);
  const results: WcagCheckResult[] = [];

  for (const [fgPath, bgPath] of AUDIT_PAIRS) {
    const fgTokenPath = `color.${fgPath}`;
    const bgTokenPath = `color.${bgPath}`;

    const fgRef = resolved[fgTokenPath];
    const bgRef = resolved[bgTokenPath];

    if (!fgRef || !bgRef) continue;

    const fgHex = resolveTokenValue(fgRef, primitiveTokens as Record<string, Record<string, Record<string, { $value: string }>>>);
    const bgHex = resolveTokenValue(bgRef, primitiveTokens as Record<string, Record<string, Record<string, { $value: string }>>>);

    if (!fgHex || !bgHex) continue;

    results.push(checkContrast(fgHex, bgHex, fgTokenPath, bgTokenPath));
  }

  const failed = results.filter((r) => !r.passAA);

  return {
    totalPairs: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  };
}
