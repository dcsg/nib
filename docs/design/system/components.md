# Component System
<!-- nib-components-index: v1 | generated: 2026-03-02 | do not edit manually -->

## Registry

| Component | Widget Type | Status | States | Variants |
|-----------|-------------|--------|--------|----------|
| [Button](components/Button.md) | button | draft | 6 | 4 |
| [TextInput](components/TextInput.md) | textinput | draft | 6 | 3 |
| [Checkbox](components/Checkbox.md) | checkbox | draft | 6 | 2 |
| [Radio](components/Radio.md) | radio | draft | 5 | 2 |
| [Switch](components/Switch.md) | switch | draft | 5 | 2 |
| [Dialog](components/Dialog.md) | dialog | draft | 3 | 3 |
| [Tooltip](components/Tooltip.md) | tooltip | draft | 2 | 2 |
| [Tabs](components/Tabs.md) | tabs | draft | 4 | 3 |
| [Combobox](components/Combobox.md) | combobox | draft | 6 | 2 |
| [Badge](components/Badge.md) | badge | draft | 2 | 5 |
| [Toast](components/Toast.md) | toast | draft | 4 | 4 |
| [Alert](components/Alert.md) | alert | draft | 2 | 4 |

---

## Components

### Button
> Triggers an action or event

**Anatomy:** root, label, leadingIcon, trailingIcon, loadingSpinner
**States:** default, hover, focused, active, disabled, loading
**Keyboard:** `Enter` → Activates the button, `Space` → Activates the button
**Touch target:** 44pt iOS / 48dp Android / 24px web

---

### TextInput
> Accepts free-form text input from the user

**Anatomy:** root, input, label, helperText, errorText, leadingIcon, trailingIcon
**States:** default, focused, filled, disabled, invalid, readonly
**Keyboard:** `Tab` → Move focus to the input, `Shift+Tab` → Move focus away from the input
**Touch target:** 44pt iOS / 48dp Android / 24px web

---

### Checkbox
> A binary toggle that can be checked or unchecked

**Anatomy:** root, control, label, checkmark
**States:** default, checked, indeterminate, focused, disabled, checked-disabled
**Keyboard:** `Space` → Toggles the checked state, `Tab` → Move focus to the checkbox, `Shift+Tab` → Move focus away from the checkbox
**Touch target:** 44pt iOS / 48dp Android / 24px web

---

### Radio
> A single option within a radio group — only one option can be selected at a time

**Anatomy:** root, radio, label, indicator
**States:** default, selected, focused, disabled, selected-disabled
**Keyboard:** `ArrowDown` → Move focus to and select the next radio option, `ArrowRight` → Move focus to and select the next radio option, `ArrowUp` → Move focus to and select the previous radio option, `ArrowLeft` → Move focus to and select the previous radio option, `Space` → Selects the focused radio option if not already selected, `Tab` → Move focus to the selected (or first) radio in the group
**Touch target:** 44pt iOS / 48dp Android / 24px web

---

### Switch
> A binary on/off toggle control

**Anatomy:** root, track, thumb, label, onLabel, offLabel
**States:** default, on, focused, disabled, on-disabled
**Keyboard:** `Space` → Toggles the switch between on and off, `Enter` → Toggles the switch between on and off, `Tab` → Move focus to the switch, `Shift+Tab` → Move focus away from the switch
**Touch target:** 44pt iOS / 48dp Android / 24px web

---

### Dialog
> A modal overlay that requires user interaction before the rest of the UI becomes accessible

**Anatomy:** root, backdrop, header, title, body, footer, closeButton
**States:** closed, open, focused
**Keyboard:** `Tab` → Move focus to the next focusable element within the dialog, `Shift+Tab` → Move focus to the previous focusable element within the dialog, `Escape` → Closes the dialog and returns focus to the trigger element
**Touch target:** 44pt iOS / 48dp Android / 24px web

---

### Tooltip
> A small popup that displays information about another element on hover or focus

**Anatomy:** trigger, root, content, arrow
**States:** hidden, visible
**Keyboard:** `Escape` → Dismisses the tooltip without moving focus, `Tab` → Showing on focus is required — tooltip must appear when trigger receives keyboard focus
**Touch target:** 44pt iOS / 48dp Android / 24px web

---

### Tabs
> A set of layered sections of content — only one section is visible at a time

**Anatomy:** root, tablist, tab, tabpanel, indicator
**States:** default, selected, focused, disabled
**Keyboard:** `ArrowRight` → Move focus to the next tab; wraps to first, `ArrowLeft` → Move focus to the previous tab; wraps to last, `Home` → Move focus to the first tab, `End` → Move focus to the last tab, `Tab` → Move focus into the active tabpanel, `Shift+Tab` → Move focus back to the active tab from the tabpanel, `Enter` → Activates the focused tab (if tabs are manually activated), `Space` → Activates the focused tab (if tabs are manually activated)
**Touch target:** 44pt iOS / 48dp Android / 24px web

---

### Combobox
> An input that displays a popup list of suggested values

**Anatomy:** root, input, trigger, popup, listbox, option, clearButton
**States:** closed, open, selected, focused, disabled, invalid
**Keyboard:** `ArrowDown` → Opens the popup if closed; moves focus to the next option in the list, `ArrowUp` → Moves focus to the previous option in the list, `Enter` → Selects the currently focused option and closes the popup, `Escape` → Closes the popup without selecting; clears the input if already closed, `Home` → Moves focus to the first option in the list, `End` → Moves focus to the last option in the list, `Tab` → Closes the popup and moves focus to the next focusable element
**Touch target:** 44pt iOS / 48dp Android / 24px web

---

### Badge
> A small label used to convey status, category, or metadata at a glance

**Anatomy:** root, label, icon, dismissButton
**States:** default, dismissible
**Keyboard:** `Tab` → Moves focus to dismiss button when present, `Space` → Activates dismiss button when focused, `Enter` → Activates dismiss button when focused
**Touch target:** 44pt iOS / 48dp Android / 24px web

---

### Toast
> A transient message that confirms an action or communicates status — auto-dismisses after a timeout

**Anatomy:** root, icon, title, message, action, dismissButton
**States:** entering, visible, dismissing, dismissed
**Keyboard:** `Escape` → Dismisses the toast immediately, `Tab` → Moves focus to the action or dismiss button within the toast
**Touch target:** 44pt iOS / 48dp Android / 24px web

---

### Alert
> A persistent inline message that communicates status or guidance — stays visible until the condition changes or the user dismisses it

**Anatomy:** root, icon, title, description, actions, dismissButton
**States:** default, dismissed
**Keyboard:** `Tab` → Moves focus to actions or dismiss button within the alert, `Escape` → Dismisses the alert if it is dismissible
**Touch target:** 44pt iOS / 48dp Android / 24px web


---

*Generated by nib. Run `nib brand build` to regenerate.*
