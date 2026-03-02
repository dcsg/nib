/**
 * MCP tool: nib_kit
 *
 * Returns a structured recipe of component frames to scaffold in Pencil
 * with brand variables already wired. READ-ONLY — no files are written.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** Wrap an error into the MCP isError response shape. */
function errorResult(message: string) {
  return { isError: true as const, content: [{ type: "text" as const, text: message }] };
}

export function registerKitTool(server: McpServer): void {
  server.registerTool(
    "nib_kit",
    {
      description:
        "Return a component kit recipe — structured data describing how to scaffold component frames in Pencil with brand variables wired. " +
        "READ-ONLY: use the recipe with Pencil's batch_design tool to draw the frames, then call snapshot_layout and get_screenshot to verify.",
      inputSchema: {
        config: z
          .string()
          .optional()
          .describe("Path to brand.config.json (default: .nib/brand.config.json)"),
        components: z
          .array(z.string())
          .optional()
          .describe("Filter to specific component names (default: all registered components)"),
      },
      annotations: {
        title: "Component Kit Recipe",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ config, components }) => {
      try {
        const { buildKitRecipe } = await import("../../brand/kit.js");
        const recipe = await buildKitRecipe({ config, components });

        const { join, resolve, dirname } = await import("node:path");
        const { writeFile } = await import("node:fs/promises");
        const { loadBrandConfig } = await import("../../brand/index.js");
        const brandConfig = await loadBrandConfig(config);
        const resolvedConfigFile = resolve(config ?? join(".nib", "brand.config.json"));
        const nibDir = dirname(resolvedConfigFile);

        // Save foundations ops to disk — they are ~40 KB and would exceed MCP result
        // size limits if inlined. The agent reads the file and passes contents to batch_design.
        const foundationsOpsPath = join(nibDir, "kit-foundations.ops");
        await writeFile(foundationsOpsPath, recipe.foundations.batchDesignOps);

        // Slim the recipe — strip pencilVariables and per-component tokenBindings/anatomy/states
        // which are not needed to execute batch_design, and replace foundations.batchDesignOps
        // with a file reference to keep the response under MCP size limits.
        const slimRecipe = {
          brandName: recipe.brandName,
          components: recipe.components.map(({ name, widgetType, placement, batchDesignOps, verification }) => ({
            name,
            widgetType,
            placement,
            batchDesignOps,
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
              text: JSON.stringify(slimRecipe),
            },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Provide actionable guidance when the registry is empty
        if (msg.includes("No components in registry")) {
          return errorResult(
            msg +
            " Call nib_kit_bootstrap to scaffold the standard 12-component kit " +
            "(Button, TextInput, Checkbox, Radio, Switch, Dialog, Tooltip, Tabs, Combobox, Badge, Toast, Alert) " +
            "in a single call.",
          );
        }
        return errorResult(msg);
      }
    },
  );
}
