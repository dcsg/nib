/**
 * Kit recipe builder — produces a structured recipe for Claude to scaffold
 * component frames in Pencil with brand variables already wired.
 *
 * READ-ONLY: this module never writes files or calls Pencil MCP.
 * The recipe is consumed by the nib_kit MCP tool (annotated readOnlyHint: true).
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NibBrandConfig, ComponentContract } from "../types/brand.js";

/** Frame dimensions per widget type (px) */
const FRAME_SIZES: Record<string, { width: number; height: number }> = {
  button: { width: 160, height: 40 },
  textinput: { width: 280, height: 44 },
  checkbox: { width: 200, height: 32 },
  radio: { width: 200, height: 32 },
  switch: { width: 120, height: 32 },
  tabs: { width: 360, height: 44 },
  dialog: { width: 440, height: 320 },
  combobox: { width: 280, height: 44 },
  tooltip: { width: 220, height: 40 },
  badge: { width: 100, height: 28 },
  toast: { width: 360, height: 72 },
  alert: { width: 440, height: 88 },
  generic: { width: 280, height: 80 },
};

/** Row spacing between component frames (px) */
const ROW_SPACING = 40;

/** A single token binding resolved to its variable name and value. */
export interface KitTokenBinding {
  /** Design token path (e.g. "color.brand.600") */
  token: string;
  /** Pencil variable name (e.g. "color-brand-600") */
  varName: string;
  /** Resolved value (e.g. "#3b82f6") — empty if not found in variables.json */
  resolvedValue: string;
  /** Pencil variable reference used in batch_design ops (e.g. "$color-brand-600"). */
  pencilExpr: string;
}

/** Placement hint for a single component frame. */
export interface KitPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * What the agent must verify after executing batchDesignOps.
 * These are concrete checks — not suggestions.
 */
export interface KitVerification {
  /** Minimum number of child nodes expected inside the root frame */
  expectedChildCount: number;
  /** Pencil variable reference for the root frame fill (e.g. "$color-brand-600", "$--primary"). */
  primaryFillExpr?: string;
  /** Call get_screenshot and confirm each of these things visually */
  visualChecks: string[];
}

/** A single component in the kit recipe. */
export interface KitComponent {
  /** Component name (e.g. "Button") */
  name: string;
  /** WAI-ARIA widget type */
  widgetType: string;
  /** Anatomy part names */
  anatomy: string[];
  /** Interactive state names */
  states: string[];
  /**
   * Flat list of token bindings across all parts + states.
   * De-duplicated by varName.
   */
  tokenBindings: KitTokenBinding[];
  /** Suggested placement for the component frame on the canvas */
  placement: KitPlacement;
    /**
   * Ready-to-execute Pencil batch_design operations for the default state.
   * Pass this string directly to batch_design(filePath, operations).
   * "document" is the canvas root — valid without substitution.
   * Fill, stroke, and color values use Pencil variable references ($--primary, $color-brand-600, etc.).
   * Run nib_brand_push before executing these ops so variables are loaded in Pencil.
   */
  batchDesignOps: string;
    /**
   * What to verify after executing batchDesignOps.
   * Check all items before moving to the next component.
   */
  verification: KitVerification;
}

/** Foundation pages included in every kit recipe. */
export interface KitFoundations {
  /** How many color swatches will be created */
  colorCount: number;
  /** How many typography scale steps will be shown */
  typographySteps: number;
  /** Y position on canvas where foundations start (below all components) */
  startsAtY: number;
  /**
   * Ready-to-execute Pencil batch_design operations for all foundation pages.
   * Execute this in a separate batch_design call after all components are drawn.
   */
  batchDesignOps: string;
}

