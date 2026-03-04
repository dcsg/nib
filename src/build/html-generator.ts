/**
 * Generates the full HTML document from a DesignDocument.
 *
 * Node → HTML mapping:
 *   frame      → <div>
 *   text       → <p> or <h1>/<h2>/<h3> (fontSize heuristic)
 *   rectangle  → <div>
 *   ellipse    → <div>
 *   path       → <svg><path>
 *   icon_font  → <span class="material-symbols-*"> or <i data-lucide="...">
 *   image      → <div> with background-image (via CSS)
 *   group      → <div>
 */

import type { DesignDocument, DesignCanvas, ResolvedNode } from "../types/design.js";
import type { NibConfig } from "../types/config.js";
import { getTemplate } from "../templates/index.js";

export interface HtmlOptions {
  template: "clean" | "presentation";
  css: string;
  assetLinks: string[];
  config?: NibConfig;
}

export function generateHtml(doc: DesignDocument, options: HtmlOptions): string {
  const { template: templateName, css, assetLinks, config } = options;
  const title = config?.title ?? "Prototype";
  const hasThemes = Object.keys(doc.themes?.axes ?? {}).length > 0;

  const canvasHtml = doc.canvases
    .map((c, i) => renderCanvas(c, i))
    .join("\n");

  const template = getTemplate(templateName);
  return template.render({ title, css, assetLinks, canvasHtml, canvases: doc.canvases, hasThemes, config });
}

// ─── Node Rendering ───────────────────────────────────────────────────

function renderCanvas(canvas: DesignCanvas, index: number): string {
  const children = canvas.children.map((n) => renderNode(n)).join("\n");
  return `<div id="canvas-${esc(canvas.id)}" class="nib-canvas" data-index="${index}" data-name="${escAttr(canvas.name)}">\n${children}\n</div>`;
}

function renderNode(node: ResolvedNode): string {
  const id = `n-${esc(node.id)}`;

  switch (node.type) {
    case "text":
      return renderText(node, id);
    case "path":
      return renderPath(node, id);
    case "icon_font":
      return renderIcon(node, id);
    default:
      return renderDiv(node, id);
  }
}

function renderText(node: ResolvedNode, id: string): string {
  const text = escHtml(node.text ?? "");
  const fontSize = node.textStyle?.fontSize ?? 16;

  if (fontSize >= 32) return `<h1 id="${id}">${text}</h1>`;
  if (fontSize >= 24) return `<h2 id="${id}">${text}</h2>`;
  if (fontSize >= 20) return `<h3 id="${id}">${text}</h3>`;
  return `<p id="${id}">${text}</p>`;
}

function renderPath(node: ResolvedNode, id: string): string {
  if (!node.pathData) return `<div id="${id}"></div>`;

  const w = typeof node.width === "number" ? node.width : 24;
  const h = typeof node.height === "number" ? node.height : 24;
  const fill = node.fills?.[0]?.color ?? "currentColor";

  return `<svg id="${id}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none"><path d="${escAttr(node.pathData)}" fill="${escAttr(fill)}"/></svg>`;
}

function renderIcon(node: ResolvedNode, id: string): string {
  const family = node.iconFamily?.toLowerCase() ?? "";
  const name = node.iconName ?? "";

  if (family.includes("material")) {
    const style = node.iconStyle ?? "outlined";
    return `<span id="${id}" class="material-symbols-${style}">${escHtml(name)}</span>`;
  }
  if (family.includes("lucide")) {
    return `<i id="${id}" data-lucide="${escAttr(name)}"></i>`;
  }
  return `<span id="${id}" class="icon">${escHtml(name)}</span>`;
}

function renderDiv(node: ResolvedNode, id: string): string {
  const children = node.children?.map((n) => renderNode(n)).join("\n") ?? "";
  const hotspotAttr = node.name ? ` data-node-name="${escAttr(node.name)}"` : "";
  return `<div id="${id}"${hotspotAttr}>${children ? `\n${children}\n` : ""}</div>`;
}

// ─── Escaping helpers ─────────────────────────────────────────────────

function esc(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
