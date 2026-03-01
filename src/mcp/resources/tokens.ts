/**
 * MCP resource template for individual token files.
 *
 * URI template: nib://tokens/{category}/{name}
 * Maps to token JSON files in the configured tokens directory.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

/** Known token categories for autocompletion. */
const TOKEN_CATEGORIES = [
  "color",
  "typography",
  "spacing",
  "radius",
  "elevation",
  "motion",
  "sizing",
  "border-width",
  "opacity",
  "z-index",
  "breakpoint",
  "components",
];

/** Resolve the tokens directory from brand.config.json. */
async function resolveTokensDir(): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  const raw = await readFile(resolve(".nib", "brand.config.json"), "utf-8");
  const config = JSON.parse(raw) as { tokens: string };
  return config.tokens;
}

export function registerTokenResources(server: McpServer): void {
  const template = new ResourceTemplate("nib://tokens/{category}/{name}", {
    list: async () => {
      try {
        const { readdir } = await import("node:fs/promises");
        const { join } = await import("node:path");

        const tokensDir = await resolveTokensDir();
        const resources: { uri: string; name: string }[] = [];

        const categories = await readdir(tokensDir, { withFileTypes: true });
        for (const cat of categories) {
          if (!cat.isDirectory()) continue;
          const catDir = join(tokensDir, cat.name);
          const files = await readdir(catDir);
          for (const file of files) {
            if (!file.endsWith(".json")) continue;
            const name = file.replace(/\.tokens\.json$/, "").replace(/\.json$/, "");
            resources.push({
              uri: `nib://tokens/${cat.name}/${name}`,
              name: `${cat.name}/${name}`,
            });
          }
        }

        return { resources };
      } catch {
        return { resources: [] };
      }
    },
    complete: {
      category: async () => TOKEN_CATEGORIES,
      name: async (value) => {
        try {
          const { readdir } = await import("node:fs/promises");
          const { join } = await import("node:path");

          const tokensDir = await resolveTokensDir();
          // value.category holds the already-resolved category
          const category = (value as unknown as Record<string, string>)["category"];
          if (!category) return [];

          const catDir = join(tokensDir, category);
          const files = await readdir(catDir);
          return files
            .filter((f) => f.endsWith(".json"))
            .map((f) => f.replace(/\.tokens\.json$/, "").replace(/\.json$/, ""));
        } catch {
          return [];
        }
      },
    },
  });

  server.registerResource(
    "token-file",
    template,
    {
      description: "Individual DTCG token file by category and name",
      mimeType: "application/json",
    },
    async (uri, { category, name }) => {
      const { readFile } = await import("node:fs/promises");
      const { join, resolve } = await import("node:path");
      const { existsSync } = await import("node:fs");

      const tokensDir = await resolveTokensDir();
      const catDir = join(tokensDir, category as string);

      // Try with .tokens.json suffix first, then plain .json
      let filePath = join(catDir, `${name}.tokens.json`);
      if (!existsSync(filePath)) {
        filePath = join(catDir, `${name}.json`);
      }

      const content = await readFile(resolve(filePath), "utf-8");
      return {
        contents: [{ uri: uri.href, text: content, mimeType: "application/json" }],
      };
    },
  );
}
