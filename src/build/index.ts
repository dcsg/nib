/**
 * Build pipeline — transforms a DesignDocument JSON into an HTML prototype.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import type { DesignDocument } from "../types/design.js";
import type { BuildOptions } from "../types/options.js";
import type { NibConfig } from "../types/config.js";
import { generateCss } from "./css-generator.js";
import { generateHtml } from "./html-generator.js";
import { resolveVariableCss } from "./variable-resolver.js";
import { collectAssetLinks } from "./asset-collector.js";

export interface BuildResult {
  outputDir: string;
  files: string[];
}

export async function build(options: BuildOptions): Promise<BuildResult> {
  const inputPath = resolve(options.input);
  const raw = await readFile(inputPath, "utf-8");
  const doc: DesignDocument = JSON.parse(raw);

  const outputDir = resolve(options.output ?? "./prototype");
  await mkdir(outputDir, { recursive: true });

  // Load nib.config.json if provided
  let config: NibConfig | undefined;
  if (options.config) {
    const configRaw = await readFile(resolve(options.config), "utf-8");
    config = JSON.parse(configRaw);
  }

  const template = options.template ?? "clean";

  // Generate CSS for variables
  const variableCss = resolveVariableCss(doc.variables, doc.themes);

  // Collect CDN links for fonts and icons
  const assetLinks = collectAssetLinks(doc.assets, options.standalone ?? false);

  // Generate per-canvas CSS and the full HTML
  const canvasCssBlocks: string[] = [];
  for (const canvas of doc.canvases) {
    canvasCssBlocks.push(generateCss(canvas));
  }

  const css = [variableCss, ...canvasCssBlocks].join("\n\n");
  const html = generateHtml(doc, { template, css, assetLinks, config });

  const indexPath = resolve(outputDir, "index.html");
  await writeFile(indexPath, html);

  const files = [indexPath];

  return { outputDir, files };
}
