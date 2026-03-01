/**
 * `nib brand` — CLI command suite for the brand system generator.
 *
 * Subcommands: init, build, push, audit, validate
 */

import { defineCommand } from "citty";
import pc from "picocolors";
import type { AiProviderName } from "../../types/brand.js";
import { ExitCode } from "../exit-codes.js";
import { writeResult } from "../output.js";
import { validateCommand } from "./brand/validate.js";

const initCommand = defineCommand({
  meta: {
    name: "init",
    description: "Generate a brand system from brand guidelines",
  },
  args: {
    from: {
      type: "string",
      description: "Source: path to .md/.txt/.pdf file, or a URL",
    },
    ai: {
      type: "string",
      description: "AI provider: anthropic, openai, ollama (default: anthropic)",
    },
    output: {
      type: "string",
      alias: "o",
      description: "Output directory (default: docs/design/system)",
    },
    "no-ai": {
      type: "boolean",
      description: "Skip AI enhancement, use only algorithmic derivation",
      default: false,
    },
    json: {
      type: "boolean",
      description: "Output as JSON envelope (machine-readable)",
      default: false,
    },
  },
  async run({ args }) {
    const { init } = await import("../../brand/index.js");
    const from = args.from as string | undefined;
    const noAi = args["no-ai"] as boolean;
    const json = args.json as boolean;

    let input;

    if (!from) {
      // Interactive mode
      if (!json) console.log(pc.cyan("nib brand init"), pc.dim("(interactive)"));
      const { interactiveIntake } = await import("../../brand/intake/interactive.js");
      input = await interactiveIntake();
    } else if (from.startsWith("http://") || from.startsWith("https://")) {
      // URL mode
      if (!json) console.log(pc.cyan("nib brand init"), pc.dim(`from ${from}`));
      const { urlIntake } = await import("../../brand/intake/url.js");
      input = await urlIntake(from);
    } else if (from.endsWith(".pdf")) {
      // PDF mode
      if (!json) console.log(pc.cyan("nib brand init"), pc.dim(`from ${from}`));
      const { pdfIntake } = await import("../../brand/intake/pdf.js");
      input = await pdfIntake(from);
    } else {
      // Markdown/text mode
      if (!json) console.log(pc.cyan("nib brand init"), pc.dim(`from ${from}`));
      const { markdownIntake } = await import("../../brand/intake/markdown.js");
      input = await markdownIntake(from);
    }

    const config = await init(input, {
      from,
      ai: args.ai as AiProviderName | undefined,
      output: args.output as string | undefined,
      noAi,
    });

    const { injectAgentContext } = await import("../../brand/writer.js");
    const contextFiles = await injectAgentContext(config).catch(() => [] as string[]);

    if (json) {
      writeResult("brand init", { ...config, contextFiles }, { json: true });
      return;
    }

    console.log(pc.green("✓"), `Brand system generated for ${pc.bold(config.brand.name)}`);
    console.log(pc.dim(`  Tokens   → ${config.tokens}`));
    console.log(pc.dim(`  Docs     → ${config.output}`));
    console.log(pc.dim(`  Pencil   → ${config.platforms.penFile}`));
    console.log(pc.dim(`  Config   → .nib/brand.config.json`));
    if (contextFiles.length > 0) {
      console.log(pc.dim(`  AI context → ${contextFiles.join(", ")}`));
    }
  },
});

const buildBrandCommand = defineCommand({
  meta: {
    name: "build",
    description: "Build platform outputs (CSS, Tailwind) from design tokens",
  },
  args: {
    config: {
      type: "string",
      description: "Path to brand.config.json (default: .nib/brand.config.json)",
    },
    json: {
      type: "boolean",
      description: "Output as JSON envelope (machine-readable)",
      default: false,
    },
  },
  async run({ args }) {
    const json = args.json as boolean;
    if (!json) console.log(pc.cyan("nib brand build"));

    const { brandBuild, loadBrandConfig } = await import("../../brand/index.js");
    await brandBuild({ config: args.config as string | undefined });

    if (json) {
      const cfg = await loadBrandConfig(args.config as string | undefined);
      writeResult("brand build", {
        config: ".nib/brand.config.json",
        outputs: {
          css: cfg.platforms.css,
          tailwind: cfg.platforms.tailwind,
          pencil: cfg.platforms.pencil,
        },
      }, { json: true });
      return;
    }

    console.log(pc.green("✓"), "Built platform outputs");
  },
});