/** Full kit recipe returned by nib_kit. */
export interface KitRecipe {
  /** Brand name from brand.config.json */
  brandName: string;
  /** All available Pencil variable names → resolved values */
  pencilVariables: Record<string, string>;
  /** Requested components (or all if none specified) */
  components: KitComponent[];
  /**
   * Foundation pages — colors, typography, spacing.
   * Always included regardless of component filter.
   */
  foundations: KitFoundations;
  /**
   * Step-by-step instruction for Claude to draw the kit.
   * Follow this exactly — do not improvise.
   */
  instruction: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a DTCG token value (possibly wrapped in braces) to a Pencil variable reference ($varname). */
function tokenToRef(tokenValue: string): string {
  const token = tokenValue.replace(/^\{|\}$/g, "");
  return `$${token.replace(/\./g, "-")}`;
}

/** Convert a DTCG token path to a Pencil variable name. */
function tokenToVarName(token: string): string {
  return token.replace(/\./g, "-");
}

/** True if an anatomy part name suggests a text node rather than a frame. */
function isTextPart(part: string): boolean {
  return /^(label|text|title|caption|description|placeholder|helper.?text|value|content|heading)/i.test(part);
}

/** Pencil variable value — flat or themed (light/dark array). */
type PencilVarValue =
  | string
  | number
  | Array<{ value: string | number; theme: Record<string, string> }>;

/**
 * Flatten pencil variables.json to a simple key → value map.
 * For themed variables (light/dark arrays), uses the first (light-mode) value.
 */
function flattenPencilVars(
  raw: Record<string, { type: string; value: PencilVarValue }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (Array.isArray(v.value)) {
      const first = v.value[0];
      if (first) out[k] = String(first.value);
    } else {
      out[k] = String(v.value);
    }
  }
  return out;
}

/** Return a token value only if it is a plain string reference. */
function tokenString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}


/**
 * Generate batch_design operation strings for a component's default state.
 * Fills, strokes, and colors use Pencil variable references ($--primary, $color-brand-600, etc.).
 * Requires nib_brand_push to be run first so variables are loaded in Pencil.
 * Stroke uses the Pencil object format: {align: "inside", fill: "$varname", thickness: 1}.
 */
function buildComponentOps(
  name: string,
  contract: ComponentContract,
  placement: KitPlacement,
  _pencilVars: Record<string, string>,
): string {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const { widgetType } = contract;
  const frameSize = FRAME_SIZES[widgetType] ?? FRAME_SIZES["generic"]!;
  const lines: string[] = [];

  // Root frame
  const rootTokens = contract.tokens["root"]?.["default"] ?? {};
  const rootFill = tokenString(rootTokens["fill"]) ?? tokenString(rootTokens["background"]) ?? tokenString(rootTokens["backgroundColor"]);
  const rootBorder = tokenString(rootTokens["border"]) ?? tokenString(rootTokens["borderColor"]) ?? tokenString(rootTokens["stroke"]);

  const rootAttrs: string[] = [
    `type: "frame"`,
    `name: "${name} / Default"`,
    `x: ${placement.x}`,
    `y: ${placement.y}`,
    `width: ${frameSize.width}`,
    `height: ${frameSize.height}`,
    `layout: "horizontal"`,
    `gap: 8`,
    `padding: 10`,
    `cornerRadius: [6,6,6,6]`,
  ];
  if (rootFill) rootAttrs.push(`fill: "${tokenToRef(rootFill)}"`);
  // Stroke: Pencil requires an object — {align, fill, thickness} — not a bare hex string.
  const strokeRef = rootBorder ? tokenToRef(rootBorder) : "$--border";
  rootAttrs.push(`stroke: {align: "inside", fill: "${strokeRef}", thickness: 1}`);

  lines.push(`${id}_root=I(document, {${rootAttrs.join(", ")}})`);

  // Anatomy children (non-root parts)
  for (const part of Object.keys(contract.anatomy).filter(p => p !== "root")) {
    const partId = `${id}_${part.replace(/[^a-z0-9]+/g, "_")}`;
    const partTokens = contract.tokens[part]?.["default"] ?? {};

    if (isTextPart(part)) {
      const colorToken = tokenString(partTokens["color"]) ?? tokenString(partTokens["textColor"]);
      const textAttrs: string[] = [
        `type: "text"`,
        `name: "${part}"`,
        `content: "${name}"`,
        `fontSize: 14`,
        `fontWeight: "500"`,
      ];
      if (colorToken) textAttrs.push(`color: "${tokenToRef(colorToken)}"`);
      lines.push(`${partId}=I(${id}_root, {${textAttrs.join(", ")}})`);
    } else {
      const partFill = tokenString(partTokens["fill"]) ?? tokenString(partTokens["background"]);
      const partAttrs: string[] = [`type: "frame"`, `name: "${part}"`];
      if (partFill) partAttrs.push(`fill: "${tokenToRef(partFill)}"`);
      lines.push(`${partId}=I(${id}_root, {${partAttrs.join(", ")}})`);
    }
  }

  return lines.join("\n");
}

