/**
 * `nib brand validate` — validate DTCG token files against quality gates.
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — one or more errors
 *   2 — validate command itself failed (config not found, file not parseable)
 */

import { defineCommand } from "citty";
import pc from "picocolors";
import { ExitCode } from "../../exit-codes.js";

/** Safe fallback when running via `bun src/cli/index.ts` (dev mode without tsup define). */
const NIB_VERSION = typeof __NIB_VERSION__ !== "undefined" ? __NIB_VERSION__ : "0.0.0-dev";

export const validateCommand = defineCommand({
  meta: {
    name: "validate",
    description: "Validate DTCG token files against schema, naming, and quality gates",
  },
  args: {
    "tokens-dir": {
      type: "string",
      description: "Path to tokens directory (default: from brand.config.json)",
    },
    format: {
      type: "string",
      description: "Output format: text (default), json, sarif, or github",
      default: "text",
    },
    "fail-on": {
      type: "string",
      description: "Which checks to fail on: all (default), schema, naming, required, a11y, components",
      default: "all",
    },
    config: {
      type: "string",
      description: "Path to brand.config.json (default: .nib/brand.config.json)",
    },
  },
  async run({ args }) {
    try {
      const format = (args["format"] as string) ?? "text";
      const failOn = (args["fail-on"] as string) ?? "all";
      const configPath = args["config"] as string | undefined;

      // Resolve tokens directory and component registry
      let tokensDir = args["tokens-dir"] as string | undefined;
      let componentRegistry: import("../../../types/brand.js").ComponentRegistry | undefined;

      if (!tokensDir) {
        const { loadBrandConfig } = await import("../../../brand/index.js");
        try {
          const config = await loadBrandConfig(configPath);
          tokensDir = config.tokens;
          componentRegistry = config.components;
        } catch {
          const fatal = "No brand.config.json found. Run nib brand init or pass --tokens-dir.";
          if (format === "json") {
            console.log(JSON.stringify({ valid: false, errors: [], warnings: [], fatal }));
          } else if (format === "sarif") {
            const { toSarif } = await import("../../../brand/validate/formatters/sarif.js");
            console.log(JSON.stringify(toSarif({ valid: false, errors: [{ check: "fatal", token: "config", message: fatal }], warnings: [] }, NIB_VERSION), null, 2));
          } else if (format === "github") {
            process.stdout.write(`::error title=fatal::${fatal}\n`);
          } else {
            console.error(pc.red("✖"), "No brand.config.json found. Run", pc.cyan("nib brand init"), "or pass", pc.dim("--tokens-dir <path>"));
          }
          process.exitCode = ExitCode.USAGE;
          return;
        }
      }

      const { validateTokens } = await import("../../../brand/validate/index.js");
      const result = await validateTokens({
        tokensDir,
        failOn: failOn as "all" | "schema" | "naming" | "required" | "a11y" | "components",
        componentRegistry,
      });

      // Write validate status to .nib/.status.json
      try {
        const { mkdir, readFile, writeFile } = await import("node:fs/promises");
        const { existsSync } = await import("node:fs");
        const { resolve } = await import("node:path");
        const nibDir = resolve(".nib");
        const statusPath = resolve(".nib", ".status.json");
        let status: Record<string, unknown> = {};
        if (existsSync(statusPath)) {
          try {
            const raw = await readFile(statusPath, "utf-8");
            status = JSON.parse(raw) as Record<string, unknown>;
          } catch { /* ignore */ }
        }
        status["lastValidate"] = { timestamp: new Date().toISOString(), valid: result.valid };
        await mkdir(nibDir, { recursive: true });
        await writeFile(statusPath, JSON.stringify(status, null, 2) + "\n");
      } catch { /* status update is best-effort */ }

      if (format === "json") {
        console.log(JSON.stringify(result, null, 2));
      } else if (format === "sarif") {
        const { toSarif } = await import("../../../brand/validate/formatters/sarif.js");
        console.log(JSON.stringify(toSarif(result, NIB_VERSION), null, 2));
      } else if (format === "github") {
        const { toGithubAnnotations } = await import("../../../brand/validate/formatters/github.js");
        const annotations = toGithubAnnotations(result);
        if (annotations) process.stdout.write(annotations + "\n");
      } else {
        // Text output
        if (result.valid && result.warnings.length === 0) {
          console.log(pc.green("✓"), pc.bold("nib brand validate"), pc.green("— all checks passed"));
        } else {
          if (!result.valid) {
            console.log(pc.red("✖"), pc.bold("nib brand validate"));
          } else {
            console.log(pc.yellow("⚠"), pc.bold("nib brand validate"), pc.yellow("— warnings"));
          }

          for (const err of result.errors) {
            console.log(pc.dim(`   ${err.check}`), pc.red(err.token) + ":", err.message);
          }
          for (const warn of result.warnings) {
            console.log(pc.dim(`   ${warn.check}`), pc.yellow(warn.token) + ":", warn.message);
          }

          const errorCount = result.errors.length;
          const warnCount = result.warnings.length;
          console.log();
          console.log(
            pc.dim(`   ${errorCount} error${errorCount !== 1 ? "s" : ""}, ${warnCount} warning${warnCount !== 1 ? "s" : ""}`),
          );

          console.log(pc.dim("   Run with --format json for machine-readable output."));
        }
      }

      if (!result.valid) {
        process.exitCode = ExitCode.ERROR;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const format = (args["format"] as string) ?? "text";
      if (format === "json") {
        console.log(JSON.stringify({ valid: false, errors: [], warnings: [], fatal: message }));
      } else if (format === "sarif") {
        const { toSarif } = await import("../../../brand/validate/formatters/sarif.js");
        console.log(JSON.stringify(toSarif({ valid: false, errors: [{ check: "fatal", token: "validate", message }], warnings: [] }, NIB_VERSION), null, 2));
      } else if (format === "github") {
        process.stdout.write(`::error title=fatal::${message}\n`);
      } else {
        console.error(pc.red("✖"), "validate failed:", message);
      }
      process.exitCode = ExitCode.USAGE;
    }
  },
});
