/**
 * MCP tools for project status and help.
 *
 * nib_status — read-only summary of the current project state.
 * nib_help   — plain-English guide to workflows and available tools.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** Safe fallback when running via `bun src/cli/index.ts` (dev mode without tsup define). */
const NIB_VERSION = typeof __NIB_VERSION__ !== "undefined" ? __NIB_VERSION__ : "0.0.0-dev";

/** Wrap an error into the MCP isError response shape. */
function errorResult(message: string) {
  return { isError: true as const, content: [{ type: "text" as const, text: message }] };
}

const HELP_TEXT = `# nib — Design Control Plane

nib generates your brand system (design tokens, CSS, Tailwind, Pencil variables) from a brief,
audits contrast for WCAG compliance, syncs tokens into Pencil design files, and builds shareable
HTML prototypes. Every output is structured so AI agents can read your brand and build on-brand UI.

---

## What do you want to do?

### "Set up a brand system for my project"

**If you have a brand guidelines file or URL:**
1. I'll run **nib_brand_init(from=..., preview=true)** to detect your brand values
2. I'll show you what was found — brand name, colors, personality — and ask you to confirm
3. Once confirmed, I commit with **nib_brand_init(from=..., <your corrections>)**

**If you're starting from scratch (no file):**
1. Tell me: (1) brand name, (2) primary color (hex), (3) 1-2 personality words
2. I'll run **nib_brand_init(brandName=..., primaryColor=..., personality=[...])**

Then: **nib_brand_audit** → WCAG check → **nib_brand_push** → Pencil file → **nib_kit** → scaffold frames

After init, nib writes your brand context into every AI agent config file it finds
(CLAUDE.md, .cursorrules, .windsurfrules, copilot-instructions.md, AI_CONTEXT.md) so any
AI tool — Claude, Cursor, Windsurf, Copilot — reads your brand before writing UI code.

### "I already have a Pencil design file with variables"
Run **nib_brand_import** on the .pen file — it extracts your existing variables into DTCG token files
and creates the brand config. Then run **nib_brand_build** and **nib_brand_audit**.

### "Build a clickable prototype from my Pencil designs"
Open the .pen file in Pencil, then:
1. **nib_capture** → snapshots the open file to a design.json
2. **nib_build_prototype** → generates a self-contained HTML prototype with hotspot navigation

### "Check if my tokens pass accessibility requirements"
Run **nib_brand_audit** — it checks every foreground/background color pair against WCAG AA (4.5:1)
and tells you which pairs fail and by how much.

### "See what's already set up in this project"
Run **nib_status** — shows brand config, last build/audit timestamps, component count, Pencil MCP state.

### "Register a component contract"
Run **nib_component_init** — define token slots, interactive states, and ARIA patterns for a component.

---

## All tools

| Tool | What it does |
|---|---|
| nib_status | Project state: config, timestamps, component count |
| nib_help | This guide |
| nib_brand_init | Generate brand system from file, URL, or brief |
| nib_brand_build | Rebuild CSS, Tailwind, and Pencil outputs from token files |
| nib_brand_audit | WCAG contrast audit — every color pair, pass/fail |
| nib_brand_validate | Schema + naming + accessibility validation on token files |
| nib_brand_push | Sync tokens into a Pencil .pen file as variables |
| nib_brand_import | Import Pencil variables → DTCG token files |
| nib_capture | Snapshot an open .pen file to design.json |
| nib_build_prototype | Build HTML prototype from design.json snapshot |
| nib_component_init | Create a component contract (states, tokens, ARIA) |
| nib_kit | Get component frame recipes for Pencil scaffolding |

---

Start by running **nib_status** to see the current project state, then follow the relevant workflow above.
`;

export function registerStatusTool(server: McpServer): void {
  server.registerTool(
    "nib_help",
    {
      description:
        "Call this when the user asks what nib does, how to get started, what they can do, or needs help choosing the right workflow. Returns a plain-English guide to all nib workflows and tools.",
      annotations: {
        title: "nib Help",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    () => ({
      content: [{ type: "text" as const, text: HELP_TEXT }],
    }),
  );


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

        // Add a nextStep hint so the agent knows what to suggest to the user
        if (!status.hasBrandConfig) {
          status.nextStep =
            "No brand system found. Ask the user: (1) What is your brand name? (2) What are your primary brand colors (hex values)? (3) Do you have a brand guidelines file, PDF, or website URL? Then call nib_brand_init.";
        } else if (!status.lastBuild) {
          status.nextStep =
            "Brand config exists but tokens have never been built. Call nib_brand_build to generate CSS, Tailwind, and Pencil outputs.";
        } else if (!status.lastAudit) {
          status.nextStep =
            "Tokens are built but have not been audited. Call nib_brand_audit to check WCAG AA compliance.";
        } else {
          status.nextStep =
            "Brand system is set up. You can: run nib_brand_audit to re-check contrast, call nib_brand_push to sync tokens into Pencil, or use nib_kit + Pencil batch_design to scaffold components.";
        }

        return {
          content: [{ type: "text", text: JSON.stringify(status) }],
        };
      } catch (err) {
        return errorResult(
          err instanceof Error ? err.message : String(err),
        );
      }
    },
  );
}
