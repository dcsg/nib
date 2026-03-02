/**
 * Widget template: toast / snackbar
 *
 * A transient feedback message that appears and auto-dismisses.
 * Uses role="status" for info/success (polite) or role="alert" for warning/error (assertive).
 * Reference: https://www.w3.org/WAI/ARIA/apg/patterns/alert/
 */

import type { ComponentContract } from "../../../types/brand.js";

export const toastTemplate: Partial<ComponentContract> = {
  description:
    "A transient message that confirms an action or communicates status — auto-dismisses after a timeout",
  widgetType: "toast",
  anatomy: {
    root: "The toast container (role=status or role=alert)",
    icon: "Optional semantic icon matching the variant",
    title: "Optional short heading",
    message: "The primary message text",
    action: "Optional inline action (e.g. Undo, View)",
    dismissButton: "Optional manual dismiss control",
  },
  variants: {
    info: "Neutral information — role=status (polite live region)",
    success: "Positive outcome — role=status (polite live region)",
    warning: "Caution required — role=alert (assertive live region)",
    error: "Failure or blocking issue — role=alert (assertive live region)",
  },
  states: {
    entering: { description: "Toast is animating in" },
    visible: { description: "Toast is fully visible; timer is running" },
    dismissing: { description: "Toast is animating out" },
    dismissed: { description: "Toast has been removed from the DOM" },
  },
  a11y: {
    role: "status",
    keyboard: {
      Escape: "Dismisses the toast immediately",
      Tab: "Moves focus to the action or dismiss button within the toast",
    },
    focusBehavior: "not-focusable",
    focusTrap: false,
    focusReturnTarget: "previously-focused-element",
    minimumTouchTarget: { ios: "44pt", android: "48dp", web: "24px" },
    ariaAttributes: ["aria-live", "aria-atomic", "aria-label"],
    requiredLabel: false,
    labelStrategy: "message-text-is-accessible-via-live-region",
  },
  slots: {
    message: {
      description: "The primary feedback message — must make sense without the title",
      required: true,
      accepts: "text",
      maxLength: 120,
      truncatable: false,
    },
    title: {
      description: "Optional short heading for additional context",
      required: false,
      accepts: "text",
      maxLength: 50,
      truncatable: false,
    },
    action: {
      description: "Single inline action (e.g. Undo). Avoid more than one.",
      required: false,
      accepts: "action",
    },
    icon: {
      description: "Semantic icon matching variant — reinforces meaning for low-vision users",
      required: false,
      accepts: "icon",
    },
  },
  tokens: {
    root: {
      visible: {
        background: "toast.bg",
        color: "toast.text",
        "border-radius": "toast.radius",
        shadow: {
          offsetX: "0px",
          offsetY: "4px",
          blur: "16px",
          spread: "0px",
          color: "{color.shadow.default}",
        },
      },
    },
  },
  visualClass: "ephemeral-overlay",
  variantMatrix: { intent: ["info", "success", "warning", "error"] },
  constraints: { closeGlyph: "ascii-safe" },
  accentBar: { width: 4, fillToken: "$toast-accent" },
};
