/**
 * MCP tools for the component system.
 *
 * 2 tools: nib_component_init, nib_component_list.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** Wrap an error into the MCP isError response shape. */
function errorResult(message: string) {
  return { isError: true as const, content: [{ type: "text" as const, text: message }] };
}

export function registerComponentTools(server: McpServer): void {
  // ── nib_component_init ──────────────────────────────────────────
  server.registerTool(
    "nib_component_init",
    {
      description:
        "Scaffold a new component contract with WAI-ARIA keyboard patterns pre-filled. Writes contract JSON, generates component docs, updates the registry in brand.config.json, and patches brand.md.",
      inputSchema: {
        name: z.string().describe("Component name (e.g. Button, Dialog, SearchInput)"),
        widgetType: z
          .enum([
            "button",
            "textinput",
            "checkbox",
            "radio",
            "switch",
            "tabs",
            "dialog",
            "combobox",
            "tooltip",
            "generic",
          ])
          .optional()
          .describe("Widget type — auto-detected from name if omitted"),
        variants: z
          .array(z.string())
          .optional()
          .describe("Variant names (e.g. ['primary', 'secondary', 'ghost'])"),
        sizes: z
          .array(z.string())
          .optional()
          .describe("Size names (e.g. ['sm', 'md', 'lg'])"),
        config: z
          .string()
          .optional()
          .describe("Path to brand.config.json (default: .nib/brand.config.json)"),
      },
      annotations: {
        title: "Initialize Component",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ name, widgetType, variants, sizes, config }) => {
      try {
        const { scaffoldContract, detectWidgetType } = await import(
          "../../brand/components/scaffold.js"
        );
        const { registerComponent } = await import(
          "../../brand/components/register.js"
        );

        const resolvedWidgetType = widgetType ?? detectWidgetType(name);
        const contract = await scaffoldContract(name, {
          widgetType: resolvedWidgetType,
          variants,
          sizes,
        });

        const result = await registerComponent(name, contract, { config });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                name,
                widgetType: result.widgetType,
                contractPath: result.contractPath,
                docPath: result.docPath,
                states: Object.keys(contract.states),
                keyboard: contract.a11y.keyboard,
              }),
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

  // ── nib_component_list ──────────────────────────────────────────
  server.registerTool(
    "nib_component_list",
    {
      description:
        "List all components in the registry. Returns each component's name, widget type, status, and contract path.",
      inputSchema: {
        config: z
          .string()
          .optional()
          .describe("Path to brand.config.json (default: .nib/brand.config.json)"),
      },
      annotations: {
        title: "List Components",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ config }) => {
      try {
        const { readFile } = await import("node:fs/promises");
        const { resolve } = await import("node:path");

        const configPath = config ?? resolve(".nib", "brand.config.json");
        const raw = await readFile(configPath, "utf-8");
        const brandConfig = JSON.parse(raw) as {
          components?: Record<
            string,
            { contractPath: string; widgetType: string; status: string; addedAt: string }
          >;
        };

        const components = brandConfig.components ?? {};
        const entries = Object.entries(components).map(([name, entry]) => ({
          name,
          ...entry,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ count: entries.length, components: entries }),
            },
          ],
        };
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? `Could not read component registry: ${err.message}. Run nib_brand_init first.`
            : String(err),
        );
      }
    },
  );
}
