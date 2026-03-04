/**
 * `nib storybook` — CLI command suite for Storybook integration.
 *
 * Subcommands: init
 */

import { defineCommand } from "citty";
import pc from "picocolors";
import { ExitCode } from "../exit-codes.js";

const initCommand = defineCommand({
  meta: {
    name: "init",
    description: "Wire up Storybook with nib brand tokens, theme switching, and the design token panel",
  },
  args: {
    cwd: {
      type: "string",
      description: "Project root directory (default: current working directory)",
    },
  },
  async run({ args }) {
    const { storybookInit } = await import("../../storybook/index.js");
    const cwd = (args.cwd as string | undefined) ?? process.cwd();

    let result;
    try {
      result = await storybookInit(cwd);
    } catch (err) {
      console.error(pc.red("✗") + " " + (err instanceof Error ? err.message : String(err)));
      process.exit(ExitCode.ERROR);
    }

    console.log("");
    console.log(pc.bold(pc.green("✓ Storybook integration configured")));
    console.log(`  Brand: ${pc.cyan(result.framework)} / SB ${result.sbVersion} / ${result.packageManager}`);
    console.log("");

    if (result.filesCreated.length > 0) {
      console.log(pc.bold("  Files created:"));
      for (const f of result.filesCreated) {
        console.log(`    ${pc.green("+")} ${f}`);
      }
    }

    if (result.filesPatched.length > 0) {
      console.log(pc.bold("  Files patched:"));
      for (const f of result.filesPatched) {
        console.log(`    ${pc.yellow("~")} ${f}`);
      }
    }

    if (result.warnings.length > 0) {
      console.log("");
      console.log(pc.bold(pc.yellow("  Warnings:")));
      for (const w of result.warnings) {
        console.log(pc.yellow("  ! " + w));
      }
    }

    console.log("");
    console.log(pc.bold("  Next: install addons"));
    console.log(`    ${pc.cyan(result.installCommand)}`);
    console.log("");
    console.log(
      `  Then set ${pc.cyan('"storybook": { "annotations": true }')} in ${pc.cyan(".nib/brand.config.json")} ` +
      `and run ${pc.cyan("nib brand build")} to enable the design token panel.`,
    );
    console.log("");
  },
});

export const storybookCommand = defineCommand({
  meta: {
    name: "storybook",
    description: "Storybook integration — wire brand tokens and generate story scaffolds",
  },
  subCommands: {
    init: initCommand,
  },
});
