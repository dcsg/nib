/**
 * Color token generation — HSL math, scale generation, semantic mapping.
 */

import type {
  BrandColorInput,
  ColorScale,
  ColorScaleStep,
  DtcgTokenFile,
  HslColor,
} from "../../types/brand.js";

const SCALE_STEPS: ColorScaleStep[] = [
  "50",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
  "950",
];

/** Lightness targets for each scale step (0–100) */
const LIGHTNESS_MAP: Record<ColorScaleStep, number> = {
  "50": 97,
  "100": 94,
  "200": 86,
  "300": 77,
  "400": 66,
  "500": 55,
  "600": 45,
  "700": 37,
  "800": 29,
  "900": 21,
  "950": 13,
};

/** Saturation reduction at lightness extremes */
const SATURATION_SCALE: Record<ColorScaleStep, number> = {
  "50": 0.3,
  "100": 0.5,
  "200": 0.7,
  "300": 0.85,
  "400": 0.95,
  "500": 1.0,
  "600": 1.0,
  "700": 0.95,
  "800": 0.9,
  "900": 0.8,
  "950": 0.7,
};

/** Parse a hex color to HSL */
export function hexToHsl(hex: string): HslColor {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  if (max === r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  } else if (max === g) {
    h = ((b - r) / d + 2) / 6;
  } else {
    h = ((r - g) / d + 4) / 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/** Convert HSL to hex */
export function hslToHex(hsl: HslColor): string {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  if (s === 0) {
    const val = Math.round(l * 255);
    return `#${val.toString(16).padStart(2, "0").repeat(3)}`;
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Generate an 11-step color scale from a single hex color */
export function generateColorScale(hex: string): ColorScale {
  const hsl = hexToHsl(hex);
  const scale = {} as ColorScale;

  for (const step of SCALE_STEPS) {
    const targetL = LIGHTNESS_MAP[step];
    const satScale = SATURATION_SCALE[step];
    const adjustedS = Math.min(100, hsl.s * satScale);
    scale[step] = hslToHex({ h: hsl.h, s: adjustedS, l: targetL });
  }

  return scale;
}

/** Generate a neutral gray scale from the primary hue */
export function generateNeutralScale(primaryHex: string): ColorScale {
  const hsl = hexToHsl(primaryHex);
  const scale = {} as ColorScale;

  for (const step of SCALE_STEPS) {
    const targetL = LIGHTNESS_MAP[step];
    // 10% of original saturation for a warm/cool gray
    const neutralS = Math.min(10, hsl.s * 0.1);
    scale[step] = hslToHex({ h: hsl.h, s: neutralS, l: targetL });
  }

  return scale;
}

/** Fixed feedback color hues */
const FEEDBACK_HUES = {
  success: 142,
  warning: 38,
  error: 0,
  info: 217,
} as const;

/** Generate feedback color scales */
export function generateFeedbackScales(): Record<string, ColorScale> {
  const result: Record<string, ColorScale> = {};

  for (const [name, hue] of Object.entries(FEEDBACK_HUES)) {
    const scale = {} as ColorScale;
    for (const step of SCALE_STEPS) {
      const targetL = LIGHTNESS_MAP[step];
      const baseSat = name === "warning" ? 90 : 70;
      const satScale = SATURATION_SCALE[step];
      scale[step] = hslToHex({ h: hue, s: baseSat * satScale, l: targetL });
    }
    result[name] = scale;
  }

  return result;
}

/** Build the primitive color token file from brand colors */
export function buildColorPrimitives(colors: BrandColorInput): DtcgTokenFile {
  const brandScale = generateColorScale(colors.primary);
  const neutralScale = generateNeutralScale(colors.primary);
  const feedback = generateFeedbackScales();

  const tokens: DtcgTokenFile = {
    color: {
      $type: "color",
      white: { $value: "#ffffff" },
      black: { $value: "#000000" },
    },
  };

  const brand = {} as Record<string, { $value: string }>;
  const neutral = {} as Record<string, { $value: string }>;
  const success = {} as Record<string, { $value: string }>;
  const warning = {} as Record<string, { $value: string }>;
  const error = {} as Record<string, { $value: string }>;
  const info = {} as Record<string, { $value: string }>;

  for (const step of SCALE_STEPS) {
    brand[step] = { $value: brandScale[step] };
    neutral[step] = { $value: neutralScale[step] };
    success[step] = { $value: feedback.success![step] };
    warning[step] = { $value: feedback.warning![step] };
    error[step] = { $value: feedback.error![step] };
    info[step] = { $value: feedback.info![step] };
  }

  const colorGroup = tokens.color as Record<string, unknown>;
  colorGroup.brand = brand;
  colorGroup.neutral = neutral;
  colorGroup.success = success;
  colorGroup.warning = warning;
  colorGroup.error = error;
  colorGroup.info = info;

  // Add secondary and accent if provided
  if (colors.secondary) {
    const secondaryScale = generateColorScale(colors.secondary);
    const secondary = {} as Record<string, { $value: string }>;
    for (const step of SCALE_STEPS) {
      secondary[step] = { $value: secondaryScale[step] };
    }
    colorGroup.secondary = secondary;
  }

  if (colors.accent) {
    const accentScale = generateColorScale(colors.accent);
    const accent = {} as Record<string, { $value: string }>;
    for (const step of SCALE_STEPS) {
      accent[step] = { $value: accentScale[step] };
    }
    colorGroup.accent = accent;
  }

  return tokens;
}

/** Build semantic light theme tokens */
export function buildSemanticLight(): DtcgTokenFile {
  return {
    color: {
      $type: "color",
      background: {
        primary: { $value: "{color.white}" },
        secondary: { $value: "{color.neutral.50}" },
        tertiary: { $value: "{color.neutral.100}" },
      },
      surface: {
        primary: { $value: "{color.white}" },
        secondary: { $value: "{color.neutral.50}" },
        elevated: { $value: "{color.white}" },
      },
      text: {
        primary: { $value: "{color.neutral.900}" },
        secondary: { $value: "{color.neutral.700}" },
        tertiary: { $value: "{color.neutral.600}" },
        inverse: { $value: "{color.white}" },
      },
      border: {
        primary: { $value: "{color.neutral.200}" },
        secondary: { $value: "{color.neutral.100}" },
        focus: { $value: "{color.brand.500}" },
      },
      interactive: {
        default: { $value: "{color.brand.600}" },
        hover: { $value: "{color.brand.700}" },
        active: { $value: "{color.brand.800}" },
        disabled: { $value: "{color.neutral.300}" },
      },
      feedback: {
        success: { $value: "{color.success.800}" },
        warning: { $value: "{color.warning.800}" },
        error: { $value: "{color.error.600}" },
        info: { $value: "{color.info.600}" },
        "success-bg": { $value: "{color.success.50}" },
        "warning-bg": { $value: "{color.warning.50}" },
        "error-bg": { $value: "{color.error.50}" },
        "info-bg": { $value: "{color.info.50}" },
      },
    },
  };
}

/** Build semantic dark theme tokens */
export function buildSemanticDark(): DtcgTokenFile {
  return {
    color: {
      $type: "color",
      background: {
        primary: { $value: "{color.neutral.950}" },
        secondary: { $value: "{color.neutral.900}" },
        tertiary: { $value: "{color.neutral.800}" },
      },
      surface: {
        primary: { $value: "{color.neutral.900}" },
        secondary: { $value: "{color.neutral.800}" },
        elevated: { $value: "{color.neutral.800}" },
      },
      text: {
        primary: { $value: "{color.neutral.50}" },
        secondary: { $value: "{color.neutral.300}" },
        tertiary: { $value: "{color.neutral.500}" },
        inverse: { $value: "{color.neutral.900}" },
      },
      border: {
        primary: { $value: "{color.neutral.700}" },
        secondary: { $value: "{color.neutral.800}" },
        focus: { $value: "{color.brand.400}" },
      },
      interactive: {
        default: { $value: "{color.brand.400}" },
        hover: { $value: "{color.brand.300}" },
        active: { $value: "{color.brand.200}" },
        disabled: { $value: "{color.neutral.700}" },
      },
      feedback: {
        success: { $value: "{color.success.400}" },
        warning: { $value: "{color.warning.400}" },
        error: { $value: "{color.error.400}" },
        info: { $value: "{color.info.400}" },
        "success-bg": { $value: "{color.success.950}" },
        "warning-bg": { $value: "{color.warning.950}" },
        "error-bg": { $value: "{color.error.950}" },
        "info-bg": { $value: "{color.info.950}" },
      },
    },
  };
}
