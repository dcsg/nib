/**
 * WAI-ARIA template: checkbox
 *
 * Keyboard: Space → toggle checked state
 * Focus behavior: receives-focus
 * Reference: https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/
 */

import type { ComponentContract } from "../../../types/brand.js";

export const checkboxTemplate: Partial<ComponentContract> = {
  description: "A binary toggle that can be checked or unchecked",
  widgetType: "checkbox",
  anatomy: {
    root: "The outer wrapper element",
    control: "The visual checkbox indicator",
    label: "The visible text label",
    checkmark: "The check icon shown when checked",
  },
  variants: {
    default: "Standard checkbox with label",
    indeterminate: "Partially checked state (mixed selection)",
  },
  states: {
    default: { description: "Unchecked resting state" },
    checked: { description: "Value is selected" },
    indeterminate: { description: "Mixed selection — neither fully checked nor unchecked" },
    focused: { description: "Keyboard or programmatic focus", focusRing: true },
    disabled: { description: "Not interactive", ariaDisabled: true },
    "checked-disabled": { description: "Checked and non-interactive", ariaDisabled: true },
  },
  interaction: {
    activationKeys: ["Space"],
    role: "checkbox",
  },
  a11y: {
    role: "checkbox",
    keyboard: {
      Space: "Toggles the checked state",
      Tab: "Move focus to the checkbox",
      "Shift+Tab": "Move focus away from the checkbox",
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
      description: "Checkbox label — describes what is being selected; always required",
      required: true,
      accepts: "text",
      maxLength: 80,
      truncatable: true,
    },
  },
  tokens: {
    control: {
      default: {
        background: "checkbox.bg",
        "border-color": "checkbox.border",
        "border-radius": "checkbox.radius",
      },
      checked: {
        background: "checkbox.bg.checked",
        "border-color": "checkbox.border.checked",
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
