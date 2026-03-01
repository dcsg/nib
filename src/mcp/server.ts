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
import { registerKitBootstrapTool } from "./tools/kit-bootstrap.js";
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
      instructions: `nib is the design control plane — brand tokens, WCAG audits, Pencil design files, and HTML prototypes.

ALWAYS call nib_status first to understand the current project state, then follow the appropriate workflow below. Tell the user what step you are on and what was produced.

── NEW PROJECT (hasBrandConfig: false) ──────────────────────────────
INTERVIEW FIRST — never run full init without confirming with the user.

If the user has a brand guidelines file or URL:
  1a. nib_brand_init(from: <file/URL>, preview: true)
      → Shows what was detected (brand name, colors, personality) with confidence levels.
  1b. Show the user the detected values. Ask them to confirm or correct each one.
      Pay special attention to any field marked "missing" or "medium" confidence.
  1c. nib_brand_init(from: <file/URL>, <all confirmed overrides>) — commit

If the user has no file (verbal brief):
  1a. Ask: (1) Brand name? (2) Primary color (hex)? (3) 1-2 personality words?
      Ask about secondary/accent colors and industry if relevant.
  1b. nib_brand_init(brandName: <name>, primaryColor: <hex>, personality: [...])

2. nib_brand_audit — verify WCAG AA compliance
3. nib_brand_push — creates the Pencil .pen file; canvas starts empty (expected — tokens are variables)
4. nib_kit_bootstrap — scaffolds the standard 12-component kit and returns a Pencil recipe
5. Pass the recipe to Pencil's batch_design to draw component frames into the .pen file

After init, nib automatically injects brand context into all AI agent config files found
(CLAUDE.md, .cursorrules, .windsurfrules, .github/copilot-instructions.md, AI_CONTEXT.md).
Every future agent session — regardless of which AI tool is used — will read brand.md before writing UI.

── EXISTING PROJECT (hasBrandConfig: true) ──────────────────────────
1. nib_status → check lastBuild / lastAudit timestamps
2. nib_brand_build if tokens need rebuilding after manual edits
3. nib_brand_audit to check for new WCAG regressions
4. nib_brand_push to sync updated tokens into the .pen file

── IMPORT FROM PENCIL ───────────────────────────────────────────────
1. nib_brand_import(file: <path to .pen>) — extracts variables → DTCG tokens
2. nib_brand_build → nib_brand_audit

── PROTOTYPE ────────────────────────────────────────────────────────
1. Open the target .pen file in Pencil
2. nib_capture → snapshots the open file
3. nib_build_prototype → generates shareable HTML with hotspot navigation

── COMPONENT CONTRACTS ──────────────────────────────────────────────
nib_kit_bootstrap — scaffold the standard 12-component kit in one call (call after nib_brand_build)
nib_component_init — define a custom component with token slots, states, and ARIA patterns
nib_kit — get a Pencil scaffolding recipe for all registered components (read-only)

If the user asks what nib does, how to start, or what they can do next — call nib_help first.`,
    },
  );

  // Register all tools
  registerBrandTools(server);
  registerComponentTools(server);
  registerPrototypeTools(server);
  registerStatusTool(server);
  registerKitTool(server);
  registerKitBootstrapTool(server);

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