const pushCommand = defineCommand({
  meta: {
    name: "push",
    description: "Sync design tokens into a Pencil.dev .pen file",
  },
  args: {
    file: {
      type: "positional",
      description: "Path to .pen file (default: from brand.config.json)",
      required: false,
    },
    config: {
      type: "string",
      description: "Path to brand.config.json (default: .nib/brand.config.json)",
    },
  },
  async run({ args }) {
    const file = args.file as string | undefined;
    console.log(pc.cyan("nib brand push"), pc.dim(file ?? "(from config)"));

    const { brandPush } = await import("../../brand/index.js");
    const result = await brandPush({
      file,
      config: args.config as string | undefined,
    });

    const penDisplay = result.penFile.startsWith(process.cwd())
      ? result.penFile.slice(process.cwd().length + 1)
      : result.penFile;

    if (result.created) {
      console.log();
      console.log(pc.green("✓"), pc.bold("Design file created + opened in Pencil"));
      console.log(pc.dim(`   Path: ${penDisplay}`));
      console.log(pc.dim("   This is your canonical design file going forward."));
      console.log();
      console.log(pc.bold("  → Save it now:"), pc.cyan("Cmd+S"), pc.dim("in Pencil"));
      console.log(
        pc.dim("     Pencil has your tokens loaded — saving makes them permanent."),
      );
      console.log();
      console.log(pc.dim("  → Next steps:"));
      console.log(
        pc.dim("     Design your screens in this file, then run:"),
      );
      console.log(pc.cyan(`     nib capture ${penDisplay}`));
      console.log(pc.dim("     to build a clickable prototype."));
    } else {
      console.log(pc.green("✓"), `Tokens pushed to ${pc.dim(penDisplay)}`);
      console.log(pc.dim("  → Save in Pencil (Cmd+S) to persist changes"));
    }
  },
});

const auditCommand = defineCommand({
  meta: {
    name: "audit",
    description: "Check WCAG contrast compliance of color token pairs",
  },
  args: {
    config: {
      type: "string",
      description: "Path to brand.config.json (default: .nib/brand.config.json)",
    },
    level: {
      type: "string",
      description: "Minimum level: AA (default) or AAA",
      default: "AA",
    },
    json: {
      type: "boolean",
      description: "Output as JSON envelope (machine-readable)",
      default: false,
    },
  },
  async run({ args }) {
    const json = args.json as boolean;

    const { brandAudit } = await import("../../brand/index.js");
    const report = await brandAudit({
      config: args.config as string | undefined,
      level: (args.level as "AA" | "AAA") ?? "AA",
    });

    if (json) {
      writeResult("brand audit", report, { json: true });
      if (report.failed > 0) process.exitCode = ExitCode.ERROR;
      return;
    }

    console.log(pc.cyan("nib brand audit"));
    console.log();
    console.log(pc.bold("WCAG Contrast Audit"));
    console.log(pc.dim("─".repeat(60)));

    for (const result of report.results) {
      const icon = result.passAA ? pc.green("✓") : pc.red("✗");
      const ratio = result.ratio.toFixed(2);
      const label = `${result.foregroundToken} / ${result.backgroundToken}`;
      const ratioText = result.passAA ? pc.green(ratio) : pc.red(ratio);
      console.log(`  ${icon} ${ratio >= "4.50" ? ratioText : ratioText}:1  ${pc.dim(label)}`);
    }

    console.log(pc.dim("─".repeat(60)));
    console.log(
      `  ${pc.bold(String(report.passed))} passed, ${report.failed > 0 ? pc.red(pc.bold(String(report.failed))) : pc.bold(String(report.failed))} failed out of ${report.totalPairs} pairs`,
    );

    if (report.failed > 0) {
      process.exitCode = ExitCode.ERROR;
    }
  },
});

