/**
 * Template interface — every template implements this contract.
 */

import type { DesignCanvas } from "../../types/design.js";
import type { NibConfig } from "../../types/config.js";

export interface TemplateContext {
  title: string;
  css: string;
  assetLinks: string[];
  canvasHtml: string;
  canvases: DesignCanvas[];
  hasThemes: boolean;
  config?: NibConfig;
}

export interface Template {
  name: string;
  description: string;
  render(ctx: TemplateContext): string;
}
