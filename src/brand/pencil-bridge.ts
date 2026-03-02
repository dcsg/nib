/**
 * Pencil style guide bridge — maps nib token names to Pencil $-- standard variables.
 *
 * Pencil.dev uses a standard variable convention (--background, --primary, etc.)
 * that style guides depend on. Variable KEY names are plain strings — the $ sigil
 * is only used in property values as a reference (e.g. fill: "$--background").
 *
 * See ADR-005 for the naming convention and light/dark theming details.
 */

/** Pencil variable value — flat or themed (light/dark array). */
type PencilVarValue =
  | string
  | number
  | Array<{ value: string | number; theme: Record<string, string> }>;

/** Static mapping: Pencil standard variable → nib token key */
const PENCIL_STANDARD_MAP: Record<string, string> = {
  // Backgrounds
  "--background": "color-background-primary",
  "--background-secondary": "color-background-secondary",
  "--surface": "color-surface-primary",
  "--surface-secondary": "color-surface-secondary",

  // Text
  "--foreground": "color-text-primary",
  "--foreground-secondary": "color-text-secondary",
  "--foreground-muted": "color-text-tertiary",

  // Interactive / brand
  "--primary": "color-interactive-default",
  "--primary-hover": "color-interactive-hover",
  "--primary-foreground": "color-text-inverse",

  // Feedback
  "--success": "color-feedback-success",
  "--warning": "color-feedback-warning",
  "--error": "color-feedback-error",
  "--info": "color-feedback-info",

  // Border
  "--border": "color-border-primary",
  "--border-secondary": "color-border-secondary",

  // Typography
  "--font-primary": "font-family-sans",
  "--font-mono": "font-family-mono",
  "--font-size-base": "font-size-body",
  "--font-size-sm": "font-size-caption",
  "--font-size-lg": "font-size-heading",

  // Spacing
  "--space-xs": "spacing-xs",
  "--space-sm": "spacing-sm",
  "--space-m": "spacing-md",
  "--space-lg": "spacing-lg",
  "--space-xl": "spacing-xl",

  // Radius
  "--radius-sm": "border-radius-sm",
  "--radius-m": "border-radius-md",
  "--radius-lg": "border-radius-lg",
  "--radius-full": "border-radius-full",
};

/**
 * Component-level token aliases used by the standard kit contracts.
 * Maps the DTCG component token name (as used in contract files) → nib semantic token key.
 * These are included in the push so kit batch_design ops resolve correctly.
 */
const COMPONENT_TOKEN_MAP: Record<string, string> = {
  // Button
  "button-bg-primary": "color-interactive-default",
  "button-bg-primary-hover": "color-interactive-hover",
  "button-text-primary": "color-text-inverse",

  // TextInput
  "input-bg": "color-background-primary",
  "input-border": "color-border-primary",
  "input-border-focus": "color-border-focus",
  "input-text": "color-text-primary",

  // Checkbox
  "checkbox-bg": "color-background-primary",
  "checkbox-bg-checked": "color-interactive-default",
  "checkbox-border": "color-border-primary",
  "checkbox-border-checked": "color-interactive-default",

  // Radio
  "radio-bg": "color-background-primary",
  "radio-bg-selected": "color-interactive-default",
  "radio-border": "color-border-primary",
  "radio-border-selected": "color-interactive-default",

  // Switch
  "switch-track-bg": "color-interactive-disabled",
  "switch-track-bg-on": "color-interactive-default",
  "switch-thumb-bg": "color-background-primary",
  "switch-thumb-bg-on": "color-background-primary",

  // Badge
  "badge-bg-neutral": "color-surface-secondary",
  "badge-text-neutral": "color-text-secondary",

  // Toast
  "toast-bg": "color-surface-primary",
  "toast-text": "color-text-primary",

  // Alert
  "alert-bg": "color-surface-secondary",
  "alert-text": "color-text-primary",
  "alert-border": "color-border-primary",

  // Tooltip
  "tooltip-bg": "color-neutral-900",
  "tooltip-text": "color-text-inverse",

  // Combobox
  "combobox-bg": "color-background-primary",
  "combobox-border": "color-border-primary",
  "combobox-border-focus": "color-border-focus",
  "combobox-text": "color-text-primary",
  "combobox-popup-bg": "color-surface-primary",
  "combobox-popup-border": "color-border-primary",

  // Dialog
  "dialog-bg": "color-surface-primary",

  // Tabs
  "tab-indicator": "color-interactive-default",
  "tab-text": "color-text-secondary",
  "tab-text-selected": "color-text-primary",

  // Shared semantic aliases used by contracts
  "color-focus-ring": "color-border-focus",
  "color-surface-disabled": "color-surface-secondary",
  "color-text-disabled": "color-text-tertiary",
  "color-border-disabled": "color-interactive-disabled",
};

/**
 * Build Pencil standard variables by mapping nib token values to --name keys.
 *
 * Variable keys must NOT contain $. The $ is only used in property values as a
 * reference sigil (e.g. fill: "$--background" looks up variable named "--background").
 *
 * @param nibVars - The nib variables record (from buildPencilVariables output)
 * @returns A merged variable set containing both original nib vars, -- standard mappings,
 *          and component-level token aliases so kit batch_design ops resolve correctly.
 */
export function buildPencilStandardVariables(
  nibVars: Record<string, { type: string; value: PencilVarValue }>,
): Record<string, { type: string; value: PencilVarValue }> {
  const merged: Record<string, { type: string; value: PencilVarValue }> = { ...nibVars };

  for (const [pencilName, nibKey] of Object.entries(PENCIL_STANDARD_MAP)) {
    const source = nibVars[nibKey];
    if (source) {
      merged[pencilName] = { type: source.type, value: source.value };
    }
  }

  for (const [componentToken, nibKey] of Object.entries(COMPONENT_TOKEN_MAP)) {
    const source = nibVars[nibKey];
    if (source) {
      merged[componentToken] = { type: source.type, value: source.value };
    }
  }

  return merged;
}