/** Build the verification checklist for a component. */
function buildVerification(
  name: string,
  contract: ComponentContract,
  _pencilVars: Record<string, string>,
): KitVerification {
  const rootTokens = contract.tokens["root"]?.["default"] ?? {};
  const rootFillToken = tokenString(rootTokens["fill"]) ?? tokenString(rootTokens["background"]);
  const primaryFillExpr = rootFillToken ? tokenToRef(rootFillToken) : undefined;

  const nonRootParts = Object.keys(contract.anatomy).filter(p => p !== "root");
  const visualChecks: string[] = [
    `Frame named "${name} / Default" exists at x=80`,
  ];

  if (primaryFillExpr) {
    visualChecks.push(`Root fill uses variable ${primaryFillExpr} — verify the brand color is visible (not black)`);
  }

  for (const part of nonRootParts) {
    const partTokens = contract.tokens[part]?.["default"] ?? {};
    const colorToken = tokenString(partTokens["color"]) ?? tokenString(partTokens["textColor"]);
    if (colorToken) {
      visualChecks.push(`"${part}" uses color ${tokenToRef(colorToken)} — verify visually`);
    }
  }

  visualChecks.push(`All fills use Pencil variable references ($--primary, $color-brand-600, etc.) — if any appear black, run nib_brand_push first`);

  return {
    expectedChildCount: nonRootParts.length,
    primaryFillExpr,
    visualChecks,
  };
}

// ── Foundation pages ──────────────────────────────────────────────────────────

