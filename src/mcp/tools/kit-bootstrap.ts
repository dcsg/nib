/**
 * MCP tool: nib_kit_bootstrap
 *
 * Scaffolds the standard 12-component kit with WAI-ARIA contracts and token
 * bindings, registers all components in brand.config.json, and returns a
 * Pencil scaffolding recipe ready to pass to batch_design.
 *
 * Idempotent — skips components that already exist. Call after
 * nib_brand_init + nib_brand_build.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ComponentContract, ComponentStatus, WidgetType } from "../../types/brand.js";

const KIT_COMPONENTS = [
  "Button",
  "TextInput",
  "Checkbox",
  "Radio",
  "Switch",
  "Dialog",
  "Tooltip",
  "Tabs",
  "Combobox",
  "Badge",
  "Toast",
  "Alert",
] as const;

type KitComponent = (typeof KIT_COMPONENTS)[number];

function errorResult(message: string) {
  return { isError: true as const, content: [{ type: "text" as const, text: message }] };
}

export function registerKitBootstrapTool(server: McpServer): void {
  server.registerTool(
    "nib_kit_bootstrap",
    {
      description:
        "Scaffold the standard 12-component kit (Button, TextInput, Checkbox, Radio, Switch, " +
        "Dialog, Tooltip, Tabs, Combobox, Badge, Toast, Alert) with WAI-ARIA contracts and " +
        "token bindings. Writes contract JSON and component docs, registers all components in " +
        "brand.config.json, patches brand.md inventory, and returns a Pencil scaffolding recipe. " +
        "Idempotent — skips components that already exist. " +
        "Call this after nib_brand_init + nib_brand_build. " +
        "IMPORTANT: component ops produce ONE generic variant per component with English placeholder " +
        "content (e.g. 'Default', 'Label'). They are a starting scaffold for developer handoff / " +
        "design system docs — NOT for stakeholder review or product flows. " +
        "For stakeholder-ready output with real copy and multiple variants, skip components[].batchDesignOps " +
        "and design components directly in Pencil via batch_design (see ADR-009). " +
        "The foundations ops (color palette, type scale, spacing scale) are always worth running — " +
        "they are saved to .nib/kit-foundations.ops and drawn with a separate batch_design call.",
      inputSchema: {
        config: z
          .string()
          .optional()
          .describe("Path to brand.config.json (default: .nib/brand.config.json)"),
        components: z
          .array(z.string())
          .optional()
          .describe(
            "Subset of component names to scaffold (default: all 12 standard components). " +
            "Valid names: Button, TextInput, Checkbox, Radio, Switch, Dialog, Tooltip, Tabs, Combobox, Badge, Toast, Alert.",
          ),
      },
      annotations: {
        title: "Bootstrap Component Kit",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ config: configPath, components: requestedComponents }) => {
      try {
        const { existsSync } = await import("node:fs");
        const { mkdir, readFile, writeFile } = await import("node:fs/promises");
        const { join, resolve, dirname } = await import("node:path");
        const { loadBrandConfig } = await import("../../brand/index.js");
        const { scaffoldContract, detectWidgetType } = await import("../../brand/components/scaffold.js");
        const { generateComponentDoc } = await import("../../brand/components/docs.js");
        const { generateInventorySection, patchBrandMd } = await import("../../brand/components/inventory.js");
        const { buildKitRecipe } = await import("../../brand/kit.js");

        const brandConfig = await loadBrandConfig(configPath);
        const resolvedConfigFile = resolve(configPath ?? join(".nib", "brand.config.json"));
        // Derive nibDir from the config file's location (not CWD) so MCP tools
        // work correctly when the brand project is outside the server's CWD.
        const nibDir = dirname(resolvedConfigFile);
        const componentsDir = join(nibDir, "components");
        const systemOutputDir = brandConfig.output ?? resolve(join("docs", "design", "system"));
        const docsComponentsDir = join(systemOutputDir, "components");
        const brandMdPath = join(systemOutputDir, "brand.md");
        const today = new Date().toISOString().split("T")[0]!;

        await mkdir(componentsDir, { recursive: true });
        await mkdir(docsComponentsDir, { recursive: true });

        // Determine which components to scaffold
        const toScaffold: KitComponent[] = requestedComponents
          ? KIT_COMPONENTS.filter((n) => requestedComponents.includes(n))
          : [...KIT_COMPONENTS];

        if (toScaffold.length === 0) {
          return errorResult(
            `None of the requested components are in the standard kit. ` +
            `Valid names: ${KIT_COMPONENTS.join(", ")}`,
          );
        }

        const scaffolded: string[] = [];
        const skipped: string[] = [];
        const contractMap = new Map<string, ComponentContract>();

        for (const name of toScaffold) {
          const contractPath = join(componentsDir, `${name}.contract.json`);
          const widgetType = detectWidgetType(name); // needed in both branches

          if (existsSync(contractPath)) {
            skipped.push(name);
            // Load existing contract for inventory generation
            try {
              const raw = await readFile(contractPath, "utf-8");
              contractMap.set(name, JSON.parse(raw) as ComponentContract);
            } catch { /* not fatal */ }
            // Re-register in config if missing (handles fresh brand init with stale contracts)
            if (!brandConfig.components) brandConfig.components = {};
            if (!brandConfig.components[name]) {
              brandConfig.components[name] = {
                contractPath: join(componentsDir, `${name}.contract.json`),
                widgetType,
                status: "draft" as ComponentStatus,
                addedAt: today,
              };
            }
            continue;
          }

          const contract = await scaffoldContract(name, { widgetType });

          await writeFile(contractPath, JSON.stringify(contract, null, 2) + "\n");
          await writeFile(join(docsComponentsDir, `${name}.md`), generateComponentDoc(contract));

          contractMap.set(name, contract);
          scaffolded.push(name);

          // Register in config
          if (!brandConfig.components) brandConfig.components = {};
          brandConfig.components[name] = {
            contractPath: join(componentsDir, `${name}.contract.json`),
            widgetType,
            status: "draft" as ComponentStatus,
            addedAt: today,
          };
        }

        // Persist updated config and brand.md inventory
        if (Object.keys(brandConfig.components ?? {}).length > 0) {
          await writeFile(resolvedConfigFile, JSON.stringify(brandConfig, null, 2) + "\n");

          if (brandConfig.components) {
            const inventorySection = generateInventorySection(
              brandConfig.components as Record<string, { contractPath: string; widgetType: WidgetType; status: ComponentStatus; addedAt: string }>,
              contractMap,
            );
            if (existsSync(brandMdPath)) {
              const existing = await readFile(brandMdPath, "utf-8");
              await writeFile(brandMdPath, patchBrandMd(existing, inventorySection));
            } else {
              await mkdir(dirname(brandMdPath), { recursive: true });
              await writeFile(brandMdPath, inventorySection);
            }
          }
        }

        // Return recipe for all registered components
        const recipe = await buildKitRecipe({ config: configPath });

        // Build visualClasses map from all processed contracts (scaffolded + pre-existing)
        const visualClasses: Record<string, string> = {};
        for (const [compName, contract] of contractMap) {
          if (contract.visualClass) {
            visualClasses[compName] = contract.visualClass;
          }
        }

        // Save foundations ops to disk — they are ~40 KB on their own and would
        // exceed MCP result size limits if inlined. The agent reads the file and
        // passes its contents verbatim to batch_design after all components are drawn.
        const foundationsOpsPath = join(nibDir, "kit-foundations.ops");
        await writeFile(foundationsOpsPath, recipe.foundations.batchDesignOps);

        // Slim the recipe before serializing — strip fields not needed for batch_design:
        //   pencilVariables: already loaded in Pencil via nib_brand_push
        //   tokenBindings/anatomy/states: internal contract details, on disk in .nib/components/
        //   components[].batchDesignOps: use batches[] instead (pre-packed, fewer calls)
        //   foundations.batchDesignOps: saved to disk (see foundationsOpsPath)
        const slimRecipe = {
          brandName: recipe.brandName,
          // Pre-packed batches — execute these instead of components[].batchDesignOps.
          // Multiple components are merged per batch to minimise batch_design call count.
          batches: recipe.batches,
          components: recipe.components.map(({ name, widgetType, placement, verification }) => ({
            name,
            widgetType,
            placement,
            verification,
          })),
          foundations: {
            colorCount: recipe.foundations.colorCount,
            typographySteps: recipe.foundations.typographySteps,
            startsAtY: recipe.foundations.startsAtY,
            batchDesignOpsFile: foundationsOpsPath,
            note: `Read ${foundationsOpsPath} and pass its contents verbatim to batch_design after all components are drawn.`,
          },
          instruction: recipe.instruction,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                scaffolded,
                skipped,
                totalComponents: toScaffold.length,
                visualClasses,
                recipe: slimRecipe,
              }),
            },
          ],
        };
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
