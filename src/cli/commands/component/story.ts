/**
 * `nib component story <name>` — generate a .stories.ts scaffold from a component contract.
 *
 * Reads .nib/components/<Name>.contract.json and writes src/stories/<Name>.stories.ts.
 */

import { defineCommand } from "citty";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pc from "picocolors";
import { ExitCode } from "../../exit-codes.js";

export const storyCommand = defineCommand({
  meta: {
    name: "story",
    description: "Generate a .stories.ts scaffold from a component contract",
  },
  args: {
    name: {
      type: "positional",
      description: "Component name (e.g. Button, Badge, TextInput)",
      required: true,
    },
    output: {
      type: "string",
      alias: "o",
      description: "Output path (default: src/stories/<Name>.stories.ts)",
    },
    framework: {
      type: "string",
      description: "Override framework detection: react | vue3 | svelte | web-components",
    },
    overwrite: {
      type: "boolean",
      description: "Overwrite if file already exists",
      default: false,
    },
  },
  async run({ args }) {
    const { generateStory } = await import("../../../storybook/index.js");
    const cwd = process.cwd();
    const name = args.name as string;
    const overwrite = args.overwrite as boolean;

    // --- Find contract file (case-insensitive) ---
    const componentsDir = join(cwd, ".nib", "components");
    if (!existsSync(componentsDir)) {
      console.error(pc.red("✗") + ` No .nib/components/ directory found. Run ${pc.cyan("nib component init <name>")} first.`);
      process.exit(ExitCode.ERROR);
    }

    const files = await readdir(componentsDir);
    const contractFile = files.find(
      f => f.toLowerCase() === `${name.toLowerCase()}.contract.json`,
    );

    if (!contractFile) {
      console.error(pc.red("✗") + ` No contract found for "${name}".`);
      console.error(`  Available contracts: ${files.filter(f => f.endsWith(".contract.json")).map(f => f.replace(".contract.json", "")).join(", ")}`);
      process.exit(ExitCode.ERROR);
    }

    const contractPath = join(componentsDir, contractFile);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contract = JSON.parse(await readFile(contractPath, "utf8")) as any;

    // --- Detect framework ---
    let framework: "react" | "vue3" | "svelte" | "web-components" | "unknown" = "react";
    if (args.framework) {
      framework = args.framework as typeof framework;
    } else {
      const pkgPath = join(cwd, "package.json");
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if ("vue" in deps) framework = "vue3";
        else if ("svelte" in deps) framework = "svelte";
        else if ("lit" in deps) framework = "web-components";
        else if ("react" in deps) framework = "react";
        else framework = "unknown";
      }
    }

    // --- Determine output path ---
    const componentName = (contract.name as string | undefined) ?? name;
    const outputPath = (args.output as string | undefined) ?? join(cwd, "src", "stories", `${componentName}.stories.ts`);

    if (existsSync(outputPath) && !overwrite) {
      console.error(pc.red("✗") + ` File already exists: ${outputPath}`);
      console.error(`  Use ${pc.cyan("--overwrite")} to replace it.`);
      process.exit(ExitCode.ERROR);
    }

    // --- Generate ---
    const content = generateStory(contract, { framework });

    await mkdir(join(outputPath, ".."), { recursive: true });
    await writeFile(outputPath, content);

    console.log(pc.green("✓") + ` ${componentName}.stories.ts written to ${pc.cyan(outputPath)}`);
    console.log(`  Framework: ${framework} | Variants: ${Object.keys(contract.variants ?? {}).length} | States: ${Object.keys(contract.states ?? {}).length - 1}`);
    console.log(`  ${pc.dim("Replace the PLACEHOLDER import with your real component.")}`);
  },
});
