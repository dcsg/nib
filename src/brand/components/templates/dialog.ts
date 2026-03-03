/**
 * WAI-ARIA template: dialog
 *
 * Keyboard: Tab/Shift+Tab → cycle within focus trap; Escape → close; focus returns to trigger on close
 * Focus behavior: focus-trap; initial focus on first focusable element or close button
 * Reference: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
 */

import type { ComponentContract } from "../../../types/brand.js";

export const dialogTemplate: Partial<ComponentContract> = {
  description: "A modal overlay that requires user interaction before the rest of the UI becomes accessible",
  widgetType: "dialog",
  anatomy: {
    root: "The dialog element itself (role=dialog)",
    backdrop: "The semi-transparent overlay behind the dialog",
    header: "The title bar area containing the dialog title and close button",
    title: "The dialog\u2019s heading (referenced by aria-labelledby)",
    body: "The main content area",
    footer: "Action buttons area",
    closeButton: "The X button to dismiss the dialog",
  },
  variants: {
    default: "Standard dialog with backdrop",
    drawer: "Panel that slides in from an edge (still a modal dialog)",
    alert: "Alert dialog requiring an explicit user decision (role=alertdialog)",
  },
  states: {
    closed: { description: "Dialog is hidden and inert" },
    open: { description: "Dialog is visible and focus is trapped within" },
    focused: { description: "A focusable element within the dialog has focus", focusRing: true },
  },
  interaction: {
    activationKeys: ["Escape"],
    role: "dialog",
  },
  a11y: {
    role: "dialog",
    keyboard: {
      Tab: "Move focus to the next focusable element within the dialog",
      "Shift+Tab": "Move focus to the previous focusable element within the dialog",
      Escape: "Closes the dialog and returns focus to the trigger element",
    },
    focusBehavior: "focus-trap",
    focusTrap: true,
    focusReturnTarget: "trigger-element",
    minimumTouchTarget: { ios: "44pt", android: "48dp", web: "24px" },
    ariaAttributes: [
      "aria-modal",
      "aria-labelledby",
      "aria-describedby",
      "aria-label",
    ],
    requiredLabel: true,
    labelStrategy: "aria-labelledby-pointing-to-title",
  },
  responsive: {
    compact: { fullWidth: true },
    medium: { fullWidth: false },
    expanded: { fullWidth: false },
  },
  slots: {
    title: {
      description: "Dialog heading — referenced by aria-labelledby; always required",
      required: true,
      accepts: "text",
      maxLength: 60,
      truncatable: false,
    },
    body: {
      description: "Main content area — accepts any structured content",
      required: true,
      accepts: "component",
    },
    footer: {
      description: "Action buttons — max two actions (primary + cancel); omit for informational dialogs",
      required: false,
      accepts: "component",
    },
    closeButton: {
      description: "Icon button in the header to dismiss — omit for critical/blocking dialogs",
      required: false,
      accepts: "action",
    },
  },
  tokens: {
    root: {
      open: {
        background: "color.surface.elevated",
        "border-radius": "border-radius.xl",
        shadow: {
          offsetX: "0px",
          offsetY: "8px",
          blur: "24px",
          spread: "0px",
          color: "rgba(0,0,0,0.15)",
        },
      },
    },
    backdrop: {
      open: {
        background: "color.text.primary",
      },
    },
  },
  visualClass: "structural",
  constraints: { textCentering: "symmetric-padding", buttonWidth: "fit-content" },
};
