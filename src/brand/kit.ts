/**
 * Kit recipe builder — produces a structured recipe for Claude to scaffold
 * component frames in Pencil with brand variables already wired.
 *
 * READ-ONLY: this module never writes files or calls Pencil MCP.
 * The recipe is consumed by the nib_kit MCP tool (annotated readOnlyHint: true).
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import type { NibBrandConfig, ComponentContract } from "../types/brand.js";

/** Frame dimensions per widget type (px) */
const FRAME_SIZES: Record<string, { width: number; height: number }> = {
  button: { width: 120, height: 40 },
  textinput: { width: 240, height: 40 },
  checkbox: { width: 160, height: 24 },
  radio: { width: 160, height: 24 },
  switch: { width: 80, height: 28 },
  tabs: { width: 320, height: 40 },
  dialog: { width: 400, height: 300 },
  combobox: { width: 240, height: 40 },
  tooltip: { width: 200, height: 36 },
  badge: { width: 80, height: 24 },
  toast: { width: 320, height: 64 },
  alert: { width: 400, height: 80 },
  generic: { width: 240, height: 80 },
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
  /** Pencil expression to use in fill/stroke: {var.color-brand-600} */
  pencilExpr: string;
}

/** Placement hint for a single component frame. */
export interface KitPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
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
   * Step-by-step instruction for Claude to draw the kit using Pencil tools.
   * Include this verbatim in your plan before calling batch_design.
   */
  instruction: string;
}

/** Convert a DTCG token path to a Pencil variable name. */
function tokenToVarName(token: string): string {
  // "color.brand.600" → "color-brand-600"
  return token.replace(/\./g, "-");
}

/** Flatten pencil variables.json to a simple key → value map. */
function flattenPencilVars(
  raw: Record<string, { type: string; value: string | number }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = String(v.value);
  }
  return out;
}

/** Build the kit instruction text included in the recipe. */
function buildInstruction(components: KitComponent[]): string {
  const names = components.map((c) => c.name).join(", ");
  return [
    `You are about to scaffold ${components.length} component frame(s) in Pencil: ${names}.`,
    "",
    "## How to draw the kit",
    "",
    "1. For each component in the recipe:",
    "   a. Create a frame at the suggested placement (x, y, width, height) using batch_design.",
    "   b. Inside the frame, add child nodes matching the component anatomy parts.",
    "   c. Apply token bindings using Pencil variable expressions.",
    "      Example fill: { fill: '{var.color-brand-600}' }",
    "   d. After inserting each component, call snapshot_layout to check placement.",
    "      If any frames overlap, adjust the y offset and update.",
    "",
    "2. After all components are drawn, call get_screenshot to visually confirm.",
    "   - If a component looks wrong (wrong size, clipped, missing token colour), fix it in place",
    "     using batch_design Update operations before moving on.",
    "",
    "3. Token expressions:",
    "   - All variable names are listed in pencilVariables.",
    "   - Use the pencilExpr field from each tokenBinding directly in the node property.",
    "   - For text colour use the 'color' property; for backgrounds use 'fill'.",
    "",
    "4. States:",
    "   - Create one frame per component state (e.g. default, hover, disabled).",
    "   - Space states 16px apart horizontally within the parent frame.",
    "   - Label each state frame with the state name in a top-aligned text node.",
    "",
    "5. When done, report: component name, frame nodeId, placement, and any unresolved tokens.",
  ].join("\n");
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
      { type: string; value: string | number }
    >;
    return flattenPencilVars(raw);
  } catch {
    return {};
  }
}

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
        if (typeof tokenValue !== "string") continue;
        // Strip DTCG reference braces if present: {color.brand.600} → color.brand.600
        const token = tokenValue.replace(/^\{|\}$/g, "");
        const varName = tokenToVarName(token);
        if (seen.has(varName)) continue;
        seen.add(varName);
        const resolvedValue = pencilVars[varName] ?? "";
        tokenBindings.push({
          token,
          varName,
          resolvedValue,
          pencilExpr: `{var.${varName}}`,
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
  };
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

  const instruction = buildInstruction(components);

  return {
    brandName: config.brand.name,
    pencilVariables: pencilVars,
    components,
    instruction,
  };
}
