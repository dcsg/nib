/**
 * nib brand validate — orchestrate all validation checks.
 */

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ComponentContract, ComponentRegistry, ValidationResult } from "../../types/brand.js";
import {
  checkV01,
  checkV02,
  checkV03,
  checkV04,
  checkV05,
  checkV06,
  checkV07,
  checkV08,
  checkV09,
  checkV10,
  checkV11,
  flattenForValidation,
} from "./checks.js";

export type ValidateFailOn = "all" | "schema" | "naming" | "required" | "a11y" | "components";

export interface ValidateOptions {
  /** Directory containing DTCG token files */
  tokensDir: string;
  /** Which check categories to fail on (default: all) */
  failOn?: ValidateFailOn;
  /** Component registry from brand.config.json (optional) */
  componentRegistry?: ComponentRegistry;
}

/** Recursively read all .json files from a directory */
async function readTokenFilesFromDir(
  dir: string,
): Promise<Record<string, Record<string, unknown>>> {
  const files: Record<string, Record<string, unknown>> = {};

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        const content = await readFile(fullPath, "utf-8");
        files[fullPath] = JSON.parse(content) as Record<string, unknown>;
      }
    }
  }

  await walk(dir);
  return files;
}

/** Load all component contracts from the registry */
async function loadComponentContracts(
  registry: ComponentRegistry,
): Promise<Map<string, ComponentContract>> {
  const contracts = new Map<string, ComponentContract>();

  await Promise.all(
    Object.entries(registry).map(async ([name, entry]) => {
      const contractPath = resolve(entry.contractPath);
      if (!existsSync(contractPath)) return;
      try {
        const raw = await readFile(contractPath, "utf-8");
        const contract = JSON.parse(raw) as ComponentContract;
        contracts.set(name, contract);
      } catch {
        // Invalid contract file — skip; V-08 will catch missing required fields
      }
    }),
  );

  return contracts;
}

/**
 * Run all validation checks against the token files in `tokensDir`.
 * If a component registry is provided, also runs V-08 through V-11.
 * Returns a ValidationResult with all errors and warnings.
 */
export async function validateTokens(options: ValidateOptions): Promise<ValidationResult> {
  const tokenFiles = await readTokenFilesFromDir(options.tokensDir);

  // Flatten all tokens across all files
  const allTokens = Object.values(tokenFiles).flatMap((file) =>
    flattenForValidation(file as Record<string, unknown>),
  );

  // Build a set of all token paths for V-10 reference checking
  const allTokenPaths = new Set(allTokens.map((t) => t.path));

  const errors = [
    ...checkV01(allTokens),
    ...checkV02(tokenFiles),
    ...checkV03(allTokens),
    ...checkV04(allTokens),
    ...checkV05(allTokens),
    ...checkV07(allTokens),
  ];

  const warnings = [
    ...checkV06(allTokens),
  ];

  // Component checks (V-08 through V-11) — only when registry is present
  if (options.componentRegistry && Object.keys(options.componentRegistry).length > 0) {
    const contracts = await loadComponentContracts(options.componentRegistry);

    errors.push(
      ...checkV08(contracts),
      ...checkV09(contracts),
      ...checkV10(contracts, allTokenPaths),
      ...checkV11(contracts),
    );
  }

  // Filter based on failOn
  const failOn = options.failOn ?? "all";
  const checkFilter: Record<ValidateFailOn, (check: string) => boolean> = {
    all: () => true,
    schema: (c) => c === "V-01" || c === "V-07",
    naming: (c) => c === "V-04",
    required: (c) => c === "V-02" || c === "V-03" || c === "V-05",
    a11y: (c) => c === "V-06" || c === "V-09",
    components: (c) => c === "V-08" || c === "V-09" || c === "V-10" || c === "V-11",
  };

  const filter = checkFilter[failOn];
  const filteredErrors = errors.filter((e) => filter(e.check));
  const filteredWarnings = warnings.filter((w) => filter(w.check));

  return {
    valid: filteredErrors.length === 0,
    errors: filteredErrors,
    warnings: filteredWarnings,
  };
}
