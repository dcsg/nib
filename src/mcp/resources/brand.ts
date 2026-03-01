/**
 * MCP resources for the brand system.
 *
 * 3 static resources:
 *   nib://brand/config  — .nib/brand.config.json
 *   nib://brand/status  — .nib/.status.json
 *   nib://brand/docs    — {output}/brand.md
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerBrandResources(server: McpServer): void {
  // ── nib://brand/config ──────────────────────────────────────────
  server.registerResource(
    "brand-config",
    "nib://brand/config",
    {
      description: "Brand system configuration (.nib/brand.config.json)",
      mimeType: "application/json",
    },
    async (uri) => {
      const { readFile } = await import("node:fs/promises");
      const { resolve } = await import("node:path");
      const content = await readFile(resolve(".nib", "brand.config.json"), "utf-8");
      return { contents: [{ uri: uri.href, text: content, mimeType: "application/json" }] };
    },
  );

  // ── nib://brand/status ──────────────────────────────────────────
  server.registerResource(
    "brand-status",
    "nib://brand/status",
    {
      description: "Build and audit status metadata (.nib/.status.json)",
      mimeType: "application/json",
    },
    async (uri) => {
      const { readFile } = await import("node:fs/promises");
      const { resolve } = await import("node:path");
      try {
        const content = await readFile(resolve(".nib", ".status.json"), "utf-8");
        return { contents: [{ uri: uri.href, text: content, mimeType: "application/json" }] };
      } catch {
        return {
          contents: [{ uri: uri.href, text: "{}", mimeType: "application/json" }],
        };
      }
    },
  );

  // ── nib://brand/docs ────────────────────────────────────────────
  server.registerResource(
    "brand-docs",
    "nib://brand/docs",
    {
      description: "Generated brand documentation (brand.md)",
      mimeType: "text/markdown",
    },
    async (uri) => {
      const { readFile } = await import("node:fs/promises");
      const { resolve } = await import("node:path");

      // Resolve output dir from config, or fall back to default
      let outputDir = resolve("docs", "design", "system");
      try {
        const raw = await readFile(resolve(".nib", "brand.config.json"), "utf-8");
        const config = JSON.parse(raw) as { output?: string };
        if (config.output) outputDir = resolve(config.output);
      } catch {
        // Use default
      }

      const content = await readFile(resolve(outputDir, "brand.md"), "utf-8");
      return { contents: [{ uri: uri.href, text: content, mimeType: "text/markdown" }] };
    },
  );
}
