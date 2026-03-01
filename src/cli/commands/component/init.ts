/**
 * `nib component init <name>` — scaffold a component contract.
 *
 * 1. Detect widget type from name heuristic (or --widget-type flag)
 * 2. Scaffold complete ComponentContract with WAI-ARIA template
 * 3. Write .nib/components/<Name>.contract.json
 * 4. Generate docs/design/system/components/<Name>.md
 * 5. Update component registry in brand.config.json
 * 6. Regenerate brand.md component inventory section
 * 7. Print summary
 */

import { defineCommand } from "citty";
import pc from "picocolors";
import type { WidgetType } from "../../../types/brand.js";

const APG_URLS: Record<string, string> = {
  button: "https://www.w3.org/WAI/ARIA/apg/patterns/button/",
  textinput: "https://www.w3.org/WAI/ARIA/apg/patterns/textbox/",
  checkbox: "https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/",
  radio: "https://www.w3.org/WAI/ARIA/apg/patterns/radio/",
  switch: "https://www.w3.org/WAI/ARIA/apg/patterns/switch/",
  tabs: "https://www.w3.org/WAI/ARIA/apg/patterns/tabs/",
  dialog: "https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/",
  combobox: "https://www.w3.org/WAI/ARIA/apg/patterns/combobox/",
  tooltip: "https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/",
};

export const initComponentCommand = defineCommand({
  meta: {
    name: "init",
    description: "Scaffold a new component contract with WAI-ARIA keyboard patterns pre-filled",
  },
  args: {
    name: {
      type: "positional",
      description: "Component name (e.g. Button, Dialog, SearchInput)",
      required: true,
    },
    "widget-type": {
      type: "string",
      description:
        "Force widget type: button | textinput | checkbox | radio | switch | tabs | dialog | combobox | tooltip | generic",
    },
    variants: {
      type: "string",
      description: "Comma-separated variant names (e.g. primary,secondary,ghost)",
    },
    sizes: {
      type: "string",
      description: "Comma-separated size names (e.g. sm,md,lg)",
    },
    config: {
      type: "string",
      description: "Path to brand.config.json (default: .nib/brand.config.json)",
    },
  },
  async run({ args }) {
    const name = args.name as string;
    const widgetTypeArg = args["widget-type"] as WidgetType | undefined;
    const variantsArg = args.variants as string | undefined;
    const sizesArg = args.sizes as string | undefined;
    const configPath = args.config as string | undefined;

    const { mkdir, readFile, writeFile } = await import("node:fs/promises");
    const { existsSync } = await import("node:fs");
    const { resolve, join, dirname } = await import("node:path");

    const { scaffoldContract, detectWidgetType } = await import(
      "../../../brand/components/scaffold.js"
    );
    const { generateComponentDoc } = await import(
      "../../../brand/components/docs.js"
    );
    const { generateInventorySection, patchBrandMd } = await import(
      "../../../brand/components/inventory.js"
    );

    const variants = variantsArg ? variantsArg.split(",").map((v) => v.trim()) : undefined;
    const sizes = sizesArg ? sizesArg.split(",").map((s) => s.trim()) : undefined;

    // Detect or use provided widget type
    const widgetType = widgetTypeArg ?? detectWidgetType(name);

    // Scaffold the contract
    const contract = await scaffoldContract(name, {
      widgetType,
      variants,
      sizes,
    });

    // Determine paths
    const nibDir = resolve(".nib");
    const componentsDir = join(nibDir, "components");
    const contractPath = join(componentsDir, `${name}.contract.json`);

    // Try to load brand config (graceful if not present)
    const configFile = configPath ?? resolve(nibDir, "brand.config.json");
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

    if (existsSync(configFile)) {
      try {
        const raw = await readFile(configFile, "utf-8");
        const config = JSON.parse(raw) as {
          components?: Record<
            string,
            {
              contractPath: string;
              widgetType: WidgetType;
              status: string;
              addedAt: string;
            }
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
      // Create a minimal brand.md with just the inventory section
      await mkdir(dirname(brandMdPath), { recursive: true });
      await writeFile(brandMdPath, inventorySection);
    }

    // Print summary (matching PRD FR-3 output format)
    const apgUrl = APG_URLS[widgetType];
    const keyboardEntries = Object.entries(contract.a11y.keyboard);
    const keyboardStr =
      keyboardEntries.length > 0
        ? keyboardEntries.map(([k, v]) => `${k} \u2192 ${v}`).join(", ")
        : "none";
    const stateNames = Object.keys(contract.states).join(", ");

    console.log(pc.green("\u2713"), pc.bold(`nib component init ${name}`));
    console.log();
    console.log(pc.dim("   Created:"));
    console.log(pc.dim(`   \u251C\u2500 .nib/components/${name}.contract.json`));
    console.log(pc.dim(`   \u251C\u2500 docs/design/system/components/${name}.md`));
    console.log(pc.dim("   \u2514\u2500 brand.md  (component inventory updated)"));
    console.log();
    console.log(
      `   ${pc.bold("Widget type:")} ${widgetType}${apgUrl ? pc.dim(` (WAI-ARIA APG \u2014 ${apgUrl})`) : ""}`,
    );
    console.log(`   ${pc.bold("States:")} ${stateNames}`);
    console.log(`   ${pc.bold("Keyboard:")} ${keyboardStr}`);
    console.log();
    console.log(
      pc.dim(`   Next: review token bindings in ${name}.contract.json`),
    );
  },
});
