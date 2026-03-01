/**
 * nib MCP Server — exposes nib tools and resources over JSON-RPC.
 *
 * `createNibMcpServer()` — transport-agnostic factory (returns McpServer)
 * `startMcpServer()`     — stdio transport for `nib --mcp`
 *
 * See ADR-002 for architecture, INV-005 for stdout purity.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBrandTools } from "./tools/brand.js";
import { registerComponentTools } from "./tools/component.js";
import { registerPrototypeTools } from "./tools/prototype.js";
import { registerStatusTool } from "./tools/status.js";
import { registerKitTool } from "./tools/kit.js";
import { registerBrandResources } from "./resources/brand.js";
import { registerTokenResources } from "./resources/tokens.js";
import { registerComponentResources } from "./resources/components.js";
import { registerBrandPrompts } from "./prompts/brand.js";

/** Safe fallback when running via `bun src/cli/index.ts` (dev mode without tsup define). */
const NIB_VERSION = typeof __NIB_VERSION__ !== "undefined" ? __NIB_VERSION__ : "0.0.0-dev";

/** Create a transport-agnostic nib MCP server with all tools and resources registered. */
export function createNibMcpServer(): McpServer {
  const server = new McpServer(
    { name: "nib", version: NIB_VERSION },
    {
      instructions: [
        "nib is the design control plane — brand systems, design tokens, prototypes.",
        "Use nib_status to check the current project state before other operations.",
        "Brand tools (nib_brand_*) manage design token generation, validation, and import.",
        "Component tools (nib_component_*) manage component contracts and registry.",
        "Prototype tools (nib_capture, nib_build_prototype) convert .pen designs to HTML.",
        "nib_kit returns a component recipe for Pencil scaffolding (read-only).",
      ].join(" "),
    },
  );

  // Register all tools
  registerBrandTools(server);
  registerComponentTools(server);
  registerPrototypeTools(server);
  registerStatusTool(server);
  registerKitTool(server);

  // Register all resources
  registerBrandResources(server);
  registerTokenResources(server);
  registerComponentResources(server);

  // Register all prompts
  registerBrandPrompts(server);

  return server;
}

/** Start the MCP server on stdio transport (used by `nib --mcp`). */
export async function startMcpServer(): Promise<void> {
  const { StdioServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/stdio.js"
  );

  const server = createNibMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
