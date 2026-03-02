/**
 * Brand system — public API.
 *
 * init(), build(), push(), audit() are the four primary operations.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

/** Safe fallback when running via `bun src/cli/index.ts` (dev mode without tsup define). */
const NIB_VERSION = typeof __NIB_VERSION__ !== "undefined" ? __NIB_VERSION__ : "0.0.0-dev";
import type {
  AiProviderName,
  BrandAiEnhancement,
  BrandAuditOptions,
  BrandBuildOptions,
  BrandInitOptions,
  BrandInput,
  BrandPushOptions,
  BrandStyleOptions,
  NibBrandConfig,
  NibStatus,
  WcagAuditReport,
} from "../types/brand.js";
import { buildColorPrimitives, buildSemanticDark, buildSemanticLight } from "./tokens/color.js";
import { buildTypographyTokens } from "./tokens/typography.js";
import { buildSpacingTokens } from "./tokens/spacing.js";
import { buildRadiusTokens } from "./tokens/radius.js";
import { buildElevationTokens } from "./tokens/elevation.js";
import { buildMotionTokens } from "./tokens/motion.js";
import { buildSizingTokens } from "./tokens/sizing.js";
import { buildBorderWidthTokens } from "./tokens/border-width.js";
import { buildOpacityTokens } from "./tokens/opacity.js";
import { buildZIndexTokens } from "./tokens/z-index.js";
import { buildBreakpointTokens } from "./tokens/breakpoint.js";
import { writeBrandConfig, writeBrandDocs, writeTokenFiles } from "./writer.js";
import { buildAll, type TokenBuildWarning } from "./build.js";
import { auditTokens } from "./wcag.js";
import { writeFoundationDocs } from "./foundations/index.js";

/** Default output directory */
const DEFAULT_OUTPUT = "docs/design/system";

/** Resolve config path — default or user-provided */
function resolveConfigPath(config?: string): string {
  return config ?? resolve(".nib", "brand.config.json");
}

/** Load brand config from disk */
export async function loadBrandConfig(configPath?: string): Promise<NibBrandConfig> {
  const path = resolveConfigPath(configPath);
  const content = await readFile(path, "utf-8");
  return JSON.parse(content) as NibBrandConfig;
}

/**
 * `nib brand init` — generate a complete brand system from input.
 *
 * 1. Gather brand input (interactive, file, URL, or PDF)
 * 2. Generate token files algorithmically
 * 3. Optionally enhance with AI
 * 4. Write all output files
 * 5. Run initial build
 */
export async function init(
  input: BrandInput,
  options: BrandInitOptions = {},
): Promise<NibBrandConfig> {
  const outputDir = resolve(options.output ?? DEFAULT_OUTPUT);
  const tokensDir = join(outputDir, "tokens");

  // Generate all tokens algorithmically
  const colorPrimitives = buildColorPrimitives(input.colors);
  const semanticLight = buildSemanticLight();
  const semanticDark = buildSemanticDark();
  const typography = buildTypographyTokens(input.typography);
  const spacing = buildSpacingTokens();
  const radius = buildRadiusTokens();
  const elevation = buildElevationTokens();
  const motion = buildMotionTokens();
  const sizing = buildSizingTokens();
  const borderWidth = buildBorderWidthTokens();
  const opacity = buildOpacityTokens();
  const zIndex = buildZIndexTokens();
  const breakpoint = buildBreakpointTokens();

  // Try AI enhancement if available
  let enhancement: BrandAiEnhancement | undefined;
  let usedProvider: AiProviderName | false = false;
  if (!options.noAi) {
    try {
      const { getProvider, detectProvider } = await import("./ai/index.js");
      const provider = getProvider(options.ai);
      if (provider) {
        enhancement = await provider.enhanceBrand(input);
        usedProvider = options.ai ?? detectProvider() ?? "anthropic";
      }
    } catch {
      // AI is optional — continue without it
    }
  }

  // Build config
  const config: NibBrandConfig = {
    version: "1",
    generator: "nib",
    brand: {
      name: input.name,
      personality: input.personality ?? ["professional"],
    },
    tokens: tokensDir,
    platforms: {
      css: join(outputDir, "build", "css", "variables.css"),
      tailwind: join(outputDir, "build", "tailwind", "preset.js"),
      pencil: join(outputDir, "build", "pencil", "variables.json"),
      penFile: join(outputDir, "design-system.pen"),
    },
    output: outputDir,
    ai: {
      provider: usedProvider,
    },
  };

  // Write everything
  await Promise.all([
    writeTokenFiles(tokensDir, {
      colorPrimitives,
      semanticLight,
      semanticDark,
      typography,
      spacing,
      radius,
      elevation,
      motion,
      sizing,
      borderWidth,
      opacity,
      zIndex,
      breakpoint,
    }),
    writeBrandConfig(config),
    writeBrandDocs(outputDir, input, enhancement),
  ]);

  // Run initial build (platform outputs + foundation docs)
  await Promise.all([
    buildAll(config),
    writeFoundationDocs(config),
  ]);

  await updateStatus({
    lastBuild: new Date().toISOString(),
    penFile: config.platforms.penFile,
    tokenVersion: NIB_VERSION,
  });

  return config;
}