const styleCommand = defineCommand({
  meta: {
    name: "style",
    description: "Fetch a Pencil style guide and push tokens with standard variable mappings",
  },
  args: {
    tags: {
      type: "string",
      description: "Comma-separated style guide tags (e.g., minimal,webapp)",
    },
    name: {
      type: "string",
      description: "Style guide name to fetch directly",
    },
    file: {
      type: "string",
      description: "Path to .pen file (default: from brand.config.json)",
    },
    config: {
      type: "string",
      description: "Path to brand.config.json (default: .nib/brand.config.json)",
    },
  },
  async run({ args }) {
    const tags = args.tags as string | undefined;
    const name = args.name as string | undefined;

    const { brandStyle } = await import("../../brand/index.js");

    if (!tags && !name) {
      console.log(pc.cyan("nib brand style"), pc.dim("(listing tags)"));
      const result = await brandStyle();
      console.log(pc.bold("Available style guide tags:"));
      console.log(result.tags);
      return;
    }

    const parsedTags = tags?.split(",").map((t) => t.trim());
    console.log(
      pc.cyan("nib brand style"),
      pc.dim(name ? `name=${name}` : `tags=${parsedTags?.join(", ")}`),
    );

    const result = await brandStyle({
      tags: parsedTags,
      name,
      file: args.file as string | undefined,
      config: args.config as string | undefined,
    });

    console.log(pc.green("✓"), "Fetched style guide and pushed tokens");
    if (result.penFile) {
      console.log(pc.dim(`  Pencil → ${result.penFile}`));
    }
  },
});

const importCommand = defineCommand({
  meta: {
    name: "import",
    description: "Import variables from an existing Pencil .pen file into DTCG tokens + brand.config.json",
  },
  args: {
    file: {
      type: "positional",
      description: "Path to the .pen file to import from",
      required: true,
    },
    output: {
      type: "string",
      description: "Tokens output directory (default: docs/design/system/tokens)",
    },
    config: {
      type: "string",
      description: "Path to write brand.config.json (default: .nib/brand.config.json)",
    },
    json: {
      type: "boolean",
      description: "Output as JSON envelope (machine-readable)",
      default: false,
    },
  },
  async run({ args }) {
    const file = args.file as string;
    const json = args.json as boolean;

    console.log(pc.cyan("nib brand import"), pc.dim(file));

    const { brandImport } = await import("../../brand/import.js");

    // First call — diff check
    const result = await brandImport({
      file,
      output: args.output as string | undefined,
      config: args.config as string | undefined,
      overwrite: false,
    });

    if (result.requiresConfirmation) {
      console.log();
      console.log(pc.yellow("⚠"), "brand.config.json already exists:");
      console.log(pc.dim(`  Config:  ${result.configPath}`));
      console.log(pc.dim(`  Current brand: ${result.existingBrandName}`));
      console.log(pc.dim(`  Proposed brand: ${result.proposedBrandName}`));
      console.log(pc.dim(`  Current tokens: ${result.existingTokensDir}`));
      console.log(pc.dim(`  Proposed tokens: ${result.proposedTokensDir}`));
      console.log();

      // Interactive prompt
      const { default: readline } = await import("node:readline/promises");
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await rl.question("Overwrite? [y/N] ");
      rl.close();

      if (answer.toLowerCase() !== "y") {
        console.log(pc.dim("Aborted."));
        return;
      }

      // Re-run with overwrite
      const final = await brandImport({
        file,
        output: args.output as string | undefined,
        config: args.config as string | undefined,
        overwrite: true,
      });

      if (final.requiresConfirmation) return; // shouldn't happen

      if (json) {
        writeResult("brand import", final, { json: true });
        return;
      }

      console.log(pc.green("✓"), `Imported ${final.tokenCount} tokens from ${pc.bold(file)}`);
      console.log(pc.dim(`  Tokens  → ${final.tokensDir}`));
      console.log(pc.dim(`  Config  → ${final.configPath}`));
      console.log(pc.dim(`  Categories: ${final.categories.join(", ")}`));
      return;
    }

    if (json) {
      writeResult("brand import", result, { json: true });
      return;
    }

    console.log(pc.green("✓"), `Imported ${result.tokenCount} tokens from ${pc.bold(file)}`);
    console.log(pc.dim(`  Tokens  → ${result.tokensDir}`));
    console.log(pc.dim(`  Config  → ${result.configPath}`));
    console.log(pc.dim(`  Categories: ${result.categories.join(", ")}`));
  },
});

export const brandCommand = defineCommand({
  meta: {
    name: "brand",
    description: "AI-native brand system generator — design tokens, docs & platform outputs",
  },
  subCommands: {
    init: initCommand,
    build: buildBrandCommand,
    push: pushCommand,
    audit: auditCommand,
    style: styleCommand,
    validate: validateCommand,
    import: importCommand,
  },
});
