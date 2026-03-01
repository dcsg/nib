/**
 * Generates CSS custom properties from DesignDocument variables.
 *
 * - $varName references in the design become var(--varName) in CSS.
 * - :root {} block with default values.
 * - .theme-dark {} etc. for theme overrides.
 */

import type { DesignVariables, DesignThemes } from "../types/design.js";

export function resolveVariableCss(
  variables: DesignVariables,
  themes: DesignThemes,
): string {
  const entries = Object.entries(variables);
  if (entries.length === 0) return "";

  const blocks: string[] = [];

  // :root defaults
  const rootProps = entries.map(([name, v]) => `  --${name}: ${v.default};`);
  blocks.push(`:root {\n${rootProps.join("\n")}\n}`);

  // Theme overrides — generate a class per theme combination
  // e.g., if axes = { mode: ["light", "dark"] }, generate .theme-dark { ... }
  for (const [axis, values] of Object.entries(themes.axes)) {
    for (const value of values) {
      const themeKey = `${axis}/${value}`;
      const overrides: string[] = [];

      for (const [name, variable] of entries) {
        const themeVal = variable.themes?.[themeKey] ?? variable.themes?.[value];
        if (themeVal !== undefined) {
          overrides.push(`  --${name}: ${themeVal};`);
        }
      }

      if (overrides.length > 0) {
        blocks.push(`.theme-${cssIdent(value)} {\n${overrides.join("\n")}\n}`);
      }
    }
  }

  return blocks.join("\n\n");
}

/** Sanitize a value for use as a CSS class name fragment */
function cssIdent(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "-");
}
