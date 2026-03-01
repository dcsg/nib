/**
 * Brand build — transforms DTCG token files into platform outputs.
 *
 * Phase 1 targets: CSS custom properties + Tailwind preset.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { NibBrandConfig } from "../types/brand.js";

/** Flatten nested DTCG tokens into a flat key→value map */
function flattenTokens(
  obj: Record<string, unknown>,
  prefix: string = "",
  parentType?: string,
): Record<string, { value: string | number | Record<string, unknown>; type?: string }> {
  const result: Record<string, { value: string | number | Record<string, unknown>; type?: string }> = {};

  const currentType = (obj.$type as string) ?? parentType;

  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith("$")) continue;

    const path = prefix ? `${prefix}-${key}` : key;

    if (val && typeof val === "object" && "$value" in val) {
      const token = val as { $value: string | number | Record<string, unknown>; $type?: string };
      result[path] = { value: token.$value, type: token.$type ?? currentType };
    } else if (val && typeof val === "object") {
      Object.assign(result, flattenTokens(val as Record<string, unknown>, path, currentType));
    }
  }

  return result;
}

/** Resolve DTCG references {foo.bar} → var(--foo-bar) for CSS output */
function resolveToCssVar(value: string | number | Record<string, unknown>): string {
  if (typeof value === "number") return String(value);

  if (typeof value === "object") {
    // Shadow values
    const shadow = value as Record<string, string>;
    return `${shadow.offsetX ?? "0px"} ${shadow.offsetY ?? "0px"} ${shadow.blur ?? "0px"} ${shadow.spread ?? "0px"} ${shadow.color ?? "transparent"}`;
  }

  // Replace {foo.bar.baz} with var(--foo-bar-baz)
  return value.replace(/\{([^}]+)\}/g, (_match, ref: string) => {
    const varName = ref.replace(/\./g, "-");
    return `var(--${varName})`;
  });
}

/** Build a flat lookup map from resolved tokens: "color.white" → "#ffffff" */
function buildLookup(
  ...tokenSets: Record<string, { value: string | number | Record<string, unknown>; type?: string }>[]
): Record<string, string> {
  const lookup: Record<string, string> = {};
  for (const set of tokenSets) {
    for (const [key, { value }] of Object.entries(set)) {
      if (typeof value === "string") {
        // Store with dots: "color-white" → "color.white" for DTCG reference lookup
        lookup[key.replace(/-/g, ".")] = value;
      }
    }
  }
  return lookup;
}

/** Resolve DTCG references {foo.bar} → actual value from lookup */
function resolveToValue(
  value: string | number | Record<string, unknown>,
  lookup: Record<string, string>,
): string {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return String(value);

  return value.replace(/\{([^}]+)\}/g, (_match, ref: string) => {
    return lookup[ref] ?? _match;
  });
}

/** Read a JSON token file */
async function readTokenFile(path: string): Promise<Record<string, unknown>> {
  const content = await readFile(path, "utf-8");
  return JSON.parse(content) as Record<string, unknown>;
}

