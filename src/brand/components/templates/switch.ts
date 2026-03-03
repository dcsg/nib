/**
 * WAI-ARIA template: switch
 *
 * Keyboard: Space/Enter → toggle on/off
 * Focus behavior: receives-focus
 * Reference: https://www.w3.org/WAI/ARIA/apg/patterns/switch/
 */

import type { ComponentContract } from "../../../types/brand.js";

export const switchTemplate: Partial<ComponentContract> = {
  description: "A binary on/off toggle control",
  widgetType: "switch",
  anatomy: {
    root: "The outer wrapper element",
    track: "The pill-shaped background track",
    thumb: "The circular handle that slides",
    label: "The visible text label",
    onLabel: "Optional label for the on state",
    offLabel: "Optional label for the off state",
  },
  variants: {
    default: "Standard toggle switch",
    small: "Compact version for dense layouts",
  },
  states: {
    default: { description: "Off / unchecked state" },
    on: { description: "On / checked state" },
    focused: { description: "Keyboard or programmatic focus", focusRing: true },
    disabled: { description: "Not interactive", ariaDisabled: true },
    "on-disabled": { description: "On state and non-interactive", ariaDisabled: true },
  },
  interaction: {
    activationKeys: ["Space", "Enter"],
    role: "switch",
  },
  a11y: {
    role: "switch",
    keyboard: {
      Space: "Toggles the switch between on and off",
      Enter: "Toggles the switch between on and off",
      Tab: "Move focus to the switch",
      "Shift+Tab": "Move focus away from the switch",
    },
    focusBehavior: "receives-focus",
    focusTrap: false,
    focusReturnTarget: null,
    minimumTouchTarget: { ios: "44pt", android: "48dp", web: "24px" },
    ariaAttributes: ["aria-checked", "aria-label", "aria-labelledby", "aria-disabled"],
    requiredLabel: true,
    labelStrategy: "visible-label-or-aria-labelledby",
  },
  slots: {
    label: {
      description: "Switch label — describes the setting being toggled; always required",
      required: true,
      accepts: "text",
      maxLength: 60,
      truncatable: true,
    },
    onLabel: {
      description: "Short label shown inside the track when on (e.g. 'On') — optional, use for clarity only",
      required: false,
      accepts: "text",
      maxLength: 10,
    },
    offLabel: {
      description: "Short label shown inside the track when off (e.g. 'Off') — optional",
      required: false,
      accepts: "text",
      maxLength: 10,
    },
  },
  tokens: {
    track: {
      default: {
        background: "color.background.secondary",
        "border-radius": "border-radius.full",
      },
      on: {
        background: "color.interactive.default",
      },
      focused: {
        "outline-color": "color.border.focus",
        "outline-width": "2px",
      },
      disabled: {
        background: "color.interactive.disabled",
      },
    },
    thumb: {
      default: {
        background: "color.background.primary",
      },
      on: {
        background: "color.background.primary",
      },
    },
  },
  visualClass: "interactive-control",
  variantMatrix: { state: ["off", "on", "disabled"] },
};
