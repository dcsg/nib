/**
 * Discovers the Pencil MCP server binary by searching known config locations.
 *
 * Priority order:
 * 1. NIB_PENCIL_MCP env var (explicit override)
 * 2. ~/.kiro/settings/mcp.json
 * 3. ~/.cursor/mcp.json
 * 4. ~/Library/Application Support/Claude/claude_desktop_config.json
 * 5. .vscode/mcp.json in CWD
 * 6. .mcp.json in CWD
 * 7. Known binary fallback: /Applications/Pencil.app/.../mcp-server-darwin-arm64
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface McpConfigFile {
  mcpServers?: Record<string, McpServerConfig>;
}

const KNOWN_BINARY =
  "/Applications/Pencil.app/Contents/Resources/app.asar.unpacked/out/mcp-server-darwin-arm64";

function configPaths(): string[] {
  const home = homedir();
  return [
    join(home, ".kiro", "settings", "mcp.json"),
    join(home, ".cursor", "mcp.json"),
    join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
    resolve(".vscode", "mcp.json"),
    resolve(".mcp.json"),
  ];
}

async function readJsonSafe(path: string): Promise<unknown | null> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractPencilServer(data: unknown): McpServerConfig | null {
  if (!data || typeof data !== "object") return null;
  const config = data as McpConfigFile;
  const pencil = config.mcpServers?.["pencil"];
  if (!pencil?.command) return null;
  return {
    command: pencil.command,
    args: pencil.args ?? [],
    env: pencil.env,
  };
}

export async function discoverPencilMcp(): Promise<McpServerConfig> {
  // 1. Explicit env override
  const envPath = process.env["NIB_PENCIL_MCP"];
  if (envPath) {
    if (!existsSync(envPath)) {
      throw new Error(`NIB_PENCIL_MCP points to non-existent path: ${envPath}`);
    }
    return { command: envPath, args: ["--app", "desktop"] };
  }

  // 2-6. Search config files
  for (const configPath of configPaths()) {
    if (!existsSync(configPath)) continue;
    const data = await readJsonSafe(configPath);
    const server = extractPencilServer(data);
    if (server && existsSync(server.command)) {
      return server;
    }
  }

  // 7. Known binary fallback
  if (existsSync(KNOWN_BINARY)) {
    return { command: KNOWN_BINARY, args: ["--app", "desktop"] };
  }

  throw new Error(
    [
      "Could not find Pencil MCP server.",
      "Make sure Pencil.app is installed, or set NIB_PENCIL_MCP to the binary path.",
      "",
      "Searched:",
      ...configPaths().map((p) => `  - ${p}`),
      `  - ${KNOWN_BINARY}`,
    ].join("\n"),
  );
}
