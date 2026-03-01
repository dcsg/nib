/**
 * `nib doctor` — check environment readiness and report failures with remediation.
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — one or more failures
 */

import { defineCommand } from "citty";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import pc from "picocolors";
import { ExitCode } from "../exit-codes.js";
import { writeResult } from "../output.js";

const execFileAsync = promisify(execFile);

interface CheckResult {
  label: string;
  pass: boolean;
  detail: string;
  fix?: string;
}

/** Check nib version — injected at build time */
function checkNibVersion(): CheckResult {
  return {
    label: "nib version",
    pass: true,
    detail: `v${__NIB_VERSION__}`,
    fix: `npm i -g nib@latest`,
  };
}

/** Check brand.config.json exists */
async function checkBrandConfig(): Promise<CheckResult> {
  const configPath = resolve(".nib", "brand.config.json");
  const exists = existsSync(configPath);
  if (!exists) {
    return {
      label: "Brand config",
      pass: false,
      detail: "No .nib/brand.config.json",
      fix: "Run `nib brand init` to create a brand system",
    };
  }

  try {
    const raw = await readFile(configPath, "utf-8");
    JSON.parse(raw);
    return { label: "Brand config", pass: true, detail: ".nib/brand.config.json" };
  } catch {
    return {
      label: "Brand config",
      pass: false,
      detail: ".nib/brand.config.json is not valid JSON",
      fix: "Re-run `nib brand init` or fix the JSON manually",
    };
  }
}

/** Check token output directory exists and is non-empty */
async function checkTokenOutput(): Promise<CheckResult> {
  const configPath = resolve(".nib", "brand.config.json");
  if (!existsSync(configPath)) {
    return {
      label: "Token output",
      pass: false,
      detail: "No brand config — can't check tokens",
      fix: "Run `nib brand init` first",
    };
  }

  let tokensDir: string;
  try {
    const raw = await readFile(configPath, "utf-8");
    const config = JSON.parse(raw) as { tokens: string };
    tokensDir = config.tokens;
  } catch {
    return {
      label: "Token output",
      pass: false,
      detail: "Could not read tokens path from brand.config.json",
    };
  }

  if (!existsSync(tokensDir)) {
    return {
      label: "Token output",
      pass: false,
      detail: `${tokensDir} does not exist`,
      fix: "Run `nib brand build` to generate tokens",
    };
  }

  try {
    const entries = await readdir(tokensDir);
    if (entries.length === 0) {
      return {
        label: "Token output",
        pass: false,
        detail: `${tokensDir} is empty`,
        fix: "Run `nib brand build` to generate tokens",
      };
    }
    return { label: "Token output", pass: true, detail: tokensDir };
  } catch {
    return {
      label: "Token output",
      pass: false,
      detail: `Could not read ${tokensDir}`,
    };
  }
}

/** Check MCP config exists (Pencil design tool) */
async function checkMcpConfig(): Promise<{ result: CheckResult; hasConfig: boolean }> {
  const mcpLocations = [
    resolve(".claude", "settings.json"),
    resolve("mcp.json"),
    resolve(".mcp.json"),
    resolve(".cursor", "mcp.json"),
    resolve(process.env["HOME"] ?? "~", ".claude", "settings.json"),
  ];

  for (const loc of mcpLocations) {
    if (existsSync(loc)) {
      return {
        result: { label: "MCP config", pass: true, detail: loc },
        hasConfig: true,
      };
    }
  }

  return {
    result: {
      label: "MCP config",
      pass: false,
      detail: "No MCP config found",
      fix: "Check .claude/settings.json or mcp.json — see docs for setup instructions",
    },
    hasConfig: false,
  };
}

/** Check nib MCP server config exists in agent config files */
function checkNibMcpServer(): CheckResult {
  const nibMcpLocations = [
    { path: resolve(".mcp.json"), key: "mcpServers" },
    { path: resolve(".vscode", "mcp.json"), key: "servers" },
    { path: resolve(".cursor", "mcp.json"), key: "mcpServers" },
  ];

  for (const { path, key } of nibMcpLocations) {
    if (!existsSync(path)) continue;
    try {
      const raw = require("node:fs").readFileSync(path, "utf-8") as string;
      const config = JSON.parse(raw) as Record<string, Record<string, unknown>>;
      const servers = config[key];
      if (servers && "nib" in servers) {
        return { label: "nib MCP server", pass: true, detail: path };
      }
    } catch {
      continue;
    }
  }

  return {
    label: "nib MCP server",
    pass: false,
    detail: "No nib MCP server config found",
    fix: "Add nib to .mcp.json, .vscode/mcp.json, or .cursor/mcp.json — see docs",
  };
}

/** Check Pencil MCP connectivity — real probe via get_editor_state */
async function checkMcpConnectivity(hasConfig: boolean): Promise<CheckResult> {
  if (!hasConfig) {
    return {
      label: "Pencil MCP",
      pass: false,
      detail: "Skipped (no MCP config)",
      fix: "Configure MCP first",
    };
  }

  const { probePencilMcp, probeStatusLabel, probeFix } = await import("../../mcp/probe.js");
  const probe = await probePencilMcp();

  return {
    label: "Pencil MCP",
    pass: probe.responding,
    detail: probeStatusLabel(probe) + (probe.binaryPath ? ` (${probe.binaryPath})` : ""),
    fix: probeFix(probe),
  };
}