/** Ensure directory and write file */
async function writeOutput(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

/** Build CSS custom properties from all token files */
export async function buildCss(tokensDir: string, outputPath: string): Promise<void> {
  // Read all token files
  const [primitives, semanticLight, semanticDark, typography, spacing, radius, elevation, motion, sizing, borderWidthFile, opacityFile, zIndexFile, breakpointFile] =
    await Promise.all([
      readTokenFile(join(tokensDir, "color", "primitives.tokens.json")),
      readTokenFile(join(tokensDir, "color", "semantic-light.tokens.json")),
      readTokenFile(join(tokensDir, "color", "semantic-dark.tokens.json")),
      readTokenFile(join(tokensDir, "typography.tokens.json")),
      readTokenFile(join(tokensDir, "spacing.tokens.json")),
      readTokenFile(join(tokensDir, "border-radius.tokens.json")),
      readTokenFile(join(tokensDir, "elevation.tokens.json")),
      readTokenFile(join(tokensDir, "motion.tokens.json")),
      readTokenFile(join(tokensDir, "sizing.tokens.json")),
      readTokenFile(join(tokensDir, "border-width.tokens.json")),
      readTokenFile(join(tokensDir, "opacity.tokens.json")),
      readTokenFile(join(tokensDir, "z-index.tokens.json")),
      readTokenFile(join(tokensDir, "breakpoints.tokens.json")),
    ]);

  // Flatten all tokens
  const flatPrimitives = flattenTokens(primitives);
  const flatSemanticLight = flattenTokens(semanticLight);
  const flatSemanticDark = flattenTokens(semanticDark);
  const flatTypography = flattenTokens(typography);
  const flatSpacing = flattenTokens(spacing);
  const flatRadius = flattenTokens(radius);
  const flatElevation = flattenTokens(elevation);
  const flatMotion = flattenTokens(motion);
  const flatSizing = flattenTokens(sizing);
  const flatBorderWidth = flattenTokens(borderWidthFile);
  const flatOpacity = flattenTokens(opacityFile);
  const flatZIndex = flattenTokens(zIndexFile);
  const flatBreakpoint = flattenTokens(breakpointFile);

  // Generate CSS
  const lines: string[] = [
    "/* Generated by nib brand build — do not edit manually */",
    "",
    ":root {",
  ];

  // Primitives
  lines.push("  /* Color Primitives */");
  for (const [key, { value }] of Object.entries(flatPrimitives)) {
    lines.push(`  --${key}: ${resolveToCssVar(value)};`);
  }

  // Semantic light (default)
  lines.push("");
  lines.push("  /* Semantic Colors (Light) */");
  for (const [key, { value }] of Object.entries(flatSemanticLight)) {
    lines.push(`  --${key}: ${resolveToCssVar(value)};`);
  }

  // Typography
  lines.push("");
  lines.push("  /* Typography */");
  for (const [key, { value }] of Object.entries(flatTypography)) {
    lines.push(`  --${key}: ${resolveToCssVar(value)};`);
  }

  // Spacing
  lines.push("");
  lines.push("  /* Spacing */");
  for (const [key, { value }] of Object.entries(flatSpacing)) {
    lines.push(`  --${key}: ${resolveToCssVar(value)};`);
  }

  // Border radius
  lines.push("");
  lines.push("  /* Border Radius */");
  for (const [key, { value }] of Object.entries(flatRadius)) {
    lines.push(`  --${key}: ${resolveToCssVar(value)};`);
  }

  // Elevation
  lines.push("");
  lines.push("  /* Elevation */");
  for (const [key, { value }] of Object.entries(flatElevation)) {
    lines.push(`  --${key}: ${resolveToCssVar(value)};`);
  }

  // Motion
  lines.push("");
  lines.push("  /* Motion */");
  for (const [key, { value }] of Object.entries(flatMotion)) {
    if (Array.isArray(value)) {
      lines.push(`  --${key}: cubic-bezier(${(value as number[]).join(", ")});`);
    } else {
      lines.push(`  --${key}: ${resolveToCssVar(value)};`);
    }
  }

  // Sizing
  lines.push("");
  lines.push("  /* Sizing */");
  for (const [key, { value }] of Object.entries(flatSizing)) {
    lines.push(`  --${key}: ${resolveToCssVar(value)};`);
  }

  // Border Width
  lines.push("");
  lines.push("  /* Border Width */");
  for (const [key, { value }] of Object.entries(flatBorderWidth)) {
    lines.push(`  --${key}: ${resolveToCssVar(value)};`);
  }

  // Opacity
  lines.push("");
  lines.push("  /* Opacity */");
  for (const [key, { value }] of Object.entries(flatOpacity)) {
    lines.push(`  --${key}: ${resolveToCssVar(value)};`);
  }

  // Z-Index
  lines.push("");
  lines.push("  /* Z-Index */");
  for (const [key, { value }] of Object.entries(flatZIndex)) {
    lines.push(`  --${key}: ${resolveToCssVar(value)};`);
  }

  // Breakpoints
  lines.push("");
  lines.push("  /* Breakpoints */");
  for (const [key, { value }] of Object.entries(flatBreakpoint)) {
    lines.push(`  --${key}: ${resolveToCssVar(value)};`);
  }

  lines.push("}");
  lines.push("");

  // Dark mode
  lines.push("@media (prefers-color-scheme: dark) {");
  lines.push("  :root {");
  for (const [key, { value }] of Object.entries(flatSemanticDark)) {
    lines.push(`    --${key}: ${resolveToCssVar(value)};`);
  }
  lines.push("  }");
  lines.push("}");
  lines.push("");

  // Also support data attribute
  lines.push('[data-theme="dark"] {');
  for (const [key, { value }] of Object.entries(flatSemanticDark)) {
    lines.push(`  --${key}: ${resolveToCssVar(value)};`);
  }
  lines.push("}");
  lines.push("");

  await writeOutput(outputPath, lines.join("\n"));
}

/** Build Tailwind preset from CSS variables */
export async function buildTailwindPreset(
  tokensDir: string,
  outputPath: string,
): Promise<void> {
  // Read token files to discover the structure
  const [primitives, semanticLight, typography, spacing, radius, twSizing, twBorderWidth, twOpacity, twZIndex, twBreakpoint] =
    await Promise.all([
      readTokenFile(join(tokensDir, "color", "primitives.tokens.json")),
      readTokenFile(join(tokensDir, "color", "semantic-light.tokens.json")),
      readTokenFile(join(tokensDir, "typography.tokens.json")),
      readTokenFile(join(tokensDir, "spacing.tokens.json")),
      readTokenFile(join(tokensDir, "border-radius.tokens.json")),
      readTokenFile(join(tokensDir, "sizing.tokens.json")),
      readTokenFile(join(tokensDir, "border-width.tokens.json")),
      readTokenFile(join(tokensDir, "opacity.tokens.json")),
      readTokenFile(join(tokensDir, "z-index.tokens.json")),
      readTokenFile(join(tokensDir, "breakpoints.tokens.json")),
    ]);

  const flatPrimitives = flattenTokens(primitives);
  const flatSemantic = flattenTokens(semanticLight);
  const flatTypography = flattenTokens(typography);
  const flatSpacing = flattenTokens(spacing);
  const flatRadius = flattenTokens(radius);
  const flatTwSizing = flattenTokens(twSizing);
  const flatTwBorderWidth = flattenTokens(twBorderWidth);
  const flatTwOpacity = flattenTokens(twOpacity);
  const flatTwZIndex = flattenTokens(twZIndex);
  const flatTwBreakpoint = flattenTokens(twBreakpoint);

  // Build color object from primitives and semantic
  const colors: Record<string, string | Record<string, string>> = {};

  for (const key of Object.keys(flatPrimitives)) {
    const parts = key.split("-");
    if (parts[0] !== "color") continue;

    const group = parts[1]!;
    const step = parts[2];

    if (!step) {
      // Simple value like color-white
      colors[group] = `var(--${key})`;
    } else {
      if (!colors[group] || typeof colors[group] === "string") {
        colors[group] = {};
      }
      (colors[group] as Record<string, string>)[step] = `var(--${key})`;
    }
  }

  // Semantic colors
  for (const key of Object.keys(flatSemantic)) {
    const parts = key.split("-");
    if (parts[0] !== "color") continue;

    const group = parts.slice(1, -1).join("-") || parts[1]!;
    const step = parts.length > 2 ? parts[parts.length - 1]! : undefined;

    if (!step || parts.length === 2) {
      colors[parts.slice(1).join("-")] = `var(--${key})`;
    } else {
      if (!colors[group] || typeof colors[group] === "string") {
        colors[group] = {};
      }
      (colors[group] as Record<string, string>)[step] = `var(--${key})`;
    }
  }

  // Font families
  const fontFamily: Record<string, string> = {};
  for (const [key, { value }] of Object.entries(flatTypography)) {
    if (key.startsWith("font-family-")) {
      const name = key.replace("font-family-", "");
      fontFamily[name] = `var(--${key})`;
    }
  }

  // Font sizes
  const fontSize: Record<string, string> = {};
  for (const key of Object.keys(flatTypography)) {
    if (key.startsWith("font-size-")) {
      const name = key.replace("font-size-", "");
      fontSize[name] = `var(--${key})`;
    }
  }

  // Spacing
  const spacingObj: Record<string, string> = {};
  for (const key of Object.keys(flatSpacing)) {
    const name = key.replace("spacing-", "");
    spacingObj[name] = `var(--${key})`;
  }

  // Border radius
  const borderRadius: Record<string, string> = {};
  for (const key of Object.keys(flatRadius)) {
    const name = key.replace("border-radius-", "");
    borderRadius[name] = `var(--${key})`;
  }

  // Width (from sizing — container sizes)
  const width: Record<string, string> = {};
  const maxWidth: Record<string, string> = {};
  for (const [key, { value }] of Object.entries(flatTwSizing)) {
    const name = key.replace("sizing-", "").replace(/-/g, ".");
    width[name] = `var(--${key})`;
    // Container sizes also go into maxWidth
    if (key.startsWith("sizing-container-")) {
      const containerName = key.replace("sizing-container-", "");
      maxWidth[containerName] = `var(--${key})`;
    }
  }

  // Border width
  const twBorderWidthObj: Record<string, string> = {};
  for (const key of Object.keys(flatTwBorderWidth)) {
    const name = key.replace("border-width-", "");
    twBorderWidthObj[name] = `var(--${key})`;
  }

  // Opacity
  const opacityObj: Record<string, string> = {};
  for (const [key, { value }] of Object.entries(flatTwOpacity)) {
    const name = key.replace("opacity-", "");
    opacityObj[name] = `var(--${key})`;
  }

  // Z-index
  const zIndexObj: Record<string, string> = {};
  for (const [key, { value }] of Object.entries(flatTwZIndex)) {
    const name = key.replace("z-index-", "");
    zIndexObj[name] = `var(--${key})`;
  }

  // Screens (breakpoints)
  const screens: Record<string, string> = {};
  for (const [key, { value }] of Object.entries(flatTwBreakpoint)) {
    const name = key.replace("breakpoint-", "");
    if (typeof value === "string" && value !== "0px") {
      screens[name] = `var(--${key})`;
    }
  }

  const preset = `// Generated by nib brand build — do not edit manually
export default {
  theme: {
    extend: {
      colors: ${JSON.stringify(colors, null, 6).replace(/"/g, "'")},
      fontFamily: ${JSON.stringify(fontFamily, null, 6).replace(/"/g, "'")},
      fontSize: ${JSON.stringify(fontSize, null, 6).replace(/"/g, "'")},
      spacing: ${JSON.stringify(spacingObj, null, 6).replace(/"/g, "'")},
      borderRadius: ${JSON.stringify(borderRadius, null, 6).replace(/"/g, "'")},
      width: ${JSON.stringify(width, null, 6).replace(/"/g, "'")},
      maxWidth: ${JSON.stringify(maxWidth, null, 6).replace(/"/g, "'")},
      borderWidth: ${JSON.stringify(twBorderWidthObj, null, 6).replace(/"/g, "'")},
      opacity: ${JSON.stringify(opacityObj, null, 6).replace(/"/g, "'")},
      zIndex: ${JSON.stringify(zIndexObj, null, 6).replace(/"/g, "'")},
      screens: ${JSON.stringify(screens, null, 6).replace(/"/g, "'")},
    }
  }
}
`;

  await writeOutput(outputPath, preset);
}

/** Pencil variable value — flat or themed (light/dark array). */
type PencilVarValue =
  | string
  | number
  | Array<{ value: string | number; theme: Record<string, string> }>;

/** Build Pencil.dev variables JSON with light/dark theming for semantic colors. */
export async function buildPencilVariables(
  tokensDir: string,
  outputPath: string,
): Promise<void> {
  const [primitives, semanticLight, semanticDark, typography, spacing, pSizing, pBorderWidth, pOpacity, pZIndex, pBreakpoint] = await Promise.all([
    readTokenFile(join(tokensDir, "color", "primitives.tokens.json")),
    readTokenFile(join(tokensDir, "color", "semantic-light.tokens.json")),
    readTokenFile(join(tokensDir, "color", "semantic-dark.tokens.json")),
    readTokenFile(join(tokensDir, "typography.tokens.json")),
    readTokenFile(join(tokensDir, "spacing.tokens.json")),
    readTokenFile(join(tokensDir, "sizing.tokens.json")),
    readTokenFile(join(tokensDir, "border-width.tokens.json")),
    readTokenFile(join(tokensDir, "opacity.tokens.json")),
    readTokenFile(join(tokensDir, "z-index.tokens.json")),
    readTokenFile(join(tokensDir, "breakpoints.tokens.json")),
  ]);

  const variables: Record<string, { type: string; value: PencilVarValue }> = {};

  // Flatten all token sets
  const flatColors = flattenTokens(primitives);
  const flatSemantic = flattenTokens(semanticLight);
  const flatSemanticDark = flattenTokens(semanticDark);
  const flatTypo = flattenTokens(typography);
  const flatSpacing = flattenTokens(spacing);
  const flatPSizing = flattenTokens(pSizing);
  const flatPBorderWidth = flattenTokens(pBorderWidth);
  const flatPOpacity = flattenTokens(pOpacity);
  const flatPZIndex = flattenTokens(pZIndex);
  const flatPBreakpoint = flattenTokens(pBreakpoint);

  // Build lookup for resolving DTCG references to actual values
  const lookup = buildLookup(flatColors, flatTypo, flatSpacing);

  // Color primitives (already hex values)
  for (const [key, { value, type }] of Object.entries(flatColors)) {
    if (type === "color" && typeof value === "string") {
      variables[key] = { type: "color", value };
    }
  }

  // Semantic colors — resolve to hex; emit themed array when light ≠ dark.
  // Any frame with theme: {"mode": "dark"} will automatically use the dark value.
  for (const [key, { value, type }] of Object.entries(flatSemantic)) {
    if (type === "color" && typeof value === "string") {
      const lightHex = resolveToValue(value, lookup);
      const darkEntry = flatSemanticDark[key];
      if (darkEntry && typeof darkEntry.value === "string") {
        const darkHex = resolveToValue(darkEntry.value, lookup);
        if (lightHex !== darkHex) {
          variables[key] = {
            type: "color",
            value: [
              { value: lightHex, theme: { mode: "light" } },
              { value: darkHex, theme: { mode: "dark" } },
            ],
          };
        } else {
          variables[key] = { type: "color", value: lightHex };
        }
      } else {
        variables[key] = { type: "color", value: lightHex };
      }
    }
  }

  // Typography values — fontFamily as string (first font only, strip fallback stack), numeric values as number
  for (const [key, { value, type }] of Object.entries(flatTypo)) {
    if (type === "fontFamily" && typeof value === "string") {
      const fontName = value.split(",")[0]!.trim();
      variables[key] = { type: "string", value: fontName };
    } else if (typeof value === "string") {
      const num = parseFloat(value);
      variables[key] = Number.isNaN(num)
        ? { type: "string", value }
        : { type: "number", value: num };
    } else if (typeof value === "number") {
      variables[key] = { type: "number", value };
    }
  }

  // Spacing — resolve aliases, store as numbers
  for (const [key, { value }] of Object.entries(flatSpacing)) {
    if (typeof value === "string") {
      const resolved = resolveToValue(value, lookup);
      const num = parseFloat(resolved);
      variables[key] = Number.isNaN(num)
        ? { type: "string", value: resolved }
        : { type: "number", value: num };
    }
  }

  // Sizing — parse px values to numbers
  for (const [key, { value }] of Object.entries(flatPSizing)) {
    if (typeof value === "string") {
      const num = parseFloat(value);
      variables[key] = Number.isNaN(num)
        ? { type: "string", value }
        : { type: "number", value: num };
    }
  }

  // Border width — parse px values to numbers
  for (const [key, { value }] of Object.entries(flatPBorderWidth)) {
    if (typeof value === "string") {
      const num = parseFloat(value);
      variables[key] = Number.isNaN(num)
        ? { type: "string", value }
        : { type: "number", value: num };
    }
  }

  // Opacity — already numbers
  for (const [key, { value }] of Object.entries(flatPOpacity)) {
    if (typeof value === "number") {
      variables[key] = { type: "number", value };
    }
  }

  // Z-index — already numbers
  for (const [key, { value }] of Object.entries(flatPZIndex)) {
    if (typeof value === "number") {
      variables[key] = { type: "number", value };
    }
  }

  // Breakpoints — parse px values to numbers
  for (const [key, { value }] of Object.entries(flatPBreakpoint)) {
    if (typeof value === "string") {
      const num = parseFloat(value);
      variables[key] = Number.isNaN(num)
        ? { type: "string", value }
        : { type: "number", value: num };
    }
  }

  await writeOutput(outputPath, JSON.stringify(variables, null, 2) + "\n");
}

/** Run all platform builds */
export async function buildAll(config: NibBrandConfig): Promise<void> {
  const tokensDir = config.tokens;

  await Promise.all([
    buildCss(tokensDir, config.platforms.css),
    buildTailwindPreset(tokensDir, config.platforms.tailwind),
    buildPencilVariables(tokensDir, config.platforms.pencil),
  ]);
}