/** Write (or update) .nib/.status.json with the latest build metadata */
async function updateStatus(
  patch: Partial<NibStatus>,
): Promise<void> {
  const statusPath = resolve(".nib", ".status.json");
  let current: NibStatus = {};
  try {
    const raw = await readFile(statusPath, "utf-8");
    current = JSON.parse(raw) as NibStatus;
  } catch {
    // File doesn't exist yet — start fresh
  }
  const updated: NibStatus = { ...current, ...patch };
  await mkdir(resolve(".nib"), { recursive: true });
  await writeFile(statusPath, JSON.stringify(updated, null, 2) + "\n");
}

/** Result of a `nib brand build` operation */
export interface BrandBuildResult {
  /** Warnings for required tokens that resolved to the Pencil #000000 fallback */
  tokenWarnings: TokenBuildWarning[];
}

/**
 * `nib brand build` — transform DTCG tokens into platform outputs.
 * Also generates foundation docs, component tokens, and writes .nib/.status.json.
 */
export async function brandBuild(options: BrandBuildOptions = {}): Promise<BrandBuildResult> {
  const config = await loadBrandConfig(options.config);

  const [buildResult] = await Promise.all([
    buildAll(config),
    writeFoundationDocs(config),
  ]);

  // Generate component tokens and docs for all registry entries
  await buildComponentArtifacts(config);

  await updateStatus({
    lastBuild: new Date().toISOString(),
    tokenVersion: NIB_VERSION,
  });

  return { tokenWarnings: buildResult.tokenWarnings };
}

/**
 * Generate component token files, component docs, components.md index,
 * and brand.md inventory section for all contracts in the registry.
 */
async function buildComponentArtifacts(config: NibBrandConfig): Promise<void> {
  const registry = config.components;
  if (!registry || Object.keys(registry).length === 0) return;

  const { generateComponentTokens } = await import("./components/tokens.js");
  const { generateComponentDoc, generateComponentIndex } = await import("./components/docs.js");
  const { generateInventorySection, patchBrandMd } = await import("./components/inventory.js");

  const contracts = new Map<string, import("../types/brand.js").ComponentContract>();

  // Load all contracts from disk
  await Promise.all(
    Object.entries(registry).map(async ([name, entry]) => {
      try {
        const contractPath = resolve(entry.contractPath);
        const raw = await readFile(contractPath, "utf-8");
        const contract = JSON.parse(raw) as import("../types/brand.js").ComponentContract;
        contracts.set(name, contract);
      } catch {
        // Contract file missing or invalid — skip
      }
    }),
  );

  const outputDir = config.output;
  const componentTokensDir = join(outputDir, "tokens", "components");
  const docsComponentsDir = join(outputDir, "components");

  await mkdir(componentTokensDir, { recursive: true });
  await mkdir(docsComponentsDir, { recursive: true });

  // Write component token files and docs for each contract
  await Promise.all(
    Array.from(contracts.entries()).map(async ([name, contract]) => {
      const tokenGroup = generateComponentTokens(contract);
      const tokenPath = join(componentTokensDir, `${name.toLowerCase()}.tokens.json`);
      await writeFile(tokenPath, JSON.stringify(tokenGroup, null, 2) + "\n");

      const doc = generateComponentDoc(contract);
      const docPath = join(docsComponentsDir, `${name}.md`);
      await writeFile(docPath, doc);
    }),
  );

  // Write components.md index
  const indexContent = generateComponentIndex(registry, contracts);
  await writeFile(join(outputDir, "components.md"), indexContent);

  // Update brand.md inventory section
  const brandMdPath = join(outputDir, "brand.md");
  try {
    const existing = await readFile(brandMdPath, "utf-8");
    const inventorySection = generateInventorySection(registry, contracts);
    const patched = patchBrandMd(existing, inventorySection);
    await writeFile(brandMdPath, patched);
  } catch {
    // brand.md not yet created — skip
  }
}

/** Minimal empty .pen file structure */
const EMPTY_PEN = JSON.stringify({ id: "root", type: "frame", children: [] });

/** Result of a brand push operation */
export interface BrandPushResult {
  /** Absolute path to the .pen file */
  penFile: string;
  /** True if the .pen file was created on this push (first-time setup) */
  created: boolean;
  /** Font families that were not found on this system — each entry is a user-facing hint string */
  fontWarnings: string[];
}