/** Check which AI provider is available */
async function checkAiProvider(): Promise<CheckResult> {
  const hasAnthropicKey = Boolean(process.env["ANTHROPIC_API_KEY"]);
  const hasOpenAiKey = Boolean(process.env["OPENAI_API_KEY"]);
  const hasOllamaUrl = Boolean(process.env["NIB_AI_BASE_URL"]);

  if (hasAnthropicKey) {
    return { label: "AI provider", pass: true, detail: "anthropic (ANTHROPIC_API_KEY)" };
  }
  if (hasOpenAiKey) {
    return { label: "AI provider", pass: true, detail: "openai (OPENAI_API_KEY)" };
  }
  if (hasOllamaUrl) {
    return { label: "AI provider", pass: true, detail: "ollama (NIB_AI_BASE_URL)" };
  }

  // Zero-config fallback: check for claude binary
  const { isClaudeCodeAvailable } = await import("../../brand/ai/index.js");
  if (isClaudeCodeAvailable()) {
    return { label: "AI provider", pass: true, detail: "claude-code (Claude Code detected in PATH)" };
  }

  return {
    label: "AI provider",
    pass: false,
    detail: "No API key or Claude Code installation found",
    fix: "Set ANTHROPIC_API_KEY, or install Claude Code — or use `--no-ai` to skip AI enhancement",
  };
}

/** Check Node/Bun version */
async function checkRuntime(): Promise<CheckResult> {
  // Check Bun first (preferred)
  try {
    const { stdout } = await execFileAsync("bun", ["--version"]);
    const version = stdout.trim();
    const [major, minor] = version.replace("v", "").split(".").map(Number);

    // Bun 1.0+ required
    if ((major ?? 0) >= 1) {
      return { label: "Runtime (Bun)", pass: true, detail: `v${version}` };
    }
    return {
      label: "Runtime (Bun)",
      pass: false,
      detail: `Bun v${version} is too old`,
      fix: "Upgrade to Bun 1.0+: curl -fsSL https://bun.sh/install | bash",
    };
  } catch {
    // Bun not found, check Node
  }

  try {
    const { stdout } = await execFileAsync("node", ["--version"]);
    const version = stdout.trim().replace("v", "");
    const major = parseInt(version.split(".")[0] ?? "0", 10);

    if (major >= 20) {
      return { label: "Runtime (Node)", pass: true, detail: `v${version}` };
    }
    return {
      label: "Runtime (Node)",
      pass: false,
      detail: `Node v${version} is too old (requires v20+)`,
      fix: "Upgrade to Node 20+: https://nodejs.org or use nvm",
    };
  } catch {
    return {
      label: "Runtime",
      pass: false,
      detail: "Neither Bun nor Node found in PATH",
      fix: "Install Bun: curl -fsSL https://bun.sh/install | bash",
    };
  }
}

export const doctorCommand = defineCommand({
  meta: {
    name: "doctor",
    description: "Check environment readiness — nib version, config, MCP, API key, runtime",
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

    // Run all checks
    const nibVersion = checkNibVersion();
    const [brandConfig, tokenOutput, runtime, aiProvider] = await Promise.all([
      checkBrandConfig(),
      checkTokenOutput(),
      checkRuntime(),
      checkAiProvider(),
    ]);

    const { result: mcpConfig, hasConfig } = await checkMcpConfig();
    const mcpConnectivity = await checkMcpConnectivity(hasConfig);
    const nibMcpServer = checkNibMcpServer();

    const checks: CheckResult[] = [
      nibVersion,
      brandConfig,
      tokenOutput,
      mcpConfig,
      mcpConnectivity,
      nibMcpServer,
      aiProvider,
      runtime,
    ];

    const failures = checks.filter((c) => !c.pass);
    const allPass = failures.length === 0;

    if (json) {
      writeResult("doctor", { pass: allPass, checks }, { json: true });
      if (!allPass) process.exitCode = ExitCode.ERROR;
      return;
    }

    console.log();
    console.log(pc.bold("nib doctor"));
    console.log();

    // Render results
    for (const check of checks) {
      const icon = check.pass ? pc.green("  ✓") : pc.red("  ✗");
      const label = pc.bold(check.label.padEnd(22));
      const detail = check.pass ? pc.dim(check.detail) : pc.red(check.detail);
      console.log(`${icon} ${label} ${detail}`);
      if (!check.pass && check.fix) {
        console.log(`       ${pc.dim("→")} ${pc.dim(check.fix)}`);
      }
    }

    console.log();

    if (allPass) {
      console.log(pc.green("  All checks passed."), pc.dim("Your environment is ready."));
    } else {
      console.log(
        pc.red(`  ${failures.length} check${failures.length !== 1 ? "s" : ""} failed.`),
        pc.dim("Fix the issues above and re-run nib doctor."),
      );
      process.exitCode = ExitCode.ERROR;
    }

    console.log();
  },
});
