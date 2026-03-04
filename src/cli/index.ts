import { defineCommand, runMain } from "citty";

// Intercept --mcp before citty routing (ADR-002)
if (process.argv.includes("--mcp")) {
  const { startMcpServer } = await import("../mcp/server.js");
  await startMcpServer();
} else {
  const { captureCommand } = await import("./commands/capture.js");
  const { buildCommand } = await import("./commands/build.js");
  const { prototypeCommand } = await import("./commands/prototype.js");
  const { devCommand } = await import("./commands/dev.js");
  const { devicesCommand } = await import("./commands/devices.js");
  const { templatesCommand } = await import("./commands/templates.js");
  const { brandCommand } = await import("./commands/brand.js");
  const { statusCommand } = await import("./commands/status.js");
  const { doctorCommand } = await import("./commands/doctor.js");
  const { componentCommand } = await import("./commands/component.js");
  const { kitCommand } = await import("./commands/kit.js");
  const { pencilCommand } = await import("./commands/pencil.js");
  const { storybookCommand } = await import("./commands/storybook.js");

  const main = defineCommand({
    meta: {
      name: "nib",
      version: __NIB_VERSION__,
      description:
        "Your design control plane — brand systems, design tokens, interactive prototypes & more",
    },
    subCommands: {
      kit: kitCommand,
      pencil: pencilCommand,
      prototype: prototypeCommand,
      capture: captureCommand,
      build: buildCommand,
      dev: devCommand,
      devices: devicesCommand,
      templates: templatesCommand,
      brand: brandCommand,
      component: componentCommand,
      storybook: storybookCommand,
      status: statusCommand,
      doctor: doctorCommand,
    },
  });

  runMain(main);
}
