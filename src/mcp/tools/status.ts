/**
 * MCP tool for project status.
 *
 * 1 tool: nib_status — read-only summary of the current project state.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** Safe fallback when running via `bun src/cli/index.ts` (dev mode without tsup define). */
const NIB_VERSION = typeof __NIB_VERSION__ !== "undefined" ? __NIB_VERSION__ : "0.0.0-dev";

/** Wrap an error into the MCP isError response shape. */
function errorResult(message: string) {
  return { isError: true as const, content: [{ type: "text" as const, text: message }] };
}

export function registerStatusTool(server: McpServer): void {
  server.registerTool(
    "nib_status",
    {
      description:
        "Get the current nib project status: brand config presence, token directory, last build/audit/validate timestamps, component count, and MCP connectivity.",
      annotations: {
        title: "Project Status",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const { existsSync } = await import("node:fs");
        const { readFile } = await import("node:fs/promises");
        const { resolve } = await import("node:path");

        const configPath = resolve(".nib", "brand.config.json");
        const statusPath = resolve(".nib", ".status.json");

        const status: Record<string, unknown> = {
          version: NIB_VERSION,
          hasBrandConfig: false,
          hasStatus: false,
        };

        // Read brand config
        if (existsSync(configPath)) {
          try {
            const raw = await readFile(configPath, "utf-8");
            const config = JSON.parse(raw) as {
              brand?: { name?: string };
              tokens?: string;
              output?: string;
              components?: Record<string, unknown>;
            };
            status.hasBrandConfig = true;
            status.brandName = config.brand?.name;
            status.tokensDir = config.tokens;
            status.outputDir = config.output;
            status.componentCount = config.components
              ? Object.keys(config.components).length
              : 0;
          } catch {
            status.hasBrandConfig = false;
            status.configError = "brand.config.json exists but is not valid JSON";
          }
        }

        // Read .status.json
        if (existsSync(statusPath)) {
          try {
            const raw = await readFile(statusPath, "utf-8");
            const s = JSON.parse(raw) as Record<string, unknown>;
            status.hasStatus = true;
            status.lastBuild = s["lastBuild"];
            status.lastAudit = s["lastAudit"];
            status.lastValidate = s["lastValidate"];
            status.tokenVersion = s["tokenVersion"];
          } catch {
            status.hasStatus = false;
          }
        }

        // Check MCP connectivity
        try {
          const { discoverPencilMcp } = await import("../../mcp/discover.js");
          await discoverPencilMcp();
          status.mcpConfigFound = true;
        } catch {
          status.mcpConfigFound = false;
        }

        return {
          content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
        };
      } catch (err) {
        return errorResult(
          err instanceof Error ? err.message : String(err),
        );
      }
    },
  );
}