/** Group pencil variable entries by semantic category. */
function groupVarsByCategory(pencilVars: Record<string, string>): {
  backgrounds: [string, string][];
  texts: [string, string][];
  interactives: [string, string][];
  feedbacks: [string, string][];
  borders: [string, string][];
} {
  const norm = (k: string) => k.replace(/^\$--/, "").replace(/^--/, "").replace(/^color-/, "");
  const entries = Object.entries(pencilVars).filter(([, v]) => /^#[0-9a-fA-F]{3,8}$/.test(v));

  return {
    backgrounds: entries.filter(([k]) => /^background/.test(norm(k))),
    texts: entries.filter(([k]) => /^(text|foreground)/.test(norm(k))),
    interactives: entries.filter(([k]) => /^interactive/.test(norm(k))),
    feedbacks: entries.filter(([k]) => /^(error|warning|success|info|feedback)/.test(norm(k))),
    borders: entries.filter(([k]) => /^border/.test(norm(k))),
  };
}

/** Resolve a usable text hex color for section headings. */
function headingColorHex(pencilVars: Record<string, string>): string {
  const key = Object.keys(pencilVars).find(k => /(\$--|^--)?(text-?primary|foreground)$/.test(k));
  return (key ? pencilVars[key] : undefined) ?? "#1a1a1a";
}

/** Resolve a usable background hex color for section backgrounds. */
function bgColorHex(pencilVars: Record<string, string>): string {
  const key = Object.keys(pencilVars).find(k => /^(\$--|--)?background$/.test(k));
  return (key ? pencilVars[key] : undefined) ?? "#f5f5f5";
}

/**
 * Build foundation page operations — color swatches, typography specimen, spacing scale.
 * Returns batch_design operation strings ready to execute.
 */
function buildFoundationsOps(
  brandName: string,
  pencilVars: Record<string, string>,
  startsAtY: number,
): { ops: string; foundations: KitFoundations } {
  const lines: string[] = [];
  const CANVAS_X = 80;
  const SWATCH_SIZE = 64;
  const SWATCH_GAP = 12;
  const ROW_HEIGHT = SWATCH_SIZE + 28; // swatch + label
  const SECTION_PADDING = 24;
  const SECTION_TITLE_HEIGHT = 40;
  const SECTION_GAP = 48;
  const headingColor = headingColorHex(pencilVars);

  let y = startsAtY;
  const groups = groupVarsByCategory(pencilVars);

  // ── Color palette page ─────────────────────────────────────────────────────

  const colorGroups: [string, [string, string][]][] = [
    ["Backgrounds", groups.backgrounds],
    ["Text", groups.texts],
    ["Interactive", groups.interactives],
    ["Feedback", groups.feedbacks],
    ["Borders", groups.borders],
  ].filter(([, entries]) => (entries as [string, string][]).length > 0) as [string, [string, string][]][];

  const totalSwatches = colorGroups.reduce((sum, [, e]) => sum + e.length, 0);

  if (colorGroups.length > 0) {
    // Section title
    lines.push(
      `color_page_title=I(document, {type: "text", name: "Color Palette", content: "Color Palette", x: ${CANVAS_X}, y: ${y}, fontSize: 28, fontWeight: "700", color: "${headingColor}"})`,
    );
    y += SECTION_TITLE_HEIGHT + 8;

    for (const [groupName, entries] of colorGroups) {
      const groupId = groupName.toLowerCase().replace(/\s+/g, "_");
      const rowWidth = entries.length * (SWATCH_SIZE + SWATCH_GAP) - SWATCH_GAP + SECTION_PADDING * 2;

      lines.push(
        `color_group_${groupId}=I(document, {type: "frame", name: "Colors / ${groupName}", x: ${CANVAS_X}, y: ${y}, width: ${rowWidth}, height: ${ROW_HEIGHT + SECTION_TITLE_HEIGHT + SECTION_PADDING * 2}, layout: "vertical", gap: 8, padding: ${SECTION_PADDING}, cornerRadius: [8,8,8,8], fill: "${bgColorHex(pencilVars)}"})`,
      );
      lines.push(
        `color_group_${groupId}_label=I(color_group_${groupId}, {type: "text", name: "group-label", content: "${groupName}", fontSize: 12, fontWeight: "600", color: "${headingColor}"})`,
      );
      lines.push(
        `color_swatches_${groupId}=I(color_group_${groupId}, {type: "frame", name: "swatches", layout: "horizontal", gap: ${SWATCH_GAP}})`,
      );

      for (let i = 0; i < entries.length; i++) {
        const [varKey, hexValue] = entries[i]!;
        const swatchId = `swatch_${groupId}_${i}`;
        const displayName = varKey.replace(/^\$--/, "").replace(/^--/, "");

        lines.push(
          `${swatchId}=I(color_swatches_${groupId}, {type: "frame", name: "${displayName}", width: ${SWATCH_SIZE}, layout: "vertical", gap: 4})`,
        );
        lines.push(
          `${swatchId}_color=I(${swatchId}, {type: "frame", name: "color", width: ${SWATCH_SIZE}, height: ${SWATCH_SIZE}, cornerRadius: [6,6,6,6], fill: "${hexValue}"})`,
        );
        lines.push(
          `${swatchId}_hex=I(${swatchId}, {type: "text", name: "hex", content: "${hexValue}", fontSize: 10, color: "${headingColor}"})`,
        );
      }

      y += ROW_HEIGHT + SECTION_TITLE_HEIGHT + SECTION_PADDING * 2 + SECTION_GAP;
    }
  }

  y += SECTION_GAP;

  // ── Typography specimen ────────────────────────────────────────────────────

  const typeSteps: { label: string; fontSize: number; fontWeight: string; content: string }[] = [
    { label: "Display", fontSize: 48, fontWeight: "700", content: "Display Heading" },
    { label: "H1", fontSize: 36, fontWeight: "700", content: "Heading 1" },
    { label: "H2", fontSize: 28, fontWeight: "600", content: "Heading 2" },
    { label: "H3", fontSize: 22, fontWeight: "600", content: "Heading 3" },
    { label: "H4", fontSize: 18, fontWeight: "600", content: "Heading 4" },
    { label: "Body Large", fontSize: 16, fontWeight: "400", content: "Body text, large. Use for introductory paragraphs." },
    { label: "Body", fontSize: 14, fontWeight: "400", content: "Body text, default. Use for most UI text content." },
    { label: "Caption", fontSize: 12, fontWeight: "400", content: "Caption or helper text, smaller labels." },
    { label: "Code", fontSize: 13, fontWeight: "400", content: "const token = '{var.color-brand-600}';" },
  ];

  lines.push(
    `type_page_title=I(document, {type: "text", name: "Typography Scale", content: "Typography Scale", x: ${CANVAS_X}, y: ${y}, fontSize: 28, fontWeight: "700", color: "${headingColor}"})`,
  );
  y += SECTION_TITLE_HEIGHT + 8;

  lines.push(
    `type_section=I(document, {type: "frame", name: "Typography / Specimen", x: ${CANVAS_X}, y: ${y}, width: 700, layout: "vertical", gap: 12, padding: ${SECTION_PADDING}, cornerRadius: [8,8,8,8], fill: "${bgColorHex(pencilVars)}"})`,
  );

  for (const step of typeSteps) {
    const stepId = `type_${step.label.toLowerCase().replace(/\s+/g, "_")}`;
    lines.push(
      `${stepId}_row=I(type_section, {type: "frame", name: "${step.label}", layout: "horizontal", gap: 16, width: "fill_container"})`,
    );
    lines.push(
      `${stepId}_meta=I(${stepId}_row, {type: "text", name: "meta", content: "${step.label} / ${step.fontSize}px", fontSize: 11, fontWeight: "500", color: "${headingColor}", width: 100})`,
    );
    lines.push(
      `${stepId}_text=I(${stepId}_row, {type: "text", name: "specimen", content: "${step.content}", fontSize: ${step.fontSize}, fontWeight: "${step.fontWeight}", color: "${headingColor}"})`,
    );
  }

  y += typeSteps.length * 60 + SECTION_PADDING * 2 + SECTION_GAP * 2;

  // ── Spacing scale ──────────────────────────────────────────────────────────

  const spacingSteps = [2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128];

  lines.push(
    `spacing_page_title=I(document, {type: "text", name: "Spacing Scale", content: "Spacing Scale", x: ${CANVAS_X}, y: ${y}, fontSize: 28, fontWeight: "700", color: "${headingColor}"})`,
  );
  y += SECTION_TITLE_HEIGHT + 8;

  lines.push(
    `spacing_section=I(document, {type: "frame", name: "Spacing / Scale", x: ${CANVAS_X}, y: ${y}, width: 700, layout: "vertical", gap: 8, padding: ${SECTION_PADDING}, cornerRadius: [8,8,8,8], fill: "${bgColorHex(pencilVars)}"})`,
  );

  for (const step of spacingSteps) {
    const stepId = `spacing_${step}`;
    // Find matching spacing variable if it exists
    const spacingVarKey = Object.keys(pencilVars).find(k =>
      new RegExp(`spacing[.-]?0?${step}$|space[.-]?0?${step}$`).test(k.replace(/^\$--/, ""))
    );
    const barFill = spacingVarKey
      ? (pencilVars[spacingVarKey] ?? "#3b82f6")
      : (groups.interactives[0] ? groups.interactives[0][1] : "#3b82f6");

    lines.push(
      `${stepId}_row=I(spacing_section, {type: "frame", name: "${step}px", layout: "horizontal", gap: 12, width: "fill_container"})`,
    );
    lines.push(
      `${stepId}_label=I(${stepId}_row, {type: "text", name: "label", content: "${step}px", fontSize: 12, fontWeight: "500", color: "${headingColor}", width: 48})`,
    );
    lines.push(
      `${stepId}_bar=I(${stepId}_row, {type: "frame", name: "bar", width: ${step * 2}, height: 20, cornerRadius: [4,4,4,4], fill: "${barFill}"})`,
    );
  }

  const ops = lines.join("\n");

  return {
    ops,
    foundations: {
      colorCount: totalSwatches,
      typographySteps: typeSteps.length,
      startsAtY,
      batchDesignOps: ops,
    },
  };
}

// ── Instruction ───────────────────────────────────────────────────────────────

/** Build the directive instruction text for the agent. */
function buildInstruction(components: KitComponent[]): string {
  return [
    `## Drawing the ${components.length} component(s) + foundation pages`,
    "",
    "PREREQUISITE: nib_brand_push must be run before executing these ops.",
    "Fills and strokes use Pencil variable references ($--primary, $color-brand-600, etc.).",
    "Without brand variables loaded, all fills will render as black.",
    "",
    "STEP 1 — Components (execute one at a time, verify before continuing):",
    "For each component in the recipe:",
    "  a. Call batch_design(filePath, component.batchDesignOps) — use the operations VERBATIM.",
    "     DO NOT rewrite them. Fill and stroke values use Pencil variable references.",
    "  b. Call snapshot_layout — confirm the frame is placed correctly with no clipping.",
    "  c. Call get_screenshot(nodeId) on the frame — check every item in component.verification.visualChecks.",
    "  d. If fills appear black, brand variables are not loaded — run nib_brand_push first.",
    "     Use batch_design Update operations to fix any layout or visibility issues.",
    "",
    "STEP 2 — Foundation pages (after all components):",
    "  Call batch_design(filePath, foundations.batchDesignOps) to create the color palette,",
    "  typography specimen, and spacing scale pages below the components.",
    "  Then call get_screenshot to visually verify the foundations page looks correct.",
    "",
    "STEP 3 — Final report:",
    "  Report: component names, frame nodeIds, any unresolved variable references or visual issues.",
    "  If any fill appears black instead of a colour, report it — variables may not be loaded.",
  ].join("\n");
}

// ── Core builder ──────────────────────────────────────────────────────────────

/** Build a KitComponent from a contract and resolved variables. */
function buildKitComponent(
  name: string,
  contract: ComponentContract,
  pencilVars: Record<string, string>,
  index: number,
): KitComponent {
  const widgetType = contract.widgetType;
  const frameSize = FRAME_SIZES[widgetType] ?? FRAME_SIZES["generic"]!;

  const placement: KitPlacement = {
    x: 80,
    y: 80 + index * (frameSize.height + ROW_SPACING),
    width: frameSize.width,
    height: frameSize.height,
  };

  const anatomy = Object.keys(contract.anatomy);
  const states = Object.keys(contract.states);

  // Collect all token bindings, de-duplicated by varName
  const seen = new Set<string>();
  const tokenBindings: KitTokenBinding[] = [];

  for (const [, partTokens] of Object.entries(contract.tokens)) {
    for (const [, stateTokens] of Object.entries(partTokens)) {
      for (const [, tokenValue] of Object.entries(stateTokens)) {
        const strValue = tokenString(tokenValue);
        if (!strValue) continue;
        const token = strValue.replace(/^\{|\}$/g, "");
        const varName = tokenToVarName(token);
        if (seen.has(varName)) continue;
        seen.add(varName);
        const resolvedValue = pencilVars[varName] ?? "";
        tokenBindings.push({
          token,
          varName,
          resolvedValue,
          pencilExpr: `$${varName}`,
        });
      }
    }
  }

  return {
    name,
    widgetType,
    anatomy,
    states,
    tokenBindings,
    placement,
    batchDesignOps: buildComponentOps(name, contract, placement, pencilVars),
    verification: buildVerification(name, contract, pencilVars),
  };
}

/** Load and flatten pencil variables from the platform output path. */
async function loadPencilVars(
  config: NibBrandConfig,
): Promise<Record<string, string>> {
  const pencilPath = config.platforms.pencil;
  if (!existsSync(pencilPath)) {
    return {};
  }
  try {
    const raw = JSON.parse(await readFile(pencilPath, "utf-8")) as Record<
      string,
      { type: string; value: PencilVarValue }
    >;
    return flattenPencilVars(raw);
  } catch {
    return {};
  }
}

/** Options for buildKitRecipe */
export interface BuildKitRecipeOptions {
  /** Path to brand.config.json (default: .nib/brand.config.json) */
  config?: string;
  /** Filter to specific component names (default: all) */
  components?: string[];
}

/**
 * Build a kit recipe for Claude to scaffold component frames in Pencil.
 *
 * Returns structured data (READ-ONLY — no files written, no MCP calls).
 */
export async function buildKitRecipe(
  options: BuildKitRecipeOptions = {},
): Promise<KitRecipe> {
  const configPath = options.config ?? resolve(".nib", "brand.config.json");

  if (!existsSync(configPath)) {
    throw new Error(
      `No brand.config.json found at ${configPath}. Run nib_brand_init first.`,
    );
  }

  const { loadBrandConfig } = await import("./index.js");
  const config = await loadBrandConfig(options.config);

  const pencilVars = await loadPencilVars(config);

  const registry = config.components ?? {};
  const allNames = Object.keys(registry);
  const requestedNames =
    options.components?.length
      ? options.components.filter((n) => allNames.includes(n))
      : allNames;

  if (options.components?.length && requestedNames.length === 0) {
    const unknown = options.components.filter((n) => !allNames.includes(n));
    throw new Error(
      `Component(s) not found in registry: ${unknown.join(", ")}. Available: ${allNames.join(", ") || "(none)"}`,
    );
  }

  // Load contracts in parallel
  const contractEntries = await Promise.all(
    requestedNames.map(async (name) => {
      const entry = registry[name]!;
      const contractPath = resolve(entry.contractPath);
      try {
        const raw = await readFile(contractPath, "utf-8");
        const contract = JSON.parse(raw) as ComponentContract;
        return { name, contract };
      } catch {
        return { name, contract: null };
      }
    }),
  );

  const components: KitComponent[] = contractEntries
    .filter((e): e is { name: string; contract: ComponentContract } => e.contract !== null)
    .map(({ name, contract }, index) =>
      buildKitComponent(name, contract, pencilVars, index),
    );

  if (components.length === 0) {
    const brandName = config.brand.name;
    const noComponents = allNames.length === 0;
    throw new Error(
      noComponents
        ? `No components in registry for brand "${brandName}". Run nib_component_init first.`
        : `Could not load contract files for the requested components.`,
    );
  }

  // Foundation pages start below all components
  const lastComponent = components[components.length - 1]!;
  const lastFrameSize = FRAME_SIZES[lastComponent.widgetType] ?? FRAME_SIZES["generic"]!;
  const foundationsStartY = lastComponent.placement.y + lastFrameSize.height + 120;

  const { ops: foundationsOps, foundations } = buildFoundationsOps(
    config.brand.name,
    pencilVars,
    foundationsStartY,
  );
  // Attach batchDesignOps to the returned foundations object
  const foundationsWithOps: KitFoundations = { ...foundations, batchDesignOps: foundationsOps };

  const instruction = buildInstruction(components);

  return {
    brandName: config.brand.name,
    pencilVariables: pencilVars,
    components,
    foundations: foundationsWithOps,
    instruction,
  };
}
