/**
 * `nib status` — display design system health at a glance.
 *
 * Reads .nib/.status.json and .nib/brand.config.json, checks
 * disk presence of key artifacts, and shows environment readiness.
 */

import { defineCommand } from "citty";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pc from "picocolors";
import type { NibBrandConfig, NibStatus } from "../../types/brand.js";
import { writeResult } from "../output.js";

const CONFIG_PATH = ".nib/brand.config.json";
const STATUS_PATH = ".nib/.status.json";

function tick(ok: boolean): string {
  return ok ? pc.green("✓") : pc.red("✗");
}

function fmtDate(iso?: string): string {
  if (!iso) return pc.dim("never");
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtTokensDir(dir: string): string {
  // Show relative path if inside cwd
  const cwd = process.cwd();
  return dir.startsWith(cwd) ? dir.slice(cwd.length + 1) : dir;
}

export const statusCommand = defineCommand({
  meta: {
    name: "status",
    description: "Show design system health — config, tokens, last build, environment",
  },
  args: {
    json: {
      type: "boolean",
      description: "Output as JSON envelope (machine-readable)",
      default: false,
    },
  },
  async run({ args }) {
    const json = args.json as boolean;

    // Load config
    const configPath = resolve(CONFIG_PATH);
    const configExists = existsSync(configPath);

    let config: NibBrandConfig | undefined;
    if (configExists) {
      try {
        const raw = await readFile(configPath, "utf-8");
        config = JSON.parse(raw) as NibBrandConfig;
      } catch {
        // config exists but is malformed
      }
    }

    // Load status file
    const statusPath = resolve(STATUS_PATH);
    let status: NibStatus = {};
    if (existsSync(statusPath)) {
      try {
        const raw = await readFile(statusPath, "utf-8");
        status = JSON.parse(raw) as NibStatus;
      } catch {
        // status file malformed — ignore
      }
    }

    // Collect brand data
    const configOk = configExists && config !== undefined;
    const tokensDir = config?.tokens;
    const tokensExist = tokensDir ? existsSync(tokensDir) : false;
    const lastBuild = status.lastBuild;
    const audit = status.lastAudit;
    const lastValidate = status.lastValidate;
    const penFile = status.penFile ?? config?.platforms.penFile;
    const penExists = penFile ? existsSync(penFile) : false;

    // Collect environment data — real Pencil probe
    const { probePencilMcp, probeStatusLabel } = await import("../../mcp/probe.js");
    const pencilProbe = await probePencilMcp();
    const mcpOk = pencilProbe.responding;
    const mcpLabel = probeStatusLabel(pencilProbe);

    const { detectProvider } = await import("../../brand/ai/index.js");
    const aiProvider = detectProvider();

    // Collect warnings
    const warnings: string[] = [];
    if (!configOk) warnings.push("Brand config missing — run nib brand init");
    if (!tokensExist) warnings.push("Token output directory missing — run nib brand build");
    if (!audit) warnings.push("No WCAG audit on record — run nib brand audit");
    if (audit && audit.failed > 0) {
      warnings.push(`Last audit had ${audit.failed} WCAG failure${audit.failed !== 1 ? "s" : ""}`);
    }
    if (lastValidate && !lastValidate.valid) {
      warnings.push(`Last validate failed (${fmtDate(lastValidate.timestamp)}) — run nib brand validate`);
    }

    if (json) {
      writeResult("status", {
        brand: {
          configOk,
          brandName: config?.brand.name,
          tokensDir: tokensDir ?? null,
          tokensExist,
          lastBuild: lastBuild ?? null,
          lastAudit: audit ?? null,
          penFile: penFile ?? null,
          penExists,
        },
        environment: {
          mcpOk,
          mcpLabel,
          pencilBinaryFound: pencilProbe.binaryFound,
          aiProvider: aiProvider ?? null,
        },
        warnings,
      }, { json: true });
      return;
    }

    // -----------------------------------------------------------------------
    // Text output
    // -----------------------------------------------------------------------
    console.log();
    console.log(pc.bold("nib status"));
    console.log();

    console.log(pc.bold("  Brand"));

    console.log(
      `  ├─ Config:    `,
      configOk
        ? pc.dim(CONFIG_PATH) + " " + pc.green("✓")
        : pc.dim(CONFIG_PATH) + " " + pc.red("✗") + pc.dim(" (run nib brand init)"),
    );

    const tokensLabel = tokensDir
      ? pc.dim(fmtTokensDir(tokensDir))
      : pc.dim("(unknown)");
    const tokensStatus = tokensExist
      ? pc.green("✓") + (lastBuild ? pc.dim(`  (last built: ${fmtDate(lastBuild)})`) : "")
      : pc.red("✗") + pc.dim(" (run nib brand build)");
    console.log(`  ├─ Tokens:    `, tokensLabel, tokensStatus);

    if (audit) {
      const auditStr = `${fmtDate(audit.timestamp)}  ${pc.green(String(audit.passed))} passed, ${audit.failed > 0 ? pc.red(String(audit.failed)) : pc.dim("0")} failed`;
      console.log(`  ├─ Last audit:`, auditStr);
    } else {
      console.log(`  ├─ Last audit:`, pc.dim("never  (run nib brand audit)"));
    }

    if (penFile) {
      const penDisplay = penFile.startsWith(process.cwd()) ? penFile.slice(process.cwd().length + 1) : penFile;
      console.log(
        `  └─ Pen file:  `,
        pc.dim(penDisplay),
        penExists ? pc.green("✓") : pc.red("✗") + pc.dim(" (run nib brand push to create)"),
      );
    } else {
      console.log(`  └─ Pen file:  `, pc.dim("not configured"));
    }

    console.log();
    console.log(pc.bold("  Environment"));

    console.log(
      `  ├─ MCP:       `,
      mcpOk
        ? pc.green("✓") + pc.dim(` ${mcpLabel}`)
        : pc.red("✗") + pc.dim(" no MCP config found"),
    );

    const aiLabel = aiProvider ?? "none";
    console.log(
      `  └─ AI:        `,
      aiProvider
        ? pc.green("✓") + pc.dim(` ${aiLabel}`)
        : pc.yellow("⚠") + pc.dim(" no provider — set ANTHROPIC_API_KEY or install Claude Code"),
    );

    console.log();
    console.log(pc.bold("  Warnings"));
    if (warnings.length === 0) {
      console.log(`  └─`, pc.dim("none"));
    } else {
      warnings.forEach((w, i) => {
        const prefix = i === warnings.length - 1 ? "  └─" : "  ├─";
        console.log(prefix, pc.yellow(w));
      });
    }

    console.log();
  },
});
