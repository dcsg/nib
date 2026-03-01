/**
 * File writer — generates DTCG JSON token files, brand.md, and brand.config.json.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type {
  BrandAiEnhancement,
  BrandInput,
  DtcgTokenFile,
  NibBrandConfig,
} from "../types/brand.js";
import { injectExtensionsIntoFile } from "./tokens/extensions.js";

/** Ensure directory exists, then write JSON */
async function writeJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n");
}

/** Ensure directory exists, then write text */
async function writeText(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
}

/** Write all DTCG token files to the tokens directory */
export async function writeTokenFiles(
  tokensDir: string,
  tokens: {
    colorPrimitives: DtcgTokenFile;
    semanticLight: DtcgTokenFile;
    semanticDark: DtcgTokenFile;
    typography: DtcgTokenFile;
    spacing: DtcgTokenFile;
    radius: DtcgTokenFile;
    elevation: DtcgTokenFile;
    motion: DtcgTokenFile;
    sizing: DtcgTokenFile;
    borderWidth: DtcgTokenFile;
    opacity: DtcgTokenFile;
    zIndex: DtcgTokenFile;
    breakpoint: DtcgTokenFile;
  },
): Promise<void> {
  // Inject $extensions.nib into every leaf token before writing
  const withExt = (f: DtcgTokenFile) => injectExtensionsIntoFile(f);

  await Promise.all([
    writeJson(join(tokensDir, "color", "primitives.tokens.json"), withExt(tokens.colorPrimitives)),
    writeJson(join(tokensDir, "color", "semantic-light.tokens.json"), withExt(tokens.semanticLight)),
    writeJson(join(tokensDir, "color", "semantic-dark.tokens.json"), withExt(tokens.semanticDark)),
    writeJson(join(tokensDir, "typography.tokens.json"), withExt(tokens.typography)),
    writeJson(join(tokensDir, "spacing.tokens.json"), withExt(tokens.spacing)),
    writeJson(join(tokensDir, "border-radius.tokens.json"), withExt(tokens.radius)),
    writeJson(join(tokensDir, "elevation.tokens.json"), withExt(tokens.elevation)),
    writeJson(join(tokensDir, "motion.tokens.json"), withExt(tokens.motion)),
    writeJson(join(tokensDir, "sizing.tokens.json"), withExt(tokens.sizing)),
    writeJson(join(tokensDir, "border-width.tokens.json"), withExt(tokens.borderWidth)),
    writeJson(join(tokensDir, "opacity.tokens.json"), withExt(tokens.opacity)),
    writeJson(join(tokensDir, "z-index.tokens.json"), withExt(tokens.zIndex)),
    writeJson(join(tokensDir, "breakpoints.tokens.json"), withExt(tokens.breakpoint)),
  ]);
}

/** Write the .nib/brand.config.json */
export async function writeBrandConfig(config: NibBrandConfig): Promise<void> {
  await writeJson(resolve(".nib", "brand.config.json"), config);
}

/** Generate brand.md content */
export function generateBrandMd(
  input: BrandInput,
  enhancement?: BrandAiEnhancement,
): string {
  const date = new Date().toISOString().split("T")[0];
  const personality = input.personality?.join(", ") ?? "professional";

  const identity = enhancement?.identity ??
    `${input.name} is a ${personality} brand${input.industry ? ` in the ${input.industry} industry` : ""}. ${input.description ?? ""}`.trim();

  const colorRules = enhancement?.colorRules ??
    `- Use **brand** colors for primary interactive elements (buttons, links, focus rings)
- Use **neutral** colors for text, borders, and backgrounds
- Reserve **feedback** colors (success, warning, error, info) strictly for status communication
- In dark mode, use lighter tints of brand colors for interactive elements
- Never use raw hex values — always reference semantic tokens`;

  const typographyRules = enhancement?.typographyRules ??
    `- **Display**: Hero sections, landing page headlines only
- **Heading**: Section titles, card headers
- **Body**: Default paragraph text, form labels
- **Caption**: Helper text, timestamps, metadata
- Line heights follow a 4px grid for vertical rhythm
- Font weights: 400 (body), 500 (labels), 600 (headings), 700 (display)`;

  const spacingRules = enhancement?.spacingRules ??
    `- Base unit: 4px — all spacing is a multiple of 4
- Use **xs** (8px) for tight element spacing (icon gaps, inline elements)
- Use **sm–md** (12–16px) for component internal padding
- Use **lg–xl** (24–32px) for section spacing
- Use **2xl–4xl** (48–96px) for page-level vertical rhythm`;

  const componentPatterns = enhancement?.componentPatterns ??
    `### Buttons
- Primary: brand interactive color, white text, md border-radius
- Secondary: transparent with brand border, brand text
- Destructive: error color, white text
- All buttons: md padding horizontal, sm padding vertical, label font weight

### Cards
- White/surface background, sm border-radius, md elevation shadow
- lg padding, neutral border (secondary)
- Hover: elevate shadow one step

### Forms
- Inputs: neutral border, md border-radius, sm vertical padding, md horizontal
- Focus: brand focus ring (2px), border color → brand
- Error state: error border + error text below
- Labels: label size, secondary text color, sm margin below`;

  return `# Brand System — ${input.name}
<!-- nib-brand: v1 | generated: ${date} | do not edit manually -->

## Identity

${identity}

**Personality:** ${personality}
${input.industry ? `**Industry:** ${input.industry}` : ""}

## Color

${colorRules}

## Typography

**Primary font:** ${input.typography.fontFamily}
${input.typography.monoFontFamily ? `**Mono font:** ${input.typography.monoFontFamily}` : ""}
**Scale ratio:** ${input.typography.scaleRatio ?? "major-third"} (1.25)

${typographyRules}

## Spacing

${spacingRules}

## Components

${componentPatterns}
`;
}

/** Generate components.md content */
export function generateComponentsMd(input: BrandInput): string {
  return `# Component Styling Rules — ${input.name}
<!-- nib-brand-components: v1 -->

## Button

| Variant | Background | Text | Border |
|---------|-----------|------|--------|
| Primary | interactive.default | text.inverse | none |
| Secondary | transparent | interactive.default | interactive.default |
| Ghost | transparent | interactive.default | none |
| Destructive | feedback.error | text.inverse | none |

**Border radius:** md (8px)
**Padding:** spacing.sm vertical, spacing.md horizontal
**Font:** label size, label weight

## Input

**Border:** border.primary (1px solid)
**Border radius:** md (8px)
**Padding:** spacing.sm vertical, spacing.md horizontal
**Focus:** border → border.focus, ring → brand.500/20%
**Error:** border → feedback.error, helper text → feedback.error

## Card

**Background:** surface.primary
**Border:** border.secondary (1px solid)
**Border radius:** lg (12px)
**Padding:** spacing.lg
**Shadow:** elevation.sm
**Hover:** elevation.md

## Badge

**Border radius:** full (pill)
**Padding:** spacing.2xs vertical, spacing.xs horizontal
**Font:** caption size

## Avatar

**Border radius:** full (circle)
**Sizes:** 24px (sm), 32px (md), 40px (lg), 48px (xl)
`;
}

/** Write brand.md and components.md */
export async function writeBrandDocs(
  outputDir: string,
  input: BrandInput,
  enhancement?: BrandAiEnhancement,
): Promise<void> {
  await Promise.all([
    writeText(join(outputDir, "brand.md"), generateBrandMd(input, enhancement)),
    writeText(join(outputDir, "components.md"), generateComponentsMd(input)),
  ]);
}
