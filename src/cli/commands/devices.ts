import { defineCommand } from "citty";
import pc from "picocolors";
import { DEVICES } from "../../templates/index.js";

export const devicesCommand = defineCommand({
  meta: {
    name: "devices",
    description: "List available device frames",
  },
  async run() {
    console.log(pc.cyan("Available devices:\n"));
    for (const device of DEVICES) {
      console.log(
        `  ${pc.bold(device.name.padEnd(24))} ${pc.dim(`${device.width}×${device.height}`)}  ${pc.dim(device.category)}`,
      );
    }
  },
});
