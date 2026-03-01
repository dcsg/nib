import { defineCommand } from "citty";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import pc from "picocolors";
import { capture } from "../../capture/index.js";
import { writeResult } from "../output.js";
import { ExitCode } from "../exit-codes.js";

export const captureCommand = defineCommand({
  meta: {
    name: "capture",
    description: "Extract a .pen file into intermediate JSON (requires Pencil open)",
  },
  args: {
    file: {
      type: "positional",
      description: "Path to the .pen file",
      required: true,
    },
    output: {
      type: "string",
      alias: "o",
      description: "Output path for the JSON file (default: <filename>.design.json)",
    },
    canvases: {
      type: "string",
      alias: "c",
      description: "Comma-separated canvas names to capture (default: all)",
    },
    json: {
      type: "boolean",
      description: "Output captured DesignDocument as JSON envelope (machine-readable)",
      default: false,
    },
  },
  async run({ args }) {
    const file = args.file as string;
    const json = args.json as boolean;
    const canvases = args.canvases ? (args.canvases as string).split(",").map((s) => s.trim()) : undefined;
    const output = (args.output as string) ?? file.replace(/\.pen$/, ".design.json");
    const outputPath = resolve(output);

    if (!json) console.log(pc.cyan("nib capture"), pc.dim(file));

    try {
      const doc = await capture({ file, canvases });
      await writeFile(outputPath, JSON.stringify(doc, null, 2));

      if (json) {
        writeResult("capture", doc, { json: true });
        return;
      }

      console.log(
        pc.green("✓"),
        `Captured ${doc.canvases.length} canvas${doc.canvases.length === 1 ? "" : "es"}`,
        pc.dim(`→ ${outputPath}`),
      );
      console.log(
        pc.dim("  Next: run"),
        pc.cyan(`nib build ${outputPath}`),
        pc.dim("to generate the HTML prototype (no Pencil needed for that step)"),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isPencilError =
        message.includes("Could not find Pencil MCP server") ||
        message.includes("not respond") ||
        message.includes("ENOENT") ||
        message.includes("spawn");

      if (!json) {
        console.error();
        console.error(pc.red("✗"), "Capture failed");

        if (isPencilError) {
          console.error();
          console.error(pc.bold("  Pencil.app must be open to run capture."));
          console.error();
          console.error(pc.dim("  Steps to fix:"));
          console.error(pc.dim("  1. Open Pencil.app"));
          console.error(pc.dim(`  2. Open your design file: ${file}`));
          console.error(pc.dim("     (or run: ") + pc.cyan(`nib pencil open ${file}`) + pc.dim(")"));
          console.error(pc.dim("  3. Re-run:"), pc.cyan(`nib capture ${file}`));
          console.error();
          console.error(
            pc.dim("  Once captured, rebuilding the prototype is fully offline:"),
          );
          console.error(pc.cyan(`  nib build ${outputPath}`), pc.dim("(no Pencil needed)"));
        } else {
          console.error(pc.dim(`  ${message}`));
        }
      }

      process.exitCode = ExitCode.ERROR;
    }
  },
});
