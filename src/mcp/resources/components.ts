/**
 * MCP resource template for component contracts.
 *
 * URI template: nib://components/{name}
 * Maps to .nib/components/{name}.contract.json files.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerComponentResources(server: McpServer): void {
  const template = new ResourceTemplate("nib://components/{name}", {
    list: async () => {
      try {
        const { readFile } = await import("node:fs/promises");
        const { resolve } = await import("node:path");

        const configPath = resolve(".nib", "brand.config.json");
        const raw = await readFile(configPath, "utf-8");
        const config = JSON.parse(raw) as {
          components?: Record<string, { contractPath: string }>;
        };

        const components = config.components ?? {};
        const resources = Object.keys(components).map((name) => ({
          uri: `nib://components/${name}`,
          name,
        }));

        return { resources };
      } catch {
        return { resources: [] };
      }
    },
    complete: {
      name: async () => {
        try {
          const { readFile } = await import("node:fs/promises");
          const { resolve } = await import("node:path");

          const configPath = resolve(".nib", "brand.config.json");
          const raw = await readFile(configPath, "utf-8");
          const config = JSON.parse(raw) as {
            components?: Record<string, unknown>;
          };

          return Object.keys(config.components ?? {});
        } catch {
          return [];
        }
      },
    },
  });

  server.registerResource(
    "component-contract",
    template,
    {
      description: "Component contract JSON file",
      mimeType: "application/json",
    },
    async (uri, { name }) => {
      const { readFile } = await import("node:fs/promises");
      const { resolve } = await import("node:path");

      const contractPath = resolve(".nib", "components", `${name}.contract.json`);
      const content = await readFile(contractPath, "utf-8");
      return {
        contents: [{ uri: uri.href, text: content, mimeType: "application/json" }],
      };
    },
  );
}
