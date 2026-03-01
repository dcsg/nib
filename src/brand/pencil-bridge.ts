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
 * Build Pencil standard variables by mapping nib token values to --name keys.
 *
 * Variable keys must NOT contain $. The $ is only used in property values as a
 * reference sigil (e.g. fill: "$--background" looks up variable named "--background").
 *
 * @param nibVars - The nib variables record (from buildPencilVariables output)
 * @returns A merged variable set containing both original nib vars and -- standard mappings
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

  return merged;
}
