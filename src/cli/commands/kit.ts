/**
 * `nib kit` — bootstrap a complete design system in one command.
 *
 * Runs in sequence:
 *   1. nib brand init   (skip if brand.config.json already exists and --skip-init not set)
 *   2. nib brand build  (generates CSS / Tailwind / Pencil outputs)
 *   3. Scaffold the base component kit: Button, TextInput, Dialog, Checkbox, Tabs, Switch
 *   4. Print a Pencil push reminder
 *
 * Matching Pencil's concept of a "kit" — a ready-to-use, opinionated starting point.
 */

import { defineCommand } from "citty";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import pc from "picocolors";
import type { AiProviderName, ComponentContract, ComponentStatus, WidgetType } from "../../types/brand.js";
import { writeResult } from "../output.js";
import { ExitCode } from "../exit-codes.js";

/**
 * The 12 base components every UI kit needs on day one.
 *
 * Primitives/inputs: Button, TextInput, Checkbox, Radio, Switch
 * Overlays:         Dialog, Tooltip
 * Selection:        Tabs, Combobox
 * Feedback:         Badge, Toast, Alert
 */
const KIT_COMPONENTS = [
  // Inputs
  "Button",
  "TextInput",
  "Checkbox",
  "Radio",
  "Switch",
  // Overlays & selection
  "Dialog",
  "Tooltip",
  "Tabs",
  "Combobox",
  // Feedback
  "Badge",
  "Toast",
  "Alert",
] as const;

type KitComponent = (typeof KIT_COMPONENTS)[number];

