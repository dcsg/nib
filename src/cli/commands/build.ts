import { defineCommand } from "citty";
import pc from "picocolors";
import { writeResult } from "../output.js";

export const buildCommand = defineCommand({
  meta: {
    name: "build",
    description: "Build an HTML prototype from a design JSON file (offline, no MCP)",
  },
  args: {
    input: {
      type: "positional",
      description: "Path to the .design.json file",
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
    json: {
      type: "boolean",
      description: "Output build result as JSON envelope (machine-readable)",
      default: false,
    },
  },
  async run({ args }) {
    const { build } = await import("../../build/index.js");
    const input = args.input as string;
    const json = args.json as boolean;

    if (!json) console.log(pc.cyan("nib build"), pc.dim(input));

    const result = await build({
      input,
      output: args.output as string | undefined,
      template: (args.template as "clean" | "presentation") ?? "clean",
      standalone: args.standalone as boolean,
      device: args.device as string | undefined,
      config: args.config as string | undefined,
    });

    if (json) {
      writeResult("build", result, { json: true });
      return;
    }

    console.log(pc.green("✓"), `Built prototype`, pc.dim(`→ ${result.outputDir}`));
  },
});
