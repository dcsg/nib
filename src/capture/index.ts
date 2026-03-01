/**
 * Capture pipeline — reads a .pen file via MCP and produces a DesignDocument.
 */

import { resolve } from "node:path";
import type { DesignDocument, DesignCanvas } from "../types/design.js";
import type { CaptureOptions } from "../types/options.js";
import { discoverPencilMcp } from "../mcp/discover.js";
import { withMcpClient } from "../mcp/client.js";
import { readPenFile } from "./reader.js";
import { normalizeVariables } from "./variables.js";
import { normalizeNodes } from "./normalizer.js";

export async function capture(options: CaptureOptions): Promise<DesignDocument> {
  const filePath = resolve(options.file);
  const config = await discoverPencilMcp();

  return withMcpClient(config, async (client) => {
    const raw = await readPenFile(client, filePath);

    // Normalize variables and themes
    const { variables, themes } = normalizeVariables(raw.variables);

    // Normalize each canvas
    const canvases: DesignCanvas[] = raw.canvases
      .filter((c) => {
        if (!options.canvases?.length) return true;
        return options.canvases.includes(c.name);
      })
      .map((c) => ({
        id: c.id,
        name: c.name,
        width: c.width,
        height: c.height,
        backgroundColor: c.backgroundColor,
        children: normalizeNodes(c.children, raw.components),
      }));

    // Collect resolved components (for reference in DesignDocument)
    const components: DesignDocument["components"] = {};
    for (const [id, comp] of Object.entries(raw.components)) {
      const normalized = normalizeNodes([comp], raw.components);
      if (normalized[0]) {
        components[id] = normalized[0];
      }
    }

    // Detect assets (fonts, icon families) from the tree
    const assets = collectAssets(canvases);

    return {
      version: "1",
      source: filePath,
      capturedAt: new Date().toISOString(),
      canvases,
      components,
      variables,
      themes,
      assets,
    };
  });
}

/** Scan the resolved tree to detect font families and icon font usage */
function collectAssets(canvases: DesignCanvas[]): DesignDocument["assets"] {
  const fonts = new Set<string>();
  const iconFamilies = new Set<string>();

  function walk(node: { textStyle?: { fontFamily?: string }; iconFamily?: string; children?: unknown[] }) {
    if (node.textStyle?.fontFamily) fonts.add(node.textStyle.fontFamily);
    if (node.iconFamily) iconFamilies.add(node.iconFamily);
    if (Array.isArray(node.children)) {
      for (const child of node.children) walk(child as typeof node);
    }
  }

  for (const canvas of canvases) {
    for (const child of canvas.children) walk(child);
  }

  const assets: DesignDocument["assets"] = [];

  for (const family of fonts) {
    assets.push({ type: "font", family, provider: "google" });
  }

  for (const family of iconFamilies) {
    const provider = family.toLowerCase().includes("material") ? "material"
      : family.toLowerCase().includes("lucide") ? "lucide"
      : "custom";
    assets.push({ type: "icon_font", family, provider });
  }

  return assets;
}