/**
 * `nib brand push` — sync tokens into a Pencil.dev .pen file.
 *
 * Resolves the .pen file path from: explicit `file` arg → config `penFile` → default.
 * Creates the file on disk if it doesn't exist yet.
 */
export async function brandPush(options: BrandPushOptions): Promise<BrandPushResult> {
  const config = await loadBrandConfig(options.config);
  const penFile = resolve(options.file ?? config.platforms.penFile);
  const pencilVarsPath = config.platforms.pencil;

  // Track whether this is a first-time creation
  const created = !existsSync(penFile);
  if (created) {
    await mkdir(dirname(penFile), { recursive: true });
    await writeFile(penFile, EMPTY_PEN);
  }

  const content = await readFile(pencilVarsPath, "utf-8");
  type PencilVarValue = string | number | Array<{ value: string | number; theme: Record<string, string> }>;
  const rawVariables = JSON.parse(content) as Record<string, { type: string; value: PencilVarValue }>;

  // Bridge variables are now included by buildPencilVariables() at build time,
  // but we run buildPencilStandardVariables() again to ensure they're present
  // even if the user has an older variables.json from before this fix.
  const { buildPencilStandardVariables } = await import("./pencil-bridge.js");
  const variables = buildPencilStandardVariables(rawVariables);

  // Check if brand fonts are installed — warn before Pencil silently falls back
  const { checkFontInstalled, extractFontFamiliesFromVars } = await import("./font-check.js");
  const fontFamilies = extractFontFamiliesFromVars(rawVariables);
  const fontWarnings: string[] = [];
  for (const family of fontFamilies) {
    const result = checkFontInstalled(family);
    if (!result.installed && result.hint) {
      fontWarnings.push(result.hint);
    }
  }

  // Use the MCP client to push variables
  const { discoverPencilMcp } = await import("../mcp/discover.js");
  const { withMcpClient } = await import("../mcp/client.js");

  // Use filePath directly — set_variables writes to disk without needing
  // openDocument. Calling openDocument first causes Pencil to re-read from
  // disk on any subsequent open, losing in-memory variable state.
  const mcpConfig = await discoverPencilMcp();
  await withMcpClient(mcpConfig, async (client) => {
    await client.callTool("set_variables", { filePath: penFile, variables });
  });

  return { penFile, created, fontWarnings };
}

/**
 * `nib brand style` — fetch a Pencil style guide and push tokens + standard mappings.
 *
 * With no tags/name: lists available tags.
 * With tags or name: fetches the style guide and pushes all variables.
 */
export async function brandStyle(options: BrandStyleOptions = {}): Promise<{
  tags?: unknown;
  styleGuide?: unknown;
  penFile?: string;
}> {
  const { discoverPencilMcp } = await import("../mcp/discover.js");
  const { withMcpClient } = await import("../mcp/client.js");

  const mcpConfig = await discoverPencilMcp();

  // Style guide tools are global — do NOT open a document first,
  // as the MCP server switches to editor mode and loses the style guide handlers.
  // Note: get_style_guide_tags requires get_guidelines to be called first.

  // If no tags and no name, just list available tags
  if (!options.tags?.length && !options.name) {
    const tags = await withMcpClient(mcpConfig, async (client) => {
      await client.callTool("get_guidelines", { topic: "web-app" });
      return await client.getStyleGuideTags();
    });
    return { tags };
  }

  // Fetch the style guide
  const styleGuide = await withMcpClient(mcpConfig, async (client) => {
    return await client.getStyleGuide({
      tags: options.tags,
      name: options.name,
    });
  });

  // Push tokens with standard mappings
  const { penFile } = await brandPush({
    file: options.file,
    config: options.config,
  });

  return { styleGuide, penFile };
}

/**
 * `nib brand audit` — check WCAG contrast compliance.
 */
export async function brandAudit(options: BrandAuditOptions = {}): Promise<WcagAuditReport> {
  const config = await loadBrandConfig(options.config);
  const tokensDir = config.tokens;

  const [primitives, semanticLight] = await Promise.all([
    readFile(join(tokensDir, "color", "primitives.tokens.json"), "utf-8").then(
      (c) => JSON.parse(c) as Record<string, unknown>,
    ),
    readFile(join(tokensDir, "color", "semantic-light.tokens.json"), "utf-8").then(
      (c) => JSON.parse(c) as Record<string, unknown>,
    ),
  ]);

  const report = auditTokens(semanticLight, primitives);

  await updateStatus({
    lastAudit: {
      timestamp: new Date().toISOString(),
      passed: report.passed,
      failed: report.failed,
    },
  });

  return report;
}
