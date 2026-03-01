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
        "Initialize a brand system from a source file, URL, or direct parameters. " +
        "ALWAYS use preview: true first when a source file is available — it shows what was detected so you can confirm with the user before committing. " +
        "When no file is available (verbal brief), provide brandName + primaryColor directly. " +
        "Generates design tokens, CSS variables, Tailwind preset, and AI agent context files.",
      inputSchema: {
        from: z
          .string()
          .optional()
          .describe("Path to .md/.txt/.pdf file, or a URL with brand guidelines. Omit if providing params directly."),
        preview: z
          .boolean()
          .optional()
          .describe(
            "Detect brand values from the source WITHOUT writing any files. " +
            "Returns { detected, confidence, missing } so you can confirm with the user first. " +
            "Always use this before committing when a source file is available.",
          ),
        brandName: z
          .string()
          .optional()
          .describe("Brand name. Required when `from` is omitted. Overrides detection from file."),
        primaryColor: z
          .string()
          .optional()
          .describe("Primary brand color as hex (e.g. #3b82f6). Required when `from` is omitted."),
        secondaryColor: z.string().optional().describe("Secondary brand color as hex."),
        accentColor: z.string().optional().describe("Accent color as hex."),
        personality: z
          .array(z.enum(["professional", "playful", "warm", "bold", "minimal", "elegant", "technical", "friendly"]))
          .optional()
          .describe("Brand personality traits. Overrides detection from file."),
        industry: z.string().optional().describe("Industry or sector (e.g. 'fintech', 'healthcare')."),
        description: z.string().optional().describe("Short brand description or tagline."),
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
    async ({ from, preview, brandName, primaryColor, secondaryColor, accentColor, personality, industry, description, output, ai, noAi }) => {
      try {
        // ── Resolve BrandInput ────────────────────────────────────────────
        type RawInput = {
          name: string | null;
          colors: { primary: string | null; secondary?: string; accent?: string };
          fonts: string[];
          personality: string[];
          description: string | null;
          industry: string | null;
        };

        let rawInput: RawInput;
        let sourceText = "";

        if (from) {
          if (from.startsWith("http://") || from.startsWith("https://")) {
            const { urlIntake } = await import("../../brand/intake/url.js");
            const urlResult = await urlIntake(from);
            rawInput = {
              name: urlResult.name,
              colors: { primary: urlResult.colors.primary, secondary: urlResult.colors.secondary, accent: urlResult.colors.accent },
              fonts: urlResult.typography.fontFamily ? [urlResult.typography.fontFamily] : [],
              personality: urlResult.personality ?? ["professional"],
              description: urlResult.description ?? null,
              industry: urlResult.industry ?? null,
            };
          } else {
            const { statSync, readFileSync } = await import("node:fs");
            const path = validateProjectPath(from);
            let stat;
            try {
              stat = statSync(path);
            } catch {
              return errorResult(`File not found: "${from}". Provide a path to a .md, .txt, or .pdf file, or a URL.`);
            }
            if (stat.isDirectory()) {
              return errorResult(`"${from}" is a directory, not a file.`);
            }

            if (from.endsWith(".pdf")) {
              const { pdfIntake } = await import("../../brand/intake/pdf.js");
              const pdfResult = await pdfIntake(path);
              rawInput = {
                name: pdfResult.name,
                colors: { primary: pdfResult.colors.primary, secondary: pdfResult.colors.secondary, accent: pdfResult.colors.accent },
                fonts: pdfResult.typography.fontFamily ? [pdfResult.typography.fontFamily] : [],
                personality: pdfResult.personality ?? ["professional"],
                description: pdfResult.description ?? null,
                industry: pdfResult.industry ?? null,
              };
            } else {
              // Markdown/text — use extraction helpers for both preview and full init
              const {
                extractBrandName,
                extractColors,
                extractFonts,
                detectPersonality,
              } = await import("../../brand/intake/markdown.js");
              sourceText = readFileSync(path, "utf-8");
              const detectedColors = extractColors(sourceText);
              rawInput = {
                name: extractBrandName(sourceText),
                colors: {
                  primary: detectedColors[0] ?? null,
                  secondary: detectedColors[1],
                  accent: detectedColors[2],
                },
                fonts: extractFonts(sourceText),
                personality: detectPersonality(sourceText),
                description: null,
                industry: null,
              };
            }
          }
        } else {
          // Direct brief mode — no source file
          if (!brandName || !primaryColor) {
            return errorResult(
              "Either `from` (file/URL) or both `brandName` and `primaryColor` are required. " +
              "If the user hasn't provided a brand guidelines file, ask them for: (1) brand name, (2) primary color (hex), (3) personality words.",
            );
          }
          rawInput = {
            name: brandName,
            colors: { primary: primaryColor, secondary: secondaryColor, accent: accentColor },
            fonts: [],
            personality: personality ?? ["professional"],
            description: description ?? null,
            industry: industry ?? null,
          };
        }

        // ── Apply overrides ───────────────────────────────────────────────
        if (brandName) rawInput.name = brandName;
        if (primaryColor) rawInput.colors.primary = primaryColor;
        if (secondaryColor) rawInput.colors.secondary = secondaryColor;
        if (accentColor) rawInput.colors.accent = accentColor;
        if (personality) rawInput.personality = personality;
        if (industry) rawInput.industry = industry;
        if (description) rawInput.description = description;

        // ── Compute confidence (guides agent on what to confirm with user) ─
        const confidence: Record<string, string> = {};
        if (from) {
          confidence["brandName"] = brandName
            ? "overridden"
            : rawInput.name
              ? "detected"
              : "missing";
          const colorCountInSource = sourceText
            ? (sourceText.match(/#[0-9a-fA-F]{6}\b/g) ?? []).length
            : 0;
          confidence["primaryColor"] = primaryColor
            ? "overridden"
            : !sourceText
              ? "detected"
              : colorCountInSource === 1
                ? "high"
                : colorCountInSource > 1
                  ? "medium — multiple colors found, using first"
                  : "missing";
          confidence["personality"] = personality ? "overridden" : "inferred from text";
        }

        const missing: string[] = [];
        if (!rawInput.name) missing.push("brandName");
        if (!rawInput.colors.primary) missing.push("primaryColor");

        // ── Preview mode — return detected values, write nothing ──────────
        if (preview) {
          const nextStepParts: string[] = [
            "Show these detected values to the user and ask them to confirm:",
          ];
          if (rawInput.name) nextStepParts.push(`  • Brand name: "${rawInput.name}"`);
          else nextStepParts.push(`  • Brand name: NOT FOUND — ask the user`);
          if (rawInput.colors.primary) nextStepParts.push(`  • Primary color: ${rawInput.colors.primary}`);
          else nextStepParts.push(`  • Primary color: NOT FOUND — ask the user for a hex value`);
          nextStepParts.push(`  • Personality: ${rawInput.personality.join(", ")}`);
          if (rawInput.colors.secondary) nextStepParts.push(`  • Secondary color: ${rawInput.colors.secondary}`);
          if (rawInput.industry) nextStepParts.push(`  • Industry: ${rawInput.industry}`);
          if (missing.length > 0) nextStepParts.push(`Missing required values: ${missing.join(", ")} — ask the user before proceeding.`);
          nextStepParts.push(
            missing.length === 0
              ? `Once confirmed, call nib_brand_init again with the confirmed values (and preview omitted or false).`
              : `Do NOT call nib_brand_init until all missing values are provided by the user.`,
          );

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                preview: true,
                detected: {
                  brandName: rawInput.name,
                  primaryColor: rawInput.colors.primary,
                  secondaryColor: rawInput.colors.secondary ?? null,
                  accentColor: rawInput.colors.accent ?? null,
                  personality: rawInput.personality,
                  fonts: rawInput.fonts,
                  industry: rawInput.industry,
                  description: rawInput.description,
                },
                confidence,
                missing,
                nextStep: nextStepParts.join("\n"),
              }, null, 2),
            }],
          };
        }

        // ── Validate required fields before full init ─────────────────────
        if (missing.length > 0) {
          return errorResult(
            `Cannot initialize: missing required values — ${missing.join(", ")}. ` +
            `Call nib_brand_init with preview: true first to see what was detected, then ask the user for the missing values.`,
          );
        }

        // ── Build final BrandInput and run init ───────────────────────────
        const { init } = await import("../../brand/index.js");
        const brandInput = {
          name: rawInput.name!,
          personality: rawInput.personality as import("../../types/brand.js").BrandPersonality[],
          colors: {
            primary: rawInput.colors.primary!,
            secondary: rawInput.colors.secondary,
            accent: rawInput.colors.accent,
          },
          typography: {
            fontFamily: rawInput.fonts[0] ?? "Inter",
            monoFontFamily: rawInput.fonts.find(f => /mono|code|consolas|fira|jetbrains/i.test(f)),
          },
          description: rawInput.description ?? undefined,
          industry: rawInput.industry ?? undefined,
        };

        const config = await init(brandInput, { from, output, ai, noAi: noAi ?? false });

        // Inject nib context into all detected AI agent config files
        const { injectAgentContext } = await import("../../brand/writer.js");
        const contextFiles = await injectAgentContext(config).catch(() => [] as string[]);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              brand: config.brand.name,
              tokens: config.tokens,
              output: config.output,
              platforms: config.platforms,
              contextFilesUpdated: contextFiles,
              nextStep:
                "Call nib_brand_audit to verify WCAG AA compliance. If it passes, call nib_brand_push to create the Pencil design file. " +
                (contextFiles.length > 0
                  ? `AI agent context injected into: ${contextFiles.join(", ")} — future sessions will automatically read brand.md before writing UI.`
                  : "No AI agent config files found — consider adding CLAUDE.md, .cursorrules, or .github/copilot-instructions.md so agents use brand tokens automatically."),
            }, null, 2),
          }],
        };
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
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
        const auditPassed = report.failed === 0;
        const nextStep = auditPassed
          ? "All pairs pass. Call nib_brand_push to create or update the Pencil design file with these tokens."
          : `${report.failed} pair(s) fail WCAG ${level ?? "AA"}. Fix the failing tokens (adjust lightness/darkness), then re-run nib_brand_audit before pushing.`;
        return {
          content: [{ type: "text", text: JSON.stringify({ ...report, nextStep }, null, 2) }],
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
              `Created ${result.penFile} — brand tokens loaded as Pencil variables (150+ tokens: colors, typography, spacing).`,
              `The canvas is empty by design: nib only sets variables, not visual frames.`,
              `Save the file now in Pencil (Cmd+S), then call nib_kit to get component recipes`,
              `and use Pencil's batch_design tool to scaffold the component frames into this file.`,
            ].join(" ")
          : `Tokens pushed to ${result.penFile}. Save the file in Pencil (Cmd+S) to persist changes.`;
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
