/**
 * MCP tools for the prototype pipeline.
 *
 * 2 tools: nib_capture, nib_build_prototype.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { validateProjectPath } from "./validate-path.js";

/** Wrap an error into the MCP isError response shape. */
function errorResult(message: string) {
  return { isError: true as const, content: [{ type: "text" as const, text: message }] };
}

export function registerPrototypeTools(server: McpServer): void {
  // ── nib_capture ─────────────────────────────────────────────────
  server.registerTool(
    "nib_capture",
    {
      description:
        "Capture a .pen file via Pencil MCP and produce a DesignDocument JSON. Requires a running Pencil.dev instance with MCP configured.",
      inputSchema: {
        file: z.string().describe("Path to the .pen file to capture"),
        output: z
          .string()
          .optional()
          .describe("Output path for the intermediate JSON (default: auto-generated)"),
        canvases: z
          .array(z.string())
          .optional()
          .describe("Specific canvas names to capture (default: all)"),
      },
      annotations: {
        title: "Capture Design",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ file, output, canvases }) => {
      try {
        const filePath = validateProjectPath(file);
        const { capture } = await import("../../capture/index.js");
        const doc = await capture({ file: filePath, output, canvases });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  source: doc.source,
                  capturedAt: doc.capturedAt,
                  canvasCount: doc.canvases.length,
                  canvases: doc.canvases.map((c) => ({
                    id: c.id,
                    name: c.name,
                    width: c.width,
                    height: c.height,
                    childCount: c.children.length,
                  })),
                  componentCount: Object.keys(doc.components).length,
                  variableCount: Object.keys(doc.variables).length,
                  assetCount: doc.assets.length,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? `Capture failed: ${err.message}. Is Pencil.dev running with MCP configured?`
            : String(err),
        );
      }
    },
  );

  // ── nib_build_prototype ─────────────────────────────────────────
  server.registerTool(
    "nib_build_prototype",
    {
      description:
        "Build an HTML prototype from a DesignDocument JSON file. Transforms the intermediate format into a standalone HTML page with CSS. " +
        "Optionally provide hotspot navigation links between canvases.",
      inputSchema: {
        input: z.string().describe("Path to the DesignDocument JSON file"),
        output: z
          .string()
          .optional()
          .describe("Output directory (default: auto-generated)"),
        template: z
          .enum(["clean", "presentation"])
          .optional()
          .describe("HTML template to use (default: clean)"),
        standalone: z
          .boolean()
          .optional()
          .describe("Embed all assets for offline use"),
        device: z
          .string()
          .optional()
          .describe("Device frame name (e.g. iphone-15-pro)"),
        links: z
          .array(
            z.object({
              from: z.string().describe("Source canvas name (as returned by nib_capture)"),
              nodeId: z.string().describe("Node ID within the source canvas"),
              to: z.string().describe("Target canvas name"),
              transition: z
                .enum(["slide-left", "slide-right", "fade", "none"])
                .optional()
                .describe("Transition animation (default: none)"),
            }),
          )
          .optional()
          .describe(
            "Hotspot navigation links between canvases. If provided, a nib.config.json is written to the output directory.",
          ),
        config: z
          .string()
          .optional()
          .describe("Path to an existing nib.config.json (alternative to inline links)"),
      },
      annotations: {
        title: "Build Prototype",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ input, output, template, standalone, device, links, config }) => {
      try {
        const inputPath = validateProjectPath(input);

        let resolvedConfig = config;
        if (links?.length) {
          const outDir = resolve(output ?? "./prototype");
          await mkdir(outDir, { recursive: true });
          const configPath = join(outDir, "nib.config.json");
          await writeFile(configPath, JSON.stringify({ links }, null, 2));
          resolvedConfig = configPath;
        }

        const { build } = await import("../../build/index.js");
        const result = await build({
          input: inputPath,
          output,
          template,
          standalone,
          device,
          config: resolvedConfig,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  outputDir: result.outputDir,
                  files: result.files,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? `Build failed: ${err.message}. Run nib_capture first to generate the DesignDocument JSON.`
            : String(err),
        );
      }
    },
  );
}
