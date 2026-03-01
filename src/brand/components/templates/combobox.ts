/**
 * WAI-ARIA template: combobox
 *
 * Keyboard: ArrowDown → open/next; ArrowUp → previous; Enter → select; Escape → close; Home/End in list
 * Focus behavior: manages focus between input and listbox
 * Reference: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
 */

import type { ComponentContract } from "../../../types/brand.js";

export const comboboxTemplate: Partial<ComponentContract> = {
  description: "An input that displays a popup list of suggested values",
  widgetType: "combobox",
  anatomy: {
    root: "The outer wrapper element",
    input: "The text input element (role=combobox)",
    trigger: "The button that opens/closes the listbox",
    popup: "The popup container element",
    listbox: "The list of options (role=listbox)",
    option: "A single selectable option (role=option)",
    clearButton: "Optional button to clear the current value",
  },
  variants: {
    select: "Dropdown select — typing filters options",
    autocomplete: "Autocomplete — suggestions appear as user types",
  },
  states: {
    closed: { description: "Listbox is hidden" },
    open: { description: "Listbox is visible and an option may be focused" },
    selected: { description: "A value has been chosen and is displayed in the input" },
    focused: { description: "Input has keyboard focus", focusRing: true },
    disabled: { description: "Not interactive", ariaDisabled: true },
    invalid: { description: "Selected value fails validation" },
  },
  interaction: {
    activationKeys: ["ArrowDown", "ArrowUp", "Enter", "Escape", "Home", "End"],
    role: "combobox",
  },
  a11y: {
    role: "combobox",
    keyboard: {
      ArrowDown:
        "Opens the popup if closed; moves focus to the next option in the list",
      ArrowUp: "Moves focus to the previous option in the list",
      Enter: "Selects the currently focused option and closes the popup",
      Escape: "Closes the popup without selecting; clears the input if already closed",
      Home: "Moves focus to the first option in the list",
      End: "Moves focus to the last option in the list",
      Tab: "Closes the popup and moves focus to the next focusable element",
    },
    focusBehavior: "manages-focus",
    focusTrap: false,
    focusReturnTarget: "combobox-input",
    minimumTouchTarget: { ios: "44pt", android: "48dp", web: "24px" },
    ariaAttributes: [
      "aria-expanded",
      "aria-haspopup",
      "aria-controls",
      "aria-activedescendant",
      "aria-label",
      "aria-labelledby",
      "aria-required",
      "aria-invalid",
      "aria-disabled",
    ],
    requiredLabel: true,
    labelStrategy: "visible-label-or-aria-labelledby",
  },
  slots: {
    label: {
      description: "Visible field label — always required",
      required: true,
      accepts: "text",
    },
    helperText: {
      description: "Supporting guidance below the field",
      required: false,
      accepts: "text",
      maxLength: 100,
      truncatable: false,
    },
    errorText: {
      description: "Error message shown in the invalid state",
      required: false,
      accepts: "text",
      maxLength: 80,
      truncatable: false,
    },
  },
  tokens: {
    input: {
      default: {
        background: "combobox.bg",
        "border-color": "combobox.border",
        color: "combobox.text",
        "border-radius": "combobox.radius",
      },
      focused: {
        "border-color": "combobox.border.focus",
        "outline-color": "color.focus.ring",
        "outline-width": "2px",
      },
      disabled: {
        background: "color.surface.disabled",
        color: "color.text.disabled",
      },
    },
    popup: {
      open: {
        background: "combobox.popup.bg",
        "border-color": "combobox.popup.border",
        "border-radius": "combobox.popup.radius",
        shadow: "combobox.popup.shadow",
      },
    },
  },
};
