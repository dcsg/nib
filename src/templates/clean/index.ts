/**
 * Clean template — minimal HTML prototype with no chrome.
 *
 * Features:
 * - Absolute-positioned canvas layer
 * - Click anywhere to advance, arrow keys to navigate
 * - Theme toggle if design defines themes
 * - Good for embedding in iframes or standalone viewing
 */

import type { Template, TemplateContext } from "../base/types.js";
import { navigationScript, themeToggleHtml } from "../base/navigation.js";

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const cleanTemplate: Template = {
  name: "clean",
  description: "Minimal HTML, no chrome — click or arrow keys to navigate",

  render(ctx: TemplateContext): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(ctx.title)}</title>
${ctx.assetLinks.join("\n")}
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: #f0f0f0;
}

.nib-canvas {
  display: none;
}

.nib-canvas.active {
  display: block;
}

${ctx.css}
</style>
</head>
<body>
${ctx.canvasHtml}
${ctx.hasThemes ? themeToggleHtml() : ""}
${navigationScript(ctx.canvases, ctx.config)}
</body>
</html>`;
  },
};
