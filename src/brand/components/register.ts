/**
 * Component registration — extracted from CLI so MCP can reuse it.
 *
 * Writes the contract file, component doc, updates brand.config.json
 * registry, and patches brand.md inventory section.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { ComponentContract, WidgetType } from "../../types/brand.js";
import { generateComponentDoc } from "./docs.js";
import { generateInventorySection, patchBrandMd } from "./inventory.js";

export interface RegisterComponentOptions {
  /** Path to brand.config.json (default: .nib/brand.config.json) */
  config?: string;
}

export interface RegisterComponentResult {
  contractPath: string;
  docPath: string;
  widgetType: WidgetType;
}

/**
 * Register a component: write contract, docs, update registry & brand.md.
 *
 * Pure file I/O — no console output. CLI and MCP both call this.
 */
export async function registerComponent(
  name: string,
  contract: ComponentContract,
  options: RegisterComponentOptions = {},
): Promise<RegisterComponentResult> {
  const nibDir = resolve(".nib");
  const componentsDir = join(nibDir, "components");
  const contractPath = join(componentsDir, `${name}.contract.json`);

  const configFile = options.config ?? resolve(nibDir, "brand.config.json");
  let outputDir = resolve("docs", "design", "system");
  let brandMdPath = join(outputDir, "brand.md");

  if (existsSync(configFile)) {
    try {
      const raw = await readFile(configFile, "utf-8");
      const config = JSON.parse(raw) as { output?: string };
      if (config.output) {
        outputDir = resolve(config.output);
        brandMdPath = join(outputDir, "brand.md");
      }
    } catch {
      // Continue with defaults
    }
  }

  const docsComponentsDir = join(outputDir, "components");
  const componentDocPath = join(docsComponentsDir, `${name}.md`);

  // Write contract JSON
  await mkdir(componentsDir, { recursive: true });
  await writeFile(contractPath, JSON.stringify(contract, null, 2) + "\n");

  // Generate and write component Markdown doc
  await mkdir(docsComponentsDir, { recursive: true });
  const componentDoc = generateComponentDoc(contract);
  await writeFile(componentDocPath, componentDoc);

  // Update brand.config.json registry
  const relativeContractPath = `.nib/components/${name}.contract.json`;
  const today = new Date().toISOString().split("T")[0]!;
  const widgetType = contract.widgetType;

  if (existsSync(configFile)) {
    try {
      const raw = await readFile(configFile, "utf-8");
      const config = JSON.parse(raw) as {
        components?: Record<
          string,
          { contractPath: string; widgetType: WidgetType; status: string; addedAt: string }
        >;
      };
      if (!config.components) config.components = {};
      config.components[name] = {
        contractPath: relativeContractPath,
        widgetType,
        status: "draft",
        addedAt: today,
      };
      await writeFile(configFile, JSON.stringify(config, null, 2) + "\n");
    } catch {
      // Config update failed — not fatal
    }
  }

  // Regenerate brand.md component inventory section
  const registry: Record<
    string,
    { contractPath: string; widgetType: WidgetType; status: string; addedAt: string }
  > = {};
  registry[name] = {
    contractPath: relativeContractPath,
    widgetType,
    status: "draft",
    addedAt: today,
  };

  // Try to load full registry from config
  if (existsSync(configFile)) {
    try {
      const raw = await readFile(configFile, "utf-8");
      const config = JSON.parse(raw) as {
        components?: Record<
          string,
          { contractPath: string; widgetType: WidgetType; status: string; addedAt: string }
        >;
      };
      if (config.components) Object.assign(registry, config.components);
    } catch {
      // Use minimal registry
    }
  }

  const contractMap = new Map([[name, contract]]);
  const inventorySection = generateInventorySection(
    registry as Parameters<typeof generateInventorySection>[0],
    contractMap,
  );

  if (existsSync(brandMdPath)) {
    try {
      const existing = await readFile(brandMdPath, "utf-8");
      const patched = patchBrandMd(existing, inventorySection);
      await writeFile(brandMdPath, patched);
    } catch {
      // brand.md update failed — not fatal
    }
  } else {
    await mkdir(dirname(brandMdPath), { recursive: true });
    await writeFile(brandMdPath, inventorySection);
  }

  return { contractPath, docPath: componentDocPath, widgetType };
}
