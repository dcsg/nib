/**
 * Spacing token generation — 4px base unit scale + semantic aliases.
 */

import type { DtcgTokenFile } from "../../types/brand.js";

/** Spacing scale values in pixels (4px base) */
const SPACING_VALUES = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96] as const;

/** Semantic spacing names mapped to scale index */
const SPACING_NAMES: Record<string, number> = {
  none: 0,
  "2xs": 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
  "4xl": 96,
};

/** Build spacing tokens */
export function buildSpacingTokens(): DtcgTokenFile {
  const scale: Record<string, unknown> = {};
  for (const value of SPACING_VALUES) {
    scale[String(value)] = {
      $value: `${value}px`,
      $type: "dimension",
    };
  }

  const semantic: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(SPACING_NAMES)) {
    semantic[name] = {
      $value: `{spacing.${value}}`,
      $type: "dimension",
    };
  }

  return {
    spacing: {
      ...scale,
      ...semantic,
    },
  };
}
