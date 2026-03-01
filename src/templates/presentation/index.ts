/**
 * Presentation template — slide-deck style prototype viewer.
 *
 * Features:
 * - Dark background, centered canvas
 * - Progress bar (top) + slide counter
 * - Prev/Next arrows + fullscreen button
 * - CSS transitions (opacity + transform) between slides
 * - Keyboard: ←→ arrows, Space to advance, F for fullscreen
 * - Hotspot links from nib.config.json
 * - Theme toggle if design defines themes
 */

import type { Template, TemplateContext } from "../base/types.js";
import { navigationScript, themeToggleHtml } from "../base/navigation.js";

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const presentationTemplate: Template = {
  name: "presentation",
  description: "Slide-deck with progress bar, transitions, and fullscreen",

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
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  background: #1a1a1a;
  color: #fff;
  font-family: system-ui, -apple-system, sans-serif;
}

/* Progress bar */
.nib-progress {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  background: #4f8fff;
  transition: width 0.3s ease;
  z-index: 100;
}

/* Slide area */
.nib-presentation {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

/* Canvas slides */
.nib-canvas {
  display: none;
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.nib-canvas.active {
  display: block;
}

/* Bottom controls */
.nib-controls {
  position: fixed;
  bottom: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  background: rgba(0, 0, 0, 0.7);
  padding: 8px 20px;
  border-radius: 24px;
  z-index: 100;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.nib-controls button {
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  font-size: 18px;
  padding: 4px 8px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.nib-controls button:hover {
  opacity: 1;
}

.nib-counter {
  font-size: 14px;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}

${ctx.css}
</style>
</head>
<body>
<div class="nib-progress" id="nib-progress"></div>
<div class="nib-presentation">
${ctx.canvasHtml}
</div>
<div class="nib-controls">
  <button id="nib-prev" aria-label="Previous">&#8592;</button>
  <span class="nib-counter" id="nib-counter"></span>
  <button id="nib-next" aria-label="Next">&#8594;</button>
  <button id="nib-fullscreen" aria-label="Fullscreen">&#x26F6;</button>
</div>
${ctx.hasThemes ? themeToggleHtml() : ""}
${navigationScript(ctx.canvases, ctx.config)}
</body>
</html>`;
  },
};
