import { defineCommand } from "citty";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve, basename } from "node:path";
import pc from "picocolors";
import { capture } from "../../capture/index.js";

export const exportCommand = defineCommand({
  meta: {
    name: "export",
    description: "Full pipeline: .pen → HTML prototype (MCP → capture → build)",
  },
  args: {
    files: {
      type: "positional",
      description: "Path(s) to .pen file(s)",
      required: true,
    },
    output: {
      type: "string",
      alias: "o",
      description: "Output directory (default: ./prototype)",
    },
    template: {
      type: "string",
      alias: "t",
      description: "Template to use: clean, presentation (default: clean)",
    },
    standalone: {
      type: "boolean",
      description: "Embed all assets for offline use",
      default: false,
    },
    device: {
      type: "string",
      alias: "d",
      description: "Device frame name",
    },
    config: {
      type: "string",
      description: "Path to nib.config.json",
    },
  },
  async run({ args }) {
    const fileArgs = args._ ?? [args.files];
    const files = (Array.isArray(fileArgs) ? fileArgs : [fileArgs]) as string[];
    const outputDir = resolve((args.output as string) ?? "./prototype");
    const template = (args.template as "clean" | "presentation") ?? "clean";

    for (const file of files) {
      console.log(pc.cyan("nib export"), pc.dim(file));

      // Step 1: Capture
      const doc = await capture({ file });

      // Step 2: Build
      const { build } = await import("../../build/index.js");

      // Write intermediate JSON to temp location
      const tmpJson = resolve(outputDir, `.${basename(file, ".pen")}.design.json`);
      await mkdir(outputDir, { recursive: true });
      await writeFile(tmpJson, JSON.stringify(doc, null, 2));

      const result = await build({
        input: tmpJson,
        output: outputDir,
        template,
        standalone: args.standalone as boolean,
        device: args.device as string | undefined,
        config: args.config as string | undefined,
      });

      console.log(
        pc.green("✓"),
        `Exported ${doc.canvases.length} canvas${doc.canvases.length === 1 ? "" : "es"}`,
        pc.dim(`→ ${result.outputDir}`),
      );
    }
  },
});
