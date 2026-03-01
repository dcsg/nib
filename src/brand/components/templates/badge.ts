/**
 * Widget template: badge / tag
 *
 * Display-only label used for status, category, or metadata.
 * Optional dismiss action makes it interactive.
 * Reference: https://www.w3.org/WAI/ARIA/apg/patterns/
 */

import type { ComponentContract } from "../../../types/brand.js";

export const badgeTemplate: Partial<ComponentContract> = {
  description: "A small label used to convey status, category, or metadata at a glance",
  widgetType: "badge",
  anatomy: {
    root: "The outer badge element",
    label: "The text content of the badge",
    icon: "Optional leading icon",
    dismissButton: "Optional button to remove the badge (makes badge interactive)",
  },
  variants: {
    neutral: "Default — no semantic meaning",
    success: "Positive outcome or active status",
    warning: "Caution or degraded state",
    error: "Failure or blocked state",
    info: "Informational or in-progress state",
  },
  sizes: {
    sm: { height: "20px", "font-size": "{font-size.xs}" },
    md: { height: "24px", "font-size": "{font-size.sm}" },
  },
  states: {
    default: { description: "Resting display state" },
    dismissible: { description: "Badge can be removed — dismiss button is visible" },
  },
  a11y: {
    role: "img",
    keyboard: {
      Tab: "Moves focus to dismiss button when present",
      Space: "Activates dismiss button when focused",
      Enter: "Activates dismiss button when focused",
    },
    focusBehavior: "not-focusable",
    focusTrap: false,
    focusReturnTarget: null,
    minimumTouchTarget: { ios: "44pt", android: "48dp", web: "24px" },
    ariaAttributes: ["aria-label"],
    requiredLabel: false,
    labelStrategy: "content-is-label — if icon-only badge, aria-label required",
  },
  slots: {
    label: {
      description: "Badge text — keep short and scannable",
      required: true,
      accepts: "text",
      maxLength: 30,
      truncatable: false,
    },
    icon: {
      description: "Leading icon for visual reinforcement of meaning",
      required: false,
      accepts: "icon",
    },
    dismissAction: {
      description: "Callback triggered when the badge is dismissed",
      required: false,
      accepts: "action",
    },
  },
  tokens: {
    root: {
      default: {
        background: "badge.bg.neutral",
        color: "badge.text.neutral",
        "border-radius": "badge.radius",
      },
    },
  },
};
