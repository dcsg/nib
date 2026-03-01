/**
 * MCP tools for the brand pipeline.
 *
 * 6 tools: nib_brand_init, nib_brand_build, nib_brand_audit,
 * nib_brand_validate, nib_brand_push, nib_brand_import.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { validateProjectPath } from "./validate-path.js";

/** Wrap an error into the MCP isError response shape. */
function errorResult(message: string) {
  return { isError: true as const, content: [{ type: "text" as const, text: message }] };
}

export function registerBrandTools(server: McpServer): void {
  // ── nib_brand_init ──────────────────────────────────────────────
  server.registerTool(
    "nib_brand_init",
    {
      description:
        "Generate a complete brand system (design tokens, docs, platform outputs) from a brand guidelines source file or URL. Requires a `from` parameter — interactive mode is not available via MCP.",
      inputSchema: {
        from: z.string().min(1, "from is required — provide a path to a .md/.txt/.pdf file or a URL").describe("Path to .md/.txt/.pdf file, or a URL"),
        output: z.string().optional().describe("Output directory (default: docs/design/system)"),
        ai: z
          .enum(["anthropic", "openai", "ollama"])
          .optional()
          .describe("AI provider to use for enhancement"),
        noAi: z
          .boolean()
          .optional()
          .describe("Skip AI enhancement, use only algorithmic derivation"),
      },
      annotations: {
        title: "Initialize Brand System",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ from, output, ai, noAi }) => {
      try {
        let input;
        if (from.startsWith("http://") || from.startsWith("https://")) {
          const { urlIntake } = await import("../../brand/intake/url.js");
          input = await urlIntake(from);
        } else {
          // File path — validate it exists and is a file, not a directory
          const { statSync } = await import("node:fs");
          const path = validateProjectPath(from);
          let stat;
          try {
            stat = statSync(path);
          } catch {
            return errorResult(
              `File not found: "${from}". Provide a path to a .md, .txt, or .pdf file, or a URL.`,
            );
          }
          if (stat.isDirectory()) {
            return errorResult(
              `"${from}" is a directory, not a file. Provide a path to a .md, .txt, or .pdf file, or a URL.`,
            );
          }

          if (from.endsWith(".pdf")) {
            const { pdfIntake } = await import("../../brand/intake/pdf.js");
            input = await pdfIntake(path);
          } else {
            const { markdownIntake } = await import("../../brand/intake/markdown.js");
            input = await markdownIntake(path);
          }
        }

        const { init } = await import("../../brand/index.js");
        const config = await init(input, { from, output, ai, noAi: noAi ?? false });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  brand: config.brand.name,
                  tokens: config.tokens,
                  output: config.output,
                  platforms: config.platforms,
                },
                null,
                2,
              ),
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

  // ── nib_brand_build ─────────────────────────────────────────────
  server.registerTool(
    "nib_brand_build",
    {
      description:
        "Build platform outputs (CSS variables, Tailwind preset, Pencil variables) from DTCG design tokens. Also generates foundation docs and component artifacts.",
      inputSchema: {
        config: z
          .string()
          .optional()
          .describe("Path to brand.config.json (default: .nib/brand.config.json)"),
      },
      annotations: {
        title: "Build Brand Outputs",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ config }) => {
      try {
        const { brandBuild } = await import("../../brand/index.js");
        await brandBuild({ config });
        return {
          content: [{ type: "text", text: "Brand build completed successfully." }],
        };
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? err.message
            : String(err),
        );
      }
    },
  );

  // ── nib_brand_audit ─────────────────────────────────────────────
  server.registerTool(
    "nib_brand_audit",
    {
      description:
        "Run a WCAG 2.1 contrast audit on the brand's color token pairs. Returns a detailed report with pass/fail per pair and overall counts.",
      inputSchema: {
        config: z
          .string()
          .optional()
          .describe("Path to brand.config.json (default: .nib/brand.config.json)"),
        level: z
          .enum(["AA", "AAA"])
          .optional()
          .describe("Minimum WCAG level (default: AA)"),
      },
      annotations: {
        title: "Audit WCAG Contrast",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ config, level }) => {
      try {
        const { brandAudit } = await import("../../brand/index.js");
        const report = await brandAudit({ config, level: level ?? "AA" });
        return {
          content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
        };
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? `Audit failed: ${err.message}. Run nib_brand_init first if no brand config exists.`
            : String(err),
        );
      }
    },
  );

  // ── nib_brand_validate ──────────────────────────────────────────
  server.registerTool(
    "nib_brand_validate",
    {
      description:
        "Validate DTCG token files against schema, naming conventions, required categories, accessibility, and component bindings. Returns a ValidationResult with errors and warnings.",
      inputSchema: {
        config: z
          .string()
          .optional()
          .describe("Path to brand.config.json (default: .nib/brand.config.json)"),
        tokensDir: z
          .string()
          .optional()
          .describe("Path to tokens directory (default: from brand.config.json)"),
        failOn: z
          .enum(["all", "schema", "naming", "required", "a11y", "components"])
          .optional()
          .describe("Which checks to fail on (default: all)"),
      },
      annotations: {
        title: "Validate Design Tokens",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ config, tokensDir, failOn }) => {
      try {
        let resolvedTokensDir = tokensDir;
        let componentRegistry;

        if (!resolvedTokensDir) {
          const { loadBrandConfig } = await import("../../brand/index.js");
          const brandConfig = await loadBrandConfig(config);
          resolvedTokensDir = brandConfig.tokens;
          componentRegistry = brandConfig.components;
        }

        const { validateTokens } = await import("../../brand/validate/index.js");
        const result = await validateTokens({
          tokensDir: resolvedTokensDir,
          failOn,
          componentRegistry,
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return errorResult(
          err instanceof Error
            ? `Validation failed: ${err.message}. Run nib_brand_init first if no brand config exists.`
            : String(err),
        );
      }
    },
  );

  // ── nib_brand_push ──────────────────────────────────────────────
  server.registerTool(
    "nib_brand_push",
    {
      description:
        "Sync design tokens into a Pencil.dev .pen file via MCP. Requires a running Pencil.dev instance with MCP configured.",
      inputSchema: {
        file: z
          .string()
          .optional()
          .describe("Path to .pen file (default: from brand.config.json)"),
        config: z
          .string()
          .optional()
          .describe("Path to brand.config.json (default: .nib/brand.config.json)"),
      },
      annotations: {
        title: "Push Tokens to Pencil",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ file, config }) => {
      try {
        const { brandPush } = await import("../../brand/index.js");
        const result = await brandPush({ file, config });
        const msg = result.created
          ? [
              `Created ${result.penFile} (first-time setup).`,
              `Pencil has opened the file with your tokens loaded.`,
              `Save it now: Cmd+S in Pencil.`,
              `This is your canonical design file — use it with nib_capture to build prototypes.`,
            ].join(" ")
          : `Tokens pushed to ${result.penFile}. Save the file in Pencil.dev (Cmd+S) to persist changes.`;
        return {
          content: [{ type: "text", text: msg }],
        };
      } catch (err) {
        return errorResult(
          err instanceof Error ? err.message : String(err),
        );
      }
    },
  );

  // ── nib_brand_import ────────────────────────────────────────────
  server.registerTool(
    "nib_brand_import",
    {
      description:
        "Import variables from an existing Pencil .pen file and create DTCG token files + brand.config.json. " +
        "Use this for existing projects that already have a Pencil design system. " +
        "If brand.config.json already exists, returns a diff summary with requiresConfirmation: true — " +
        "call again with overwrite: true after confirming with the user.",
      inputSchema: {
        file: z.string().describe("Path to the .pen file to import from"),
        output: z
          .string()
          .optional()
          .describe("Tokens output directory (default: docs/design/system/tokens)"),
        config: z
          .string()
          .optional()
          .describe("Path to write brand.config.json (default: .nib/brand.config.json)"),
        overwrite: z
          .boolean()
          .optional()
          .describe(
            "Overwrite existing brand.config.json without prompting (default: false — returns diff first)",
          ),
      },
      annotations: {
        title: "Import Brand from Pencil",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ file, output, config, overwrite }) => {
      try {
        const { brandImport } = await import("../../brand/import.js");
        const result = await brandImport({ file, output, config, overwrite });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return errorResult(
          err instanceof Error ? err.message : String(err),
        );
      }
    },
  );
}
