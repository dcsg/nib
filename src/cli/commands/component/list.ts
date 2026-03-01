/**
 * `nib component list` — read-only listing of the component registry.
 *
 * Reads brand.config.json and prints a table of:
 * name / widget type / status / state count
 */

import { defineCommand } from "citty";
import pc from "picocolors";

export const listComponentCommand = defineCommand({
  meta: {
    name: "list",
    description: "List all components in the registry",
  },
  args: {
    config: {
      type: "string",
      description: "Path to brand.config.json (default: .nib/brand.config.json)",
    },
  },
  async run({ args }) {
    const { readFile } = await import("node:fs/promises");
    const { existsSync } = await import("node:fs");
    const { resolve, join } = await import("node:path");

    const configPath = (args.config as string | undefined) ?? resolve(".nib", "brand.config.json");

    if (!existsSync(configPath)) {
      console.log(pc.yellow("  No brand config found."), pc.dim(`(expected: ${configPath})`));
      console.log(pc.dim("  Run `nib brand init` first, then `nib component init <Name>`."));
      return;
    }

    let config: {
      components?: Record<
        string,
        {
          contractPath: string;
          widgetType: string;
          status: string;
          addedAt: string;
        }
      >;
    };

    try {
      const raw = await readFile(configPath, "utf-8");
      config = JSON.parse(raw) as typeof config;
    } catch (err) {
      console.error(pc.red("  Failed to read brand config:"), String(err));
      process.exitCode = 1;
      return;
    }

    const components = config.components ?? {};
    const entries = Object.entries(components);

    if (entries.length === 0) {
      console.log(pc.dim("  No components defined yet."));
      console.log(pc.dim("  Run `nib component init <Name>` to scaffold your first component."));
      return;
    }

    // Load state counts for each component
    const stateCountMap: Record<string, number> = {};
    for (const [name, entry] of entries) {
      const contractPath = resolve(entry.contractPath);
      if (existsSync(contractPath)) {
        try {
          const raw = await readFile(contractPath, "utf-8");
          const contract = JSON.parse(raw) as { states?: Record<string, unknown> };
          stateCountMap[name] = Object.keys(contract.states ?? {}).length;
        } catch {
          stateCountMap[name] = 0;
        }
      } else {
        stateCountMap[name] = 0;
      }
    }

    console.log();
    console.log(pc.bold("Component Registry"));
    console.log(pc.dim("─".repeat(70)));

    // Column widths
    const nameW = Math.max(9, ...entries.map(([n]) => n.length)) + 2;
    const typeW = Math.max(11, ...entries.map(([, e]) => e.widgetType.length)) + 2;
    const statusW = Math.max(6, ...entries.map(([, e]) => e.status.length)) + 2;

    const header = [
      "Component".padEnd(nameW),
      "Widget Type".padEnd(typeW),
      "Status".padEnd(statusW),
      "States",
    ].join(" ");

    console.log(pc.dim(header));
    console.log(pc.dim("─".repeat(70)));

    for (const [name, entry] of entries) {
      const statusColor =
        entry.status === "stable"
          ? pc.green
          : entry.status === "deprecated"
            ? pc.red
            : pc.yellow;

      const stateCount = stateCountMap[name] ?? 0;

      const row = [
        pc.bold(name.padEnd(nameW)),
        entry.widgetType.padEnd(typeW),
        statusColor(entry.status.padEnd(statusW)),
        String(stateCount),
      ].join(" ");

      console.log(row);
    }

    console.log(pc.dim("─".repeat(70)));
    console.log(pc.dim(`  ${entries.length} component${entries.length === 1 ? "" : "s"} registered`));
    console.log();
  },
});
