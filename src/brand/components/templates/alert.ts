/**
 * Widget template: alert / banner
 *
 * A persistent inline feedback message — stays visible until dismissed or resolved.
 * Unlike toast, alert does not auto-dismiss. It can be page-level or inline within a form.
 * Reference: https://www.w3.org/WAI/ARIA/apg/patterns/alert/
 */

import type { ComponentContract } from "../../../types/brand.js";

export const alertTemplate: Partial<ComponentContract> = {
  description:
    "A persistent inline message that communicates status or guidance — stays visible until the condition changes or the user dismisses it",
  widgetType: "alert",
  anatomy: {
    root: "The alert container (role=alert or role=status)",
    icon: "Semantic icon matching the variant",
    title: "Optional heading that summarises the situation",
    description: "The full explanatory text",
    actions: "Optional action buttons (e.g. Retry, Go to settings)",
    dismissButton: "Optional dismiss control (not present when alert is critical)",
  },
  variants: {
    info: "Neutral guidance or contextual information — role=status",
    success: "Confirmation that an operation succeeded — role=status",
    warning: "Caution — user should act but is not blocked — role=alert",
    error: "Failure or blocking problem — role=alert",
  },
  states: {
    default: { description: "Alert is visible and active" },
    dismissed: { description: "Alert has been manually dismissed (not present in DOM)" },
  },
  a11y: {
    role: "alert",
    keyboard: {
      Tab: "Moves focus to actions or dismiss button within the alert",
      Escape: "Dismisses the alert if it is dismissible",
    },
    focusBehavior: "not-focusable",
    focusTrap: false,
    focusReturnTarget: null,
    minimumTouchTarget: { ios: "44pt", android: "48dp", web: "24px" },
    ariaAttributes: ["aria-live", "aria-atomic", "aria-label", "aria-labelledby", "aria-describedby"],
    requiredLabel: false,
    labelStrategy:
      "description-text-is-accessible — if icon-only, aria-label on root required",
  },
  slots: {
    description: {
      description: "The full alert message — must be understandable without the title",
      required: true,
      accepts: "text",
      maxLength: 300,
      truncatable: false,
    },
    title: {
      description: "Short heading that summarises the situation",
      required: false,
      accepts: "text",
      maxLength: 60,
      truncatable: false,
    },
    actions: {
      description: "One or two action buttons — keep to a maximum of two",
      required: false,
      accepts: "component",
    },
    icon: {
      description: "Semantic icon — strongly recommended for all variants",
      required: false,
      accepts: "icon",
    },
  },
  tokens: {
    root: {
      default: {
        background: "color.background.secondary",
        "border-color": "color.border.primary",
        color: "color.text.primary",
        "border-radius": "border-radius.md",
      },
    },
  },
  visualClass: "inline-contextual",
  variantMatrix: { intent: ["info", "success", "warning", "error"] },
  constraints: { closeGlyph: "ascii-safe" },
};
