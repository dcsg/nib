/**
 * Typography token generation — modular scale, line height grid, semantic roles.
 */

import type { BrandTypographyInput, DtcgTokenFile, TypeScaleRatio } from "../../types/brand.js";

const SCALE_RATIOS: Record<TypeScaleRatio, number> = {
  "major-third": 1.25,
  "perfect-fourth": 1.333,
};

/** Snap to nearest multiple of 4 */
function snapTo4(value: number): number {
  return Math.round(value / 4) * 4;
}

/** Compute line height: nearest multiple of 4px above 1.5× font size */
function computeLineHeight(fontSize: number): number {
  const ideal = fontSize * 1.5;
  return snapTo4(Math.ceil(ideal));
}

interface TypeRole {
  name: string;
  /** Power of the ratio (can be negative) */
  power: number;
  fontWeight: number;
}

const TYPE_ROLES: TypeRole[] = [
  { name: "caption", power: -2, fontWeight: 400 },
  { name: "label", power: -1, fontWeight: 500 },
  { name: "body", power: 0, fontWeight: 400 },
  { name: "body-lg", power: 1, fontWeight: 400 },
  { name: "heading-sm", power: 2, fontWeight: 600 },
  { name: "heading", power: 3, fontWeight: 600 },
  { name: "heading-lg", power: 4, fontWeight: 700 },
  { name: "display", power: 5, fontWeight: 700 },
  { name: "display-lg", power: 6, fontWeight: 700 },
];

const BASE_SIZE = 16;

/** Build typography tokens from brand input */
export function buildTypographyTokens(input: BrandTypographyInput): DtcgTokenFile {
  const ratio = SCALE_RATIOS[input.scaleRatio ?? "major-third"];

  const fontFamily: Record<string, unknown> = {
    sans: {
      $value: input.fontFamily,
      $type: "fontFamily",
    },
  };

  if (input.monoFontFamily) {
    fontFamily.mono = {
      $value: input.monoFontFamily,
      $type: "fontFamily",
    };
  }

  const fontSize: Record<string, unknown> = {};
  const lineHeight: Record<string, unknown> = {};
  const fontWeight: Record<string, unknown> = {};

  for (const role of TYPE_ROLES) {
    const size = Math.round(BASE_SIZE * Math.pow(ratio, role.power));
    const lh = computeLineHeight(size);

    fontSize[role.name] = {
      $value: `${size}px`,
      $type: "dimension",
    };
    lineHeight[role.name] = {
      $value: `${lh}px`,
      $type: "dimension",
    };
    fontWeight[role.name] = {
      $value: role.fontWeight,
      $type: "fontWeight",
    };
  }

  return {
    "font-family": fontFamily,
    "font-size": fontSize,
    "line-height": lineHeight,
    "font-weight": fontWeight,
  };
}
