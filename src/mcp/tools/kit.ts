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

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(recipe, null, 2),
            },
          ],
        };
      } catch (err) {
        return errorResult(
          err instanceof Error ? err.message : String(err),
        );
      }
    },
  );
}
