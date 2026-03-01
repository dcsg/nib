/**
 * Unit tests for color token generation.
 *
 * Tests: hexToHsl, hslToHex, generateColorScale, generateNeutralScale,
 * generateFeedbackScales, buildColorPrimitives, buildSemanticLight, buildSemanticDark.
 */

import { describe, it, expect } from "bun:test";
import {
  hexToHsl,
  hslToHex,
  generateColorScale,
  generateNeutralScale,
  generateFeedbackScales,
  buildColorPrimitives,
  buildSemanticLight,
  buildSemanticDark,
} from "./color.js";

const SCALE_STEPS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const;

// ─── hexToHsl ─────────────────────────────────────────────────────────────────

describe("hexToHsl", () => {
  it("converts white to H=0 S=0 L=100", () => {
    const { h, s, l } = hexToHsl("#ffffff");
    expect(h).toBeCloseTo(0, 1);
    expect(s).toBeCloseTo(0, 1);
    expect(l).toBeCloseTo(100, 1);
  });

  it("converts black to H=0 S=0 L=0", () => {
    const { h, s, l } = hexToHsl("#000000");
    expect(h).toBeCloseTo(0, 1);
    expect(s).toBeCloseTo(0, 1);
    expect(l).toBeCloseTo(0, 1);
  });

  it("converts pure red #ff0000 to H≈0 S=100 L=50", () => {
    const { h, s, l } = hexToHsl("#ff0000");
    expect(h).toBeCloseTo(0, 0);
    expect(s).toBeCloseTo(100, 1);
    expect(l).toBeCloseTo(50, 1);
  });

  it("converts pure green #00ff00 to H≈120 S=100 L=50", () => {
    const { h, s, l } = hexToHsl("#00ff00");
    expect(h).toBeCloseTo(120, 0);
    expect(s).toBeCloseTo(100, 1);
    expect(l).toBeCloseTo(50, 1);
  });

  it("converts pure blue #0000ff to H≈240 S=100 L=50", () => {
    const { h, s, l } = hexToHsl("#0000ff");
    expect(h).toBeCloseTo(240, 0);
    expect(s).toBeCloseTo(100, 1);
    expect(l).toBeCloseTo(50, 1);
  });

  it("converts a branded blue correctly", () => {
    // #3b82f6 — Tailwind blue-500 — hue ~217
    const { h, s } = hexToHsl("#3b82f6");
    expect(h).toBeGreaterThan(200);
    expect(h).toBeLessThan(230);
    expect(s).toBeGreaterThan(70); // highly saturated
  });
});

// ─── hslToHex ─────────────────────────────────────────────────────────────────

describe("hslToHex", () => {
  it("converts H=0 S=0 L=100 to #ffffff", () => {
    expect(hslToHex({ h: 0, s: 0, l: 100 })).toBe("#ffffff");
  });

  it("converts H=0 S=0 L=0 to #000000", () => {
    expect(hslToHex({ h: 0, s: 0, l: 0 })).toBe("#000000");
  });

  it("round-trips through hexToHsl", () => {
    const original = "#3b82f6";
    const hsl = hexToHsl(original);
    const roundTripped = hslToHex(hsl);
    // Round-trip within 1 hex step due to integer rounding
    const orig = parseInt(original.slice(1), 16);
    const rt = parseInt(roundTripped.slice(1), 16);
    expect(Math.abs(orig - rt)).toBeLessThan(0x020202);
  });

  it("produces a 7-char hex string starting with #", () => {
    const hex = hslToHex({ h: 217, s: 91, l: 60 });
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });
});

// ─── generateColorScale ───────────────────────────────────────────────────────

