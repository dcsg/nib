/**
 * Brand importer — reads Pencil variables from a .pen file via MCP
 * and produces DTCG token files + brand.config.json.
 *
 * Used by `nib brand import` CLI and `nib_brand_import` MCP tool.
 *
 * Diff-first pattern:
 * - If brand.config.json already exists and overwrite is false → returns diff
 *   summary with requiresConfirmation: true (no files written).
 * - If overwrite is true (CLI confirmed or MCP second call) → proceeds.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

export interface BrandImportOptions {
  /** Path to the .pen file to import from */
  file: string;
  /** Tokens output directory (default: docs/design/system/tokens) */
  output?: string;
  /** Path to write brand.config.json (default: .nib/brand.config.json) */
  config?: string;
  /** Skip diff check and overwrite existing config (default: false) */
  overwrite?: boolean;
}

export interface BrandImportDiff {
  /** If true, an existing config was found and confirmation is required */
  requiresConfirmation: true;
  configPath: string;
  existingBrandName: string;
  proposedBrandName: string;
  existingTokensDir: string;
  proposedTokensDir: string;
}

export interface BrandImportResult {
  /** Always false when the import completed successfully */
  requiresConfirmation: false;
  tokensDir: string;
  configPath: string;
  tokenCount: number;
  categories: string[];
}

export type BrandImportOutcome = BrandImportDiff | BrandImportResult;

// ---------------------------------------------------------------------------
// Variable categorisation
// ---------------------------------------------------------------------------

interface RawVar {
  type: string;
  value: string | number;
}

type TokenCategory =
  | "color/primitives"
  | "color/semantic"
  | "color/brand"
  | "typography/index"
  | "spacing/index"
  | "radius/index"
  | "elevation/index"
  | "misc/index";

function categorise(name: string): TokenCategory {
  if (name.startsWith("color-brand-")) return "color/brand";
  if (
    name.startsWith("color-background-") ||
    name.startsWith("color-text-") ||
    name.startsWith("color-border-") ||
    name.startsWith("color-interactive-") ||
    name.startsWith("color-feedback-")
  ) {
    return "color/semantic";
  }
  if (name.startsWith("color-")) return "color/primitives";
  if (
    name.startsWith("font-family-") ||
    name.startsWith("font-size-") ||
    name.startsWith("font-weight-") ||
    name.startsWith("line-height-") ||
    name.startsWith("letter-spacing-")
  ) {
    return "typography/index";
  }
  if (name.startsWith("spacing-")) return "spacing/index";
  if (name.startsWith("border-radius-")) return "radius/index";
  if (name.startsWith("shadow-")) return "elevation/index";
  return "misc/index";
}

/** Infer DTCG $type from variable type and category. */
function dtcgType(rawType: string, category: TokenCategory): string {
  if (rawType === "color" || category.startsWith("color/")) return "color";
  if (category === "typography/index") {
    if (rawType === "string") return "fontFamily";
    return "dimension";
  }
  if (
    category === "spacing/index" ||
    category === "radius/index" ||
    category === "elevation/index"
  ) {
    return "dimension";
  }
  return "string";
}

/** Append "px" for dimension values that are bare numbers. */
function formatValue(value: string | number, type: string): unknown {
  if (type === "dimension" && typeof value === "number") {
    return `${value}px`;
  }
  if (type === "dimension" && typeof value === "string" && /^\d+(\.\d+)?$/.test(value)) {
    return `${value}px`;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Core import function
// ---------------------------------------------------------------------------

export async function brandImport(
  options: BrandImportOptions,
): Promise<BrandImportOutcome> {
  const penFile = resolve(options.file);
  const configPath = resolve(options.config ?? join(".nib", "brand.config.json"));
  const tokensDir = resolve(
    options.output ?? join("docs", "design", "system", "tokens"),
  );
  const overwrite = options.overwrite ?? false;

  // ── Diff-first check ────────────────────────────────────────────────────
  if (!overwrite && existsSync(configPath)) {
    let existingBrandName = "(unknown)";
    let existingTokensDir = "(unknown)";
    try {
      const raw = JSON.parse(await readFile(configPath, "utf-8")) as {
        brand?: { name?: string };
        tokens?: string;
      };
      existingBrandName = raw.brand?.name ?? existingBrandName;
      existingTokensDir = raw.tokens ?? existingTokensDir;
    } catch {
      // ignore parse errors
    }

    const proposedBrandName = basename(penFile, ".pen");

    return {
      requiresConfirmation: true,
      configPath,
      existingBrandName,
      proposedBrandName,
      existingTokensDir,
      proposedTokensDir: tokensDir,
    };
  }

  // ── Discover & connect to Pencil MCP ────────────────────────────────────
  const { discoverPencilMcp } = await import("../mcp/discover.js");
  const { withMcpClient } = await import("../mcp/client.js");

  const mcpConfig = await discoverPencilMcp();

  const rawVars = await withMcpClient(mcpConfig, async (client) => {
    await client.openDocument(penFile);
    return (await client.getVariables()) as {
      variables?: Record<string, RawVar>;
    };
  });

  const variables = rawVars.variables ?? {};

  // ── Categorise variables ─────────────────────────────────────────────────
  const groups = new Map<TokenCategory, Map<string, unknown>>();

  let tokenCount = 0;
  for (const [name, raw] of Object.entries(variables)) {
    // Skip Pencil alias variables (prefixed with $--)
    if (name.startsWith("$--")) continue;

    const category = categorise(name);
    const type = dtcgType(raw.type, category);
    const value = formatValue(raw.value, type);

    if (!groups.has(category)) {
      groups.set(category, new Map());
    }
    groups.get(category)!.set(name, { $type: type, $value: value });
    tokenCount++;
  }

  // ── Write token files ────────────────────────────────────────────────────
  const categories: string[] = [];

  for (const [category, tokens] of groups.entries()) {
    const filePath = join(tokensDir, `${category}.tokens.json`);
    await mkdir(dirname(filePath), { recursive: true });

    const obj: Record<string, unknown> = {};
    for (const [k, v] of tokens.entries()) {
      obj[k] = v;
    }

    await writeFile(filePath, JSON.stringify(obj, null, 2) + "\n");
    categories.push(category);
  }

  // ── Write brand.config.json ──────────────────────────────────────────────
  const brandName = basename(penFile, ".pen");
  const outputDir = dirname(tokensDir);

  const brandConfig = {
    version: "1",
    generator: "nib",
    brand: {
      name: brandName,
      personality: [] as string[],
    },
    tokens: tokensDir,
    platforms: {
      css: join(outputDir, "build", "css", "variables.css"),
      tailwind: join(outputDir, "build", "tailwind", "preset.js"),
      pencil: join(outputDir, "build", "pencil", "variables.json"),
      penFile,
    },
    output: outputDir,
    ai: {
      provider: false as const,
    },
  };

  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(brandConfig, null, 2) + "\n");

  return {
    requiresConfirmation: false,
    tokensDir,
    configPath,
    tokenCount,
    categories: categories.sort(),
  };
}
