import { defineCommand } from "citty";
import pc from "picocolors";
import { TEMPLATES } from "../../templates/index.js";

export const templatesCommand = defineCommand({
  meta: {
    name: "templates",
    description: "List available prototype templates",
  },
  async run() {
    console.log(pc.cyan("Available templates:\n"));
    for (const tmpl of TEMPLATES) {
      console.log(`  ${pc.bold(tmpl.name.padEnd(20))} ${pc.dim(tmpl.description)}`);
    }
  },
});
