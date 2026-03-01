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
        "Pass the returned recipe to Pencil's batch_design tool to draw frames in the .pen file.",
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
        const systemOutputDir = resolve(brandConfig.output ?? join("docs", "design", "system"));
        const nibDir = resolve(".nib");
        const componentsDir = join(nibDir, "components");
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

          if (existsSync(contractPath)) {
            skipped.push(name);
            // Load existing contract for inventory generation
            try {
              const raw = await readFile(contractPath, "utf-8");
              contractMap.set(name, JSON.parse(raw) as ComponentContract);
            } catch { /* not fatal */ }
            continue;
          }

          const widgetType = detectWidgetType(name);
          const contract = await scaffoldContract(name, { widgetType });

          await writeFile(contractPath, JSON.stringify(contract, null, 2) + "\n");
          await writeFile(join(docsComponentsDir, `${name}.md`), generateComponentDoc(contract));

          contractMap.set(name, contract);
          scaffolded.push(name);

          // Register in config
          if (!brandConfig.components) brandConfig.components = {};
          brandConfig.components[name] = {
            contractPath: `.nib/components/${name}.contract.json`,
            widgetType,
            status: "draft" as ComponentStatus,
            addedAt: today,
          };
        }

        // Persist updated config and brand.md inventory
        if (scaffolded.length > 0) {
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

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  scaffolded,
                  skipped,
                  totalComponents: toScaffold.length,
                  recipe,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