describe("generateColorScale", () => {
  it("returns all 11 scale steps", () => {
    const scale = generateColorScale("#3b82f6");
    for (const step of SCALE_STEPS) {
      expect(scale[step]).toBeDefined();
      expect(scale[step]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("step 50 is lighter than step 500", () => {
    const scale = generateColorScale("#3b82f6");
    const l50 = hexToHsl(scale["50"]).l;
    const l500 = hexToHsl(scale["500"]).l;
    expect(l50).toBeGreaterThan(l500);
  });

  it("step 500 is lighter than step 950", () => {
    const scale = generateColorScale("#3b82f6");
    const l500 = hexToHsl(scale["500"]).l;
    const l950 = hexToHsl(scale["950"]).l;
    expect(l500).toBeGreaterThan(l950);
  });

  it("scale is monotonically decreasing in lightness (50→950)", () => {
    const scale = generateColorScale("#e11d48"); // rose
    let prevL = 100;
    for (const step of SCALE_STEPS) {
      const l = hexToHsl(scale[step]).l;
      expect(l).toBeLessThan(prevL);
      prevL = l;
    }
  });

  it("preserves the original hue throughout the scale", () => {
    const input = "#3b82f6"; // blue
    const scale = generateColorScale(input);
    const sourceHue = hexToHsl(input).h;
    for (const step of SCALE_STEPS) {
      const { h } = hexToHsl(scale[step]);
      // Allow up to 15 degrees — at extreme lightness ends, integer rounding in
      // the hex conversion can introduce hue drift.
      expect(Math.abs(h - sourceHue)).toBeLessThan(15);
    }
  });

  it("step 50 is visually very light (L > 90)", () => {
    const scale = generateColorScale("#3b82f6");
    expect(hexToHsl(scale["50"]).l).toBeGreaterThan(90);
  });

  it("step 950 is visually very dark (L < 20)", () => {
    const scale = generateColorScale("#3b82f6");
    expect(hexToHsl(scale["950"]).l).toBeLessThan(20);
  });

  it("works for different hues (red, green, purple)", () => {
    for (const hex of ["#ef4444", "#22c55e", "#a855f7"]) {
      const scale = generateColorScale(hex);
      expect(Object.keys(scale)).toHaveLength(11);
    }
  });
});

// ─── generateNeutralScale ─────────────────────────────────────────────────────

describe("generateNeutralScale", () => {
  it("returns all 11 scale steps", () => {
    const scale = generateNeutralScale("#3b82f6");
    for (const step of SCALE_STEPS) {
      expect(scale[step]).toBeDefined();
    }
  });

  it("has very low saturation (near-gray)", () => {
    const scale = generateNeutralScale("#3b82f6");
    for (const step of SCALE_STEPS) {
      const { s } = hexToHsl(scale[step]);
      expect(s).toBeLessThan(12); // ≤10% sat + floating point
    }
  });

  it("is monotonically decreasing in lightness", () => {
    const scale = generateNeutralScale("#3b82f6");
    let prevL = 100;
    for (const step of SCALE_STEPS) {
      const l = hexToHsl(scale[step]).l;
      expect(l).toBeLessThan(prevL);
      prevL = l;
    }
  });

  it("has lower saturation than the brand scale from the same hex", () => {
    const hex = "#3b82f6";
    const brandScale = generateColorScale(hex);
    const neutralScale = generateNeutralScale(hex);
    const brandS500 = hexToHsl(brandScale["500"]).s;
    const neutralS500 = hexToHsl(neutralScale["500"]).s;
    expect(neutralS500).toBeLessThan(brandS500);
  });
});

// ─── generateFeedbackScales ───────────────────────────────────────────────────

describe("generateFeedbackScales", () => {
  it("returns success, warning, error, info", () => {
    const scales = generateFeedbackScales();
    expect(scales.success).toBeDefined();
    expect(scales.warning).toBeDefined();
    expect(scales.error).toBeDefined();
    expect(scales.info).toBeDefined();
  });

  it("each feedback scale has 11 steps", () => {
    const scales = generateFeedbackScales();
    for (const name of ["success", "warning", "error", "info"]) {
      for (const step of SCALE_STEPS) {
        expect(scales[name]![step]).toBeDefined();
        expect(scales[name]![step]).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it("success scale is greenish (H between 100–160)", () => {
    const { success } = generateFeedbackScales();
    const { h } = hexToHsl(success!["500"]);
    expect(h).toBeGreaterThan(100);
    expect(h).toBeLessThan(160);
  });

  it("error scale is reddish (H < 20 or H > 340)", () => {
    const { error } = generateFeedbackScales();
    const { h } = hexToHsl(error!["500"]);
    expect(h < 20 || h > 340).toBe(true);
  });

  it("warning scale has higher saturation than other scales (more vivid)", () => {
    const scales = generateFeedbackScales();
    const warnS = hexToHsl(scales.warning!["500"]).s;
    const infoS = hexToHsl(scales.info!["500"]).s;
    expect(warnS).toBeGreaterThan(infoS);
  });
});

// ─── buildColorPrimitives ─────────────────────────────────────────────────────

describe("buildColorPrimitives", () => {
  const input = { primary: "#3b82f6" };
  let tokens: ReturnType<typeof buildColorPrimitives>;

  it("returns a DTCG token file", () => {
    tokens = buildColorPrimitives(input);
    expect(tokens).toBeDefined();
    expect(tokens.color).toBeDefined();
  });

  it("includes white and black primitives", () => {
    tokens = buildColorPrimitives(input);
    const color = tokens.color as Record<string, unknown>;
    expect((color.white as { $value: string }).$value).toBe("#ffffff");
    expect((color.black as { $value: string }).$value).toBe("#000000");
  });

  it("generates brand, neutral, and feedback color groups", () => {
    tokens = buildColorPrimitives(input);
    const color = tokens.color as Record<string, unknown>;
    expect(color.brand).toBeDefined();
    expect(color.neutral).toBeDefined();
    expect(color.success).toBeDefined();
    expect(color.warning).toBeDefined();
    expect(color.error).toBeDefined();
    expect(color.info).toBeDefined();
  });

  it("brand group has all 11 scale steps with $value", () => {
    tokens = buildColorPrimitives(input);
    const brand = (tokens.color as Record<string, Record<string, { $value: string }>>).brand!;
    for (const step of SCALE_STEPS) {
      expect(brand[step]).toBeDefined();
      expect(brand[step]!.$value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("includes secondary scale when secondary color is provided", () => {
    const withSecondary = buildColorPrimitives({ primary: "#3b82f6", secondary: "#e11d48" });
    const color = withSecondary.color as Record<string, unknown>;
    expect(color.secondary).toBeDefined();
  });

  it("includes accent scale when accent color is provided", () => {
    const withAccent = buildColorPrimitives({ primary: "#3b82f6", accent: "#a855f7" });
    const color = withAccent.color as Record<string, unknown>;
    expect(color.accent).toBeDefined();
  });

  it("does not include secondary when not provided", () => {
    tokens = buildColorPrimitives(input);
    const color = tokens.color as Record<string, unknown>;
    expect(color.secondary).toBeUndefined();
  });
});

// ─── buildSemanticLight ───────────────────────────────────────────────────────

describe("buildSemanticLight", () => {
  it("returns a color token group", () => {
    const tokens = buildSemanticLight();
    expect(tokens.color).toBeDefined();
  });

  it("has all required semantic groups", () => {
    const color = buildSemanticLight().color as Record<string, unknown>;
    expect(color.background).toBeDefined();
    expect(color.text).toBeDefined();
    expect(color.interactive).toBeDefined();
    expect(color.border).toBeDefined();
    expect(color.feedback).toBeDefined();
    expect(color.surface).toBeDefined();
  });

  it("all $values are DTCG references {color.*}", () => {
    const color = buildSemanticLight().color as Record<string, unknown>;
    function checkRefs(obj: unknown): void {
      if (obj && typeof obj === "object") {
        if ("$value" in obj) {
          const v = (obj as { $value: unknown }).$value;
          if (typeof v === "string") {
            expect(v).toMatch(/^\{color\./);
          }
        } else {
          for (const val of Object.values(obj as Record<string, unknown>)) {
            checkRefs(val);
          }
        }
      }
    }
    checkRefs(color);
  });

  it("interactive.default references brand.600", () => {
    const color = buildSemanticLight().color as Record<string, Record<string, { $value: string }>>;
    expect(color.interactive!.default!.$value).toBe("{color.brand.600}");
  });

  it("background.primary references white", () => {
    const color = buildSemanticLight().color as Record<string, Record<string, { $value: string }>>;
    expect(color.background!.primary!.$value).toBe("{color.white}");
  });
});

// ─── buildSemanticDark ────────────────────────────────────────────────────────

describe("buildSemanticDark", () => {
  it("has the same top-level groups as light theme", () => {
    const light = buildSemanticLight().color as Record<string, unknown>;
    const dark = buildSemanticDark().color as Record<string, unknown>;
    for (const key of Object.keys(light)) {
      if (key === "$type") continue;
      expect(dark[key]).toBeDefined();
    }
  });

  it("background.primary references neutral.950 (dark surface)", () => {
    const color = buildSemanticDark().color as Record<string, Record<string, { $value: string }>>;
    expect(color.background!.primary!.$value).toBe("{color.neutral.950}");
  });

  it("interactive.default uses a lighter brand shade than light theme", () => {
    const light = buildSemanticLight().color as Record<string, Record<string, { $value: string }>>;
    const dark = buildSemanticDark().color as Record<string, Record<string, { $value: string }>>;
    const lightRef = light.interactive!.default!.$value; // brand.600
    const darkRef = dark.interactive!.default!.$value;   // brand.400
    expect(lightRef).not.toBe(darkRef);
    // Light uses a darker shade (higher number = darker in brand scales)
    const lightStep = parseInt(lightRef.match(/\.(\d+)/)?.[1] ?? "0");
    const darkStep = parseInt(darkRef.match(/\.(\d+)/)?.[1] ?? "0");
    expect(lightStep).toBeGreaterThan(darkStep); // 600 > 400
  });
});
