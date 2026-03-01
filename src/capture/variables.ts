/**
 * Transforms raw MCP variable data into the DesignDocument variable format.
 */

import type { DesignVariable, DesignVariables, DesignThemes } from "../types/design.js";
import type { RawVariables } from "./reader.js";

interface RawVarEntry {
  type?: string;
  value?: string | number;
  default?: string | number;
  themes?: Record<string, string | number>;
  [key: string]: unknown;
}

export function normalizeVariables(raw: RawVariables): {
  variables: DesignVariables;
  themes: DesignThemes;
} {
  const variables: DesignVariables = {};
  const rawVars = (raw.variables ?? {}) as Record<string, RawVarEntry>;

  for (const [name, entry] of Object.entries(rawVars)) {
    const type = inferType(entry);
    const defaultVal = entry.default ?? entry.value ?? "";
    const variable: DesignVariable = { type, default: defaultVal };

    if (entry.themes && Object.keys(entry.themes).length > 0) {
      variable.themes = entry.themes;
    }

    variables[name] = variable;
  }

  const axes: Record<string, string[]> = {};
  if (raw.themes?.axes) {
    for (const [axis, values] of Object.entries(raw.themes.axes)) {
      axes[axis] = values;
    }
  }

  return { variables, themes: { axes } };
}

function inferType(entry: RawVarEntry): "color" | "number" | "string" {
  if (entry.type === "color" || entry.type === "number" || entry.type === "string") {
    return entry.type;
  }
  const val = entry.default ?? entry.value;
  if (typeof val === "number") return "number";
  if (typeof val === "string" && /^(#|rgba?\(|hsla?\()/.test(val)) return "color";
  return "string";
}
