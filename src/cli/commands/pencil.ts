/**
 * `nib pencil` — Pencil.app integration commands.
 *
 * Subcommands:
 *   open <file|new>   Open a .pen file in Pencil via MCP (or create a blank canvas)
 *   status            Check whether Pencil is running and MCP is responding
 */

import { defineCommand } from "citty";
import { resolve } from "node:path";
import pc from "picocolors";
import { ExitCode } from "../exit-codes.js";

const openCommand = defineCommand({
  meta: {
    name: "open",
    description: "Open a .pen file in Pencil (pass 'new' to create a blank canvas)",
  },
  args: {
    file: {
      type: "positional",
      description: "Path to a .pen file, or 'new' for a blank canvas",
      required: true,
    },
  },
  async run({ args }) {
    const fileArg = args.file as string;
    const isNew = fileArg === "new";
    const target = isNew ? "new" : resolve(fileArg);

    console.log(pc.cyan("nib pencil open"), pc.dim(isNew ? "(blank canvas)" : target));

    try {
      const { discoverPencilMcp } = await import("../../mcp/discover.js");
      const { withMcpClient } = await import("../../mcp/client.js");

      const mcpConfig = await discoverPencilMcp();
      const result = await withMcpClient(mcpConfig, async (client) => {
        return await client.openDocument(target);
      });

      console.log();
      if (isNew) {
        console.log(pc.green("✓"), "Blank canvas opened in Pencil");
        console.log();
        console.log(pc.bold("  → Save it now:"), pc.dim("Cmd+S in Pencil"));
        console.log(
          pc.dim("     Choose a path like"),
          pc.cyan("docs/design/system/design-system.pen"),
        );
        console.log(
          pc.dim("     Then run"),
          pc.cyan("nib brand push --file <that-path>"),
          pc.dim("to push your tokens into it"),
        );
      } else {
        console.log(pc.green("✓"), `Opened ${pc.dim(target)} in Pencil`);
        if (result) {
          console.log(pc.dim(`   ${result}`));
        }
        console.log();
        console.log(pc.dim("  Remember to save in Pencil (Cmd+S) after making changes"));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      // Check if it's a "Pencil not found" vs "Pencil not running" error
      if (message.includes("Could not find Pencil MCP server")) {
        console.error();
        console.error(pc.red("✗"), "Pencil.app is not installed or not configured");
        console.error();
        console.error(pc.dim("  1. Install Pencil.app from pencil.dev"));
        console.error(pc.dim("  2. Re-run this command"));
      } else {
        console.error();
        console.error(pc.red("✗"), "Pencil is not running");
        console.error();
        console.error(pc.dim("  1. Open Pencil.app"));
        console.error(pc.dim("  2. Re-run:"), pc.cyan(`nib pencil open ${fileArg}`));
      }

      process.exitCode = ExitCode.ERROR;
    }
  },
});

const pencilStatusCommand = defineCommand({
  meta: {
    name: "status",
    description: "Check whether Pencil.app is running and MCP is responding",
  },
  async run() {
    console.log(pc.cyan("nib pencil status"));
    console.log();

    const { probePencilMcp, probeStatusLabel, probeFix } = await import("../../mcp/probe.js");
    const result = await probePencilMcp();

    const icon = result.responding ? pc.green("✓") : result.binaryFound ? pc.yellow("⚠") : pc.red("✗");
    console.log(`  ${icon}`, probeStatusLabel(result));

    if (result.binaryPath) {
      console.log(pc.dim(`     Binary: ${result.binaryPath}`));
    }

    if (result.responding && result.editorState) {
      const state = result.editorState as Record<string, unknown>;
      const file = state["activeFile"] ?? state["filePath"] ?? state["file"] ?? null;
      if (file) {
        console.log(pc.dim(`     Active file: ${file}`));
      }
    }

    const fix = probeFix(result);
    if (fix) {
      console.log();
      console.log(pc.dim(`  → ${fix}`));
    }

    if (result.error && !result.responding) {
      console.log(pc.dim(`  Error: ${result.error}`));
    }

    console.log();

    if (!result.responding) {
      process.exitCode = ExitCode.ERROR;
    }
  },
});

export const pencilCommand = defineCommand({
  meta: {
    name: "pencil",
    description: "Pencil.app integration — open files, check connectivity",
  },
  subCommands: {
    open: openCommand,
    status: pencilStatusCommand,
  },
});
