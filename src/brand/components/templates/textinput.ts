/**
 * WAI-ARIA template: textinput
 *
 * Keyboard: Standard text input (no custom bindings)
 * Focus behavior: receives-focus
 * Reference: https://www.w3.org/WAI/ARIA/apg/patterns/textbox/
 */

import type { ComponentContract } from "../../../types/brand.js";

export const textinputTemplate: Partial<ComponentContract> = {
  description: "Accepts free-form text input from the user",
  widgetType: "textinput",
  anatomy: {
    root: "The outer wrapper element",
    input: "The native <input> element",
    label: "The visible label above the input",
    helperText: "Supporting text below the input",
    errorText: "Error message shown in invalid state",
    leadingIcon: "Optional decorative icon inside leading edge",
    trailingIcon: "Optional icon or action inside trailing edge",
  },
  variants: {
    default: "Standard text input",
    password: "Masked password input",
    search: "Search input with clear action",
  },
  sizes: {
    sm: { height: "32px", "padding-x": "10px", "font-size": "{font-size.label}" },
    md: { height: "40px", "padding-x": "12px", "font-size": "{font-size.body}" },
    lg: { height: "48px", "padding-x": "16px", "font-size": "{font-size.body}" },
  },
  states: {
    default: { description: "Resting state" },
    focused: { description: "Input has keyboard focus", focusRing: true },
    filled: { description: "Input contains a value" },
    disabled: { description: "Input is read-only and non-interactive", ariaDisabled: true },
    invalid: { description: "Value fails validation", ariaLabel: "Invalid value" },
    readonly: { description: "Value is displayed but cannot be edited" },
  },
  interaction: {
    role: "textbox",
  },
  a11y: {
    role: "textbox",
    keyboard: {
      Tab: "Move focus to the input",
      "Shift+Tab": "Move focus away from the input",
    },
    focusBehavior: "receives-focus",
    focusTrap: false,
    focusReturnTarget: null,
    minimumTouchTarget: { ios: "44pt", android: "48dp", web: "24px" },
    ariaAttributes: [
      "aria-label",
      "aria-labelledby",
      "aria-describedby",
      "aria-required",
      "aria-invalid",
      "aria-disabled",
      "aria-readonly",
    ],
    requiredLabel: true,
    labelStrategy: "visible-label-or-aria-labelledby",
  },
  slots: {
    label: {
      description: "Visible field label — always required (never use placeholder as a label substitute)",
      required: true,
      accepts: "text",
    },
    helperText: {
      description: "Supporting guidance shown below the field in the resting state",
      required: false,
      accepts: "text",
      maxLength: 100,
      truncatable: false,
    },
    errorText: {
      description: "Error message shown in the invalid state — replaces helperText",
      required: false,
      accepts: "text",
      maxLength: 80,
      truncatable: false,
    },
    leadingIcon: {
      description: "Decorative icon at the leading edge of the input",
      required: false,
      accepts: "icon",
    },
    trailingIcon: {
      description: "Icon or clear/reveal action at the trailing edge",
      required: false,
      accepts: "icon",
    },
  },
  tokens: {
    input: {
      default: {
        background: "input.bg",
        "border-color": "input.border",
        color: "input.text",
        "border-radius": "input.radius",
      },
      focused: {
        "border-color": "input.border.focus",
        "outline-color": "color.focus.ring",
        "outline-width": "2px",
      },
      disabled: {
        background: "color.surface.disabled",
        color: "color.text.disabled",
        "border-color": "color.border.disabled",
      },
      invalid: {
        "border-color": "color.feedback.error",
      },
    },
  },
  visualClass: "structural",
  variantMatrix: { state: ["default", "error", "disabled"] },
};
