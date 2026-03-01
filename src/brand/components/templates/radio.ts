/**
 * WAI-ARIA template: radio
 *
 * Keyboard: Arrow keys → move between options, Space → select focused option
 * Focus behavior: receives-focus with roving tabindex within group
 * Reference: https://www.w3.org/WAI/ARIA/apg/patterns/radio/
 */

import type { ComponentContract } from "../../../types/brand.js";

export const radioTemplate: Partial<ComponentContract> = {
  description: "A single option within a radio group — only one option can be selected at a time",
  widgetType: "radio",
  anatomy: {
    root: "The outer wrapper for the radio group",
    radio: "The individual radio button control",
    label: "The visible text label for the radio option",
    indicator: "The filled circle shown when selected",
  },
  variants: {
    default: "Standard radio button",
    card: "Full-card clickable radio option",
  },
  states: {
    default: { description: "Unselected resting state" },
    selected: { description: "Option is the current selection" },
    focused: { description: "Keyboard or programmatic focus", focusRing: true },
    disabled: { description: "Not interactive", ariaDisabled: true },
    "selected-disabled": { description: "Selected and non-interactive", ariaDisabled: true },
  },
  interaction: {
    activationKeys: ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"],
    role: "radio",
  },
  a11y: {
    role: "radio",
    keyboard: {
      ArrowDown: "Move focus to and select the next radio option",
      ArrowRight: "Move focus to and select the next radio option",
      ArrowUp: "Move focus to and select the previous radio option",
      ArrowLeft: "Move focus to and select the previous radio option",
      Space: "Selects the focused radio option if not already selected",
      Tab: "Move focus to the selected (or first) radio in the group",
    },
    focusBehavior: "roving-tabindex",
    focusTrap: false,
    focusReturnTarget: null,
    minimumTouchTarget: { ios: "44pt", android: "48dp", web: "24px" },
    ariaAttributes: ["aria-checked", "aria-label", "aria-labelledby", "aria-disabled"],
    requiredLabel: true,
    labelStrategy: "visible-label-or-aria-labelledby",
  },
  slots: {
    label: {
      description: "Radio option label — describes this specific choice; always required",
      required: true,
      accepts: "text",
      maxLength: 80,
      truncatable: true,
    },
  },
  tokens: {
    radio: {
      default: {
        background: "radio.bg",
        "border-color": "radio.border",
        "border-radius": "radio.radius",
      },
      selected: {
        background: "radio.bg.selected",
        "border-color": "radio.border.selected",
      },
      focused: {
        "outline-color": "color.focus.ring",
        "outline-width": "2px",
      },
      disabled: {
        background: "color.surface.disabled",
        "border-color": "color.border.disabled",
      },
    },
  },
};