export const kitCommand = defineCommand({
  meta: {
    name: "kit",
    description:
      "Bootstrap a complete design system — tokens + base component kit + Pencil-ready outputs",
  },
  args: {
    from: {
      type: "string",
      description: "Brand brief: path to .md/.txt/.pdf file, or a URL",
    },
    ai: {
      type: "string",
      description: "AI provider: anthropic, openai, ollama (default: anthropic)",
    },
    output: {
      type: "string",
      alias: "o",
      description: "Output directory (default: docs/design/system)",
    },
    "no-ai": {
      type: "boolean",
      description: "Skip AI enhancement, use only algorithmic derivation",
      default: false,
    },
    "skip-init": {
      type: "boolean",
      description: "Skip brand init — use existing .nib/brand.config.json",
      default: false,
    },
    json: {
      type: "boolean",
      description: "Output result as JSON envelope (machine-readable). In --recipe mode, outputs the recipe JSON.",
      default: false,
    },
    recipe: {
      type: "boolean",
      description:
        "Return a Pencil scaffolding recipe (component token bindings + placement hints) instead of running the full bootstrap",
      default: false,
    },
    component: {
      type: "string",
      description: "With --recipe: comma-separated component names to include (default: all)",
    },
    config: {
      type: "string",
      description: "With --recipe: path to brand.config.json",
    },
  },
  async run({ args }) {
    // ── Recipe mode ────────────────────────────────────────────────────────
    if (args.recipe as boolean) {
      const componentArg = args.component as string | undefined;
      const components = componentArg
        ? componentArg.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
      const json = args.json as boolean;

      try {
        const { buildKitRecipe } = await import("../../brand/kit.js");
        const recipe = await buildKitRecipe({
          config: args.config as string | undefined,
          components,
        });

        if (json) {
          writeResult("kit recipe", recipe, { json: true });
          return;
        }

        console.log(pc.cyan("nib kit --recipe"), pc.dim(`— ${recipe.brandName}`));
        console.log();

        if (recipe.components.length === 0) {
          console.log(pc.yellow("No components found. Run nib component init first."));
          return;
        }

        console.log(pc.bold(`${recipe.components.length} component(s):`));
        console.log(pc.dim("─".repeat(60)));

        for (const comp of recipe.components) {
          const varCount = comp.tokenBindings.length;
          const resolved = comp.tokenBindings.filter((b) => b.resolvedValue).length;
          const p = comp.placement;
          const placement = `x=${p.x}, y=${p.y}, ${p.width}×${p.height}`;

          console.log(
            `  ${pc.bold(comp.name)} ${pc.dim(`(${comp.widgetType})`)}  ${pc.dim(placement)}`,
          );
          console.log(`    ${pc.dim("States:")} ${comp.states.join(", ")}`);
          console.log(`    ${pc.dim("Tokens:")} ${varCount} bindings (${resolved} resolved)`);

          if (resolved < varCount) {
            console.log(
              pc.yellow(
                `    ⚠ ${varCount - resolved} token(s) unresolved — run nib brand build first`,
              ),
            );
          }
        }

        console.log(pc.dim("─".repeat(60)));
        console.log();
        console.log(pc.dim("Use --json to get the full recipe for Pencil scaffolding."));
      } catch (err) {
        console.error(pc.red("✗"), err instanceof Error ? err.message : String(err));
        process.exitCode = ExitCode.ERROR;
      }
      return;
    }

    // ── Bootstrap mode (existing behaviour) ───────────────────────────────
    const from = args.from as string | undefined;
    const noAi = args["no-ai"] as boolean;
    const skipInit = args["skip-init"] as boolean;
    const outputDir = args.output as string | undefined;
    const aiProvider = args.ai as AiProviderName | undefined;
    const json = args.json as boolean;

    const configFile = resolve(".nib", "brand.config.json");
    const alreadyInitialized = existsSync(configFile);

    if (!json) {
      console.log();
      console.log(pc.bold("nib kit"), pc.dim("— bootstrapping your design system"));
      console.log();
    }

    // -------------------------------------------------------------------------
    // Step 1: Brand init
    // -------------------------------------------------------------------------
    const shouldInit = !skipInit && !alreadyInitialized;

    if (skipInit || alreadyInitialized) {
      if (!alreadyInitialized) {
        console.error(pc.red("✗"), "No .nib/brand.config.json found. Run without --skip-init or run nib brand init first.");
        process.exitCode = 1;
        return;
      }
      if (!json) console.log(pc.dim("  ─ Brand config found — skipping init"));
    } else {
      if (!json) console.log(pc.cyan("  1/3"), pc.bold("Brand init"));

      const { init } = await import("../../brand/index.js");
      let input;

      if (!from) {
        const { interactiveIntake } = await import("../../brand/intake/interactive.js");
        input = await interactiveIntake();
      } else if (from.startsWith("http://") || from.startsWith("https://")) {
        const { urlIntake } = await import("../../brand/intake/url.js");
        input = await urlIntake(from);
      } else if (from.endsWith(".pdf")) {
        const { pdfIntake } = await import("../../brand/intake/pdf.js");
        input = await pdfIntake(from);
      } else {
        const { markdownIntake } = await import("../../brand/intake/markdown.js");
        input = await markdownIntake(from);
      }

      const config = await init(input, { from, ai: aiProvider, output: outputDir, noAi });
      if (!json) {
        console.log(
          pc.green("  ✓"),
          `Brand system generated for ${pc.bold(config.brand.name)}`,
          pc.dim(`(${config.tokens})`),
        );
      }
    }

    // -------------------------------------------------------------------------
    // Step 2: Brand build
    // -------------------------------------------------------------------------
    if (!json) {
      console.log();
      console.log(pc.cyan("  2/3"), pc.bold("Brand build"));
    }

    const { brandBuild } = await import("../../brand/index.js");
    await brandBuild({});
    if (!json) console.log(pc.green("  ✓"), "Platform outputs generated", pc.dim("(CSS / Tailwind / Pencil)"));

    // -------------------------------------------------------------------------
    // Step 3: Scaffold base component kit
    // -------------------------------------------------------------------------
    if (!json) {
      console.log();
      console.log(pc.cyan("  3/3"), pc.bold("Component kit"));
    }

    const { scaffoldContract, detectWidgetType } = await import("../../brand/components/scaffold.js");
    const { generateComponentDoc } = await import("../../brand/components/docs.js");
    const { generateInventorySection, patchBrandMd } = await import("../../brand/components/inventory.js");

    // Determine paths from config
    let systemOutputDir = resolve("docs", "design", "system");
    if (existsSync(configFile)) {
      try {
        const raw = await readFile(configFile, "utf-8");
        const cfg = JSON.parse(raw) as { output?: string };
        if (cfg.output) systemOutputDir = resolve(cfg.output);
      } catch { /* use defaults */ }
    }

    const nibDir = resolve(".nib");
    const componentsDir = join(nibDir, "components");
    const docsComponentsDir = join(systemOutputDir, "components");
    const brandMdPath = join(systemOutputDir, "brand.md");
    const today = new Date().toISOString().split("T")[0]!;

    await mkdir(componentsDir, { recursive: true });
    await mkdir(docsComponentsDir, { recursive: true });

    const scaffolded: Array<{ name: KitComponent; contract: ComponentContract; widgetType: WidgetType }> = [];
    const skipped: KitComponent[] = [];

    for (const name of KIT_COMPONENTS) {
      const contractPath = join(componentsDir, `${name}.contract.json`);

      // Skip if already exists
      if (existsSync(contractPath)) {
        skipped.push(name);
        console.log(pc.dim(`     ─ ${name} already exists — skipping`));
        continue;
      }

      const widgetType = detectWidgetType(name);
      const contract = await scaffoldContract(name, { widgetType });

      // Write contract JSON
      await writeFile(contractPath, JSON.stringify(contract, null, 2) + "\n");

      // Write component Markdown doc
      const componentDoc = generateComponentDoc(contract);
      await writeFile(join(docsComponentsDir, `${name}.md`), componentDoc);

      scaffolded.push({ name, contract, widgetType });
      if (!json) {
        console.log(
          pc.green("     ✓"),
          pc.bold(name),
          pc.dim(`(${widgetType})`),
        );
      }
    }

    // Update brand.config.json registry with all newly scaffolded components
    if (scaffolded.length > 0 && existsSync(configFile)) {
      try {
        const raw = await readFile(configFile, "utf-8");
        const config = JSON.parse(raw) as {
          components?: Record<string, {
            contractPath: string;
            widgetType: WidgetType;
            status: string;
            addedAt: string;
          }>;
        };
        if (!config.components) config.components = {};
        for (const { name, widgetType } of scaffolded) {
          config.components[name] = {
            contractPath: `.nib/components/${name}.contract.json`,
            widgetType,
            status: "draft",
            addedAt: today,
          };
        }
        await writeFile(configFile, JSON.stringify(config, null, 2) + "\n");
      } catch { /* not fatal */ }
    }

    // Regenerate brand.md inventory with full registry
    if (existsSync(configFile)) {
      try {
        const raw = await readFile(configFile, "utf-8");
        const config = JSON.parse(raw) as {
          components?: Record<string, {
            contractPath: string;
            widgetType: WidgetType;
            status: ComponentStatus;
            addedAt: string;
          }>;
        };

        if (config.components) {
          const contractMap = new Map<string, ComponentContract>();
          for (const { name, contract } of scaffolded) {
            contractMap.set(name, contract);
          }

          const inventorySection = generateInventorySection(config.components, contractMap);
          if (existsSync(brandMdPath)) {
            const existing = await readFile(brandMdPath, "utf-8");
            await writeFile(brandMdPath, patchBrandMd(existing, inventorySection));
          } else {
            await mkdir(dirname(brandMdPath), { recursive: true });
            await writeFile(brandMdPath, inventorySection);
          }
        }
      } catch { /* not fatal */ }
    }

    // -------------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------------
    let penFile = "design.pen";
    if (existsSync(configFile)) {
      try {
        const raw = await readFile(configFile, "utf-8");
        const cfg = JSON.parse(raw) as { platforms?: { penFile?: string } };
        if (cfg.platforms?.penFile) penFile = cfg.platforms.penFile;
      } catch { /* use default */ }
    }

    if (json) {
      writeResult("kit", {
        outputDir: systemOutputDir,
        componentsDir,
        scaffolded: scaffolded.map((c) => ({ name: c.name, widgetType: c.widgetType })),
        skipped,
        penFile,
      }, { json: true });
      return;
    }

    console.log();
    console.log(pc.green("✓"), pc.bold("Kit ready"));
    console.log();

    if (scaffolded.length > 0) {
      console.log(pc.dim("  Components:"), scaffolded.map((c) => c.name).join(", "));
    }
    if (skipped.length > 0) {
      console.log(pc.dim("  Skipped (exist):"), skipped.join(", "));
    }

    console.log();
    console.log(pc.dim("  Outputs:"));
    console.log(pc.dim(`    ${systemOutputDir}/`));
    console.log(pc.dim(`    .nib/components/`));
    console.log();

    console.log(pc.bold("  → Sync to Pencil:"));
    console.log(pc.cyan(`     nib brand push --file ${penFile}`));
    console.log();

    const needsValidate = shouldInit || scaffolded.length > 0;
    if (needsValidate) {
      console.log(pc.dim("  → Run"), pc.cyan("nib brand validate"), pc.dim("to check for issues"));
    }
    console.log();
  },
});
