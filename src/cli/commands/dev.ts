import { defineCommand } from "citty";
import pc from "picocolors";

export const devCommand = defineCommand({
  meta: {
    name: "dev",
    description: "Start a local dev server with hot-reload on .pen changes",
  },
  args: {
    file: {
      type: "positional",
      description: "Path to the .pen file",
      required: true,
    },
    port: {
      type: "string",
      alias: "p",
      description: "Port for the dev server (default: 3142)",
    },
    template: {
      type: "string",
      alias: "t",
      description: "Template to use: clean, presentation (default: clean)",
    },
    open: {
      type: "boolean",
      description: "Open browser automatically",
      default: true,
    },
  },
  async run({ args }) {
    const { startDevServer } = await import("../../dev-server/server.js");
    const file = args.file as string;

    console.log(pc.cyan("nib dev"), pc.dim(file));

    await startDevServer({
      file,
      port: args.port ? parseInt(args.port as string, 10) : undefined,
      template: (args.template as "clean" | "presentation") ?? "clean",
      open: args.open as boolean,
    });
  },
});
