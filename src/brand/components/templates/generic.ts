/**
 * WAI-ARIA template: generic
 *
 * No pre-filled keyboard or focus behavior — user defines everything.
 * Use when the component does not match any of the 9 first-class widget types.
 */

import type { ComponentContract } from "../../../types/brand.js";

export const genericTemplate: Partial<ComponentContract> = {
  description: "A custom component — fill in anatomy, states, and a11y contract manually",
  widgetType: "generic",
  anatomy: {
    root: "The outer element — describe its purpose here",
  },
  states: {
    default: { description: "Resting state" },
    focused: { description: "Keyboard or programmatic focus", focusRing: true },
    disabled: { description: "Not interactive", ariaDisabled: true },
  },
  a11y: {
    role: "region",
    keyboard: {},
    focusBehavior: "user-defined",
    focusTrap: false,
    focusReturnTarget: null,
    minimumTouchTarget: { ios: "44pt", android: "48dp", web: "24px" },
    ariaAttributes: ["aria-label"],
    requiredLabel: true,
    labelStrategy: "user-defined",
  },
  tokens: {
    root: {
      default: {},
    },
  },
  visualClass: "structural",
};
