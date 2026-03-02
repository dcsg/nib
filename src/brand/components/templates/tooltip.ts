/**
 * WAI-ARIA template: tooltip
 *
 * Keyboard: Displayed on focus (not hover-only); Escape → dismiss
 * Focus behavior: not independently focusable — its trigger receives focus
 * Reference: https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
 */

import type { ComponentContract } from "../../../types/brand.js";

export const tooltipTemplate: Partial<ComponentContract> = {
  description: "A small popup that displays information about another element on hover or focus",
  widgetType: "tooltip",
  anatomy: {
    trigger: "The element that shows/hides the tooltip (not part of the tooltip itself)",
    root: "The tooltip popup container (role=tooltip)",
    content: "The text content of the tooltip",
    arrow: "Optional directional arrow pointing to the trigger",
  },
  variants: {
    default: "Standard tooltip",
    rich: "Tooltip with structured content (not plain text)",
  },
  states: {
    hidden: { description: "Tooltip is not visible" },
    visible: { description: "Tooltip is displayed — triggered by focus OR hover (never hover-only)" },
  },
  interaction: {
    role: "tooltip",
  },
  a11y: {
    role: "tooltip",
    keyboard: {
      Escape: "Dismisses the tooltip without moving focus",
      Tab: "Showing on focus is required — tooltip must appear when trigger receives keyboard focus",
    },
    focusBehavior: "not-focusable",
    focusTrap: false,
    focusReturnTarget: null,
    minimumTouchTarget: { ios: "44pt", android: "48dp", web: "24px" },
    ariaAttributes: ["aria-describedby"],
    requiredLabel: false,
    labelStrategy: "content-describes-trigger-via-aria-describedby",
  },
  slots: {
    content: {
      description: "Tooltip text — supplementary, never essential. Keep under 80 chars.",
      required: true,
      accepts: "text",
      maxLength: 80,
      truncatable: false,
    },
  },
  tokens: {
    root: {
      visible: {
        background: "tooltip.bg",
        color: "tooltip.text",
        "border-radius": "tooltip.radius",
        shadow: "tooltip.shadow",
      },
    },
  },
  visualClass: "interactive-control",
  variantMatrix: { theme: ["dark", "light"] },
};
