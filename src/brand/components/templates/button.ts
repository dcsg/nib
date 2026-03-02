/**
 * WAI-ARIA template: button
 *
 * Keyboard: Enter → activate, Space → activate
 * Focus behavior: receives-focus
 * Reference: https://www.w3.org/WAI/ARIA/apg/patterns/button/
 */

import type { ComponentContract } from "../../../types/brand.js";

export const buttonTemplate: Partial<ComponentContract> = {
  description: "Triggers an action or event",
  widgetType: "button",
  anatomy: {
    root: "The outer interactive element",
    label: "The visible text content",
    leadingIcon: "Optional icon before label",
    trailingIcon: "Optional icon after label",
    loadingSpinner: "Shown during loading state",
  },
  variants: {
    primary: "High-emphasis action, one per view",
    secondary: "Medium-emphasis, supporting action",
    ghost: "Low-emphasis, destructive or tertiary",
    danger: "Destructive actions only",
  },
  sizes: {
    sm: { height: "32px", "padding-x": "12px", "font-size": "{font-size.label}" },
    md: { height: "40px", "padding-x": "16px", "font-size": "{font-size.body}" },
    lg: { height: "48px", "padding-x": "20px", "font-size": "{font-size.body-lg}" },
  },
  states: {
    default: { description: "Resting state" },
    hover: { description: "Pointer device over element" },
    focused: { description: "Keyboard or programmatic focus", focusRing: true },
    active: { description: "Being pressed" },
    disabled: { description: "Not interactive", ariaDisabled: true },
    loading: {
      description: "Async action in progress",
      ariaLabel: "Loading\u2026",
      ariaDisabled: true,
    },
  },
  interaction: {
    activationKeys: ["Enter", "Space"],
    role: "button",
    submitsForm: false,
  },
  a11y: {
    role: "button",
    keyboard: {
      Enter: "Activates the button",
      Space: "Activates the button",
    },
    focusBehavior: "receives-focus",
    focusTrap: false,
    focusReturnTarget: null,
    minimumTouchTarget: { ios: "44pt", android: "48dp", web: "24px" },
    ariaAttributes: ["aria-label", "aria-disabled", "aria-pressed"],
    requiredLabel: true,
    labelStrategy: "visible-text-or-aria-label",
  },
  responsive: {
    compact: { fullWidth: true },
    medium: { fullWidth: false },
    expanded: { fullWidth: false },
  },
  slots: {
    label: {
      description: "Button label text — always required unless icon-only with aria-label",
      required: true,
      accepts: "text",
      maxLength: 40,
      truncatable: false,
    },
    leadingIcon: {
      description: "Icon placed before the label — use to reinforce the action",
      required: false,
      accepts: "icon",
    },
    trailingIcon: {
      description: "Icon placed after the label — use sparingly (e.g. external link, chevron)",
      required: false,
      accepts: "icon",
    },
  },
  tokens: {
    root: {
      default: {
        background: "button.bg.primary",
        color: "button.text.primary",
        "border-radius": "button.radius",
        "border-color": "transparent",
      },
      hover: { background: "button.bg.primary.hover" },
      focused: { "outline-color": "color.focus.ring", "outline-width": "2px" },
      disabled: {
        background: "color.surface.disabled",
        color: "color.text.disabled",
      },
    },
  },
  visualClass: "interactive-control",
  variantMatrix: { style: ["primary", "secondary", "outline", "destructive"] },
  constraints: { textCentering: "symmetric-padding", buttonWidth: "fit-content" },
};
