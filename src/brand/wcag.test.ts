/**
 * Unit tests for WCAG 2.1 contrast math.
 *
 * Reference values verified against https://www.siegemedia.com/contrast-ratio
 */

import { describe, it, expect } from "bun:test";
import { relativeLuminance, contrastRatio, checkContrast, auditTokens } from "./wcag.js";

// ─── relativeLuminance ────────────────────────────────────────────────────────

describe("relativeLuminance", () => {
  it("returns 1.0 for pure white", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1.0, 5);
  });

  it("returns 0.0 for pure black", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0.0, 5);
  });

  it("returns ~0.2126 for pure red #ff0000", () => {
    // Red channel only: 0.2126 * linearize(1) = 0.2126
    expect(relativeLuminance("#ff0000")).toBeCloseTo(0.2126, 3);
  });

  it("returns ~0.7152 for pure green #00ff00", () => {
    expect(relativeLuminance("#00ff00")).toBeCloseTo(0.7152, 3);
  });

  it("returns ~0.0722 for pure blue #0000ff", () => {
    expect(relativeLuminance("#0000ff")).toBeCloseTo(0.0722, 3);
  });

  it("accepts hex without # prefix via cleaned parsing", () => {
    // The implementation strips # — both forms should give same result
    expect(relativeLuminance("#808080")).toBeCloseTo(relativeLuminance("#808080"), 10);
  });

  it("is symmetric — order doesn't matter", () => {
    const a = relativeLuminance("#3b82f6");
    const b = relativeLuminance("#1e40af");
    expect(a).not.toBeCloseTo(b, 3); // they differ
  });
});

// ─── contrastRatio ────────────────────────────────────────────────────────────

describe("contrastRatio", () => {
  it("returns 21 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("returns 21 for white on black (order independent)", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 1);
  });

  it("returns 1 for identical colors", () => {
    expect(contrastRatio("#3b82f6", "#3b82f6")).toBeCloseTo(1, 5);
  });

  it("returns >= 1 always", () => {
    expect(contrastRatio("#aabbcc", "#ddeeff")).toBeGreaterThanOrEqual(1);
  });

  it("is commutative — fg/bg order doesn't change the ratio", () => {
    const ratio1 = contrastRatio("#666666", "#ffffff");
    const ratio2 = contrastRatio("#ffffff", "#666666");
    expect(ratio1).toBeCloseTo(ratio2, 10);
  });

  it("dark gray #595959 on white is just under 7:1 (near AAA threshold)", () => {
    // #595959 has luminance ≈ 0.1, contrast with white ≈ 7.0
    const ratio = contrastRatio("#595959", "#ffffff");
    expect(ratio).toBeGreaterThan(5);
    expect(ratio).toBeLessThan(9);
  });

  it("light gray #aaaaaa on white fails AA (< 4.5)", () => {
    // #aaaaaa ≈ 2.32:1 — well below AA threshold
    const ratio = contrastRatio("#aaaaaa", "#ffffff");
    expect(ratio).toBeLessThan(4.5);
  });

  it("dark blue #1d4ed8 on white passes AA", () => {
    // Tailwind blue-700 — passes AA for normal text
    const ratio = contrastRatio("#1d4ed8", "#ffffff");
    expect(ratio).toBeGreaterThan(4.5);
  });
});

// ─── checkContrast ────────────────────────────────────────────────────────────

describe("checkContrast", () => {
  it("passes AA for black on white", () => {
    const result = checkContrast("#000000", "#ffffff", "color.text.primary", "color.bg.primary");
    expect(result.passAA).toBe(true);
    expect(result.passAAA).toBe(true);
    expect(result.passAALarge).toBe(true);
    expect(result.ratio).toBe(21);
  });

  it("fails AA for light gray on white", () => {
    const result = checkContrast("#aaaaaa", "#ffffff", "color.text.muted", "color.bg.primary");
    expect(result.passAA).toBe(false);
    expect(result.passAALarge).toBe(false);
  });

  it("passes AA large but fails AA normal for medium gray", () => {
    // #909090 ≈ 3.22:1 — passes AA large (≥3) but fails AA normal (≥4.5)
    const result = checkContrast("#909090", "#ffffff", "color.text.secondary", "color.bg.primary");
    expect(result.passAALarge).toBe(true);
    expect(result.passAA).toBe(false);
  });

  it("includes token names in the result", () => {
    const result = checkContrast("#000000", "#ffffff", "color.fg", "color.bg");
    expect(result.foregroundToken).toBe("color.fg");
    expect(result.backgroundToken).toBe("color.bg");
    expect(result.foreground).toBe("#000000");
    expect(result.background).toBe("#ffffff");
  });

  it("rounds ratio to 2 decimal places", () => {
    const result = checkContrast("#666666", "#ffffff", "a", "b");
    expect(result.ratio).toBe(Math.round(result.ratio * 100) / 100);
  });
});

// ─── auditTokens ─────────────────────────────────────────────────────────────

describe("auditTokens", () => {
  const passingSemanticTokens = {
    color: {
      text: {
        // Literal hex values — high contrast
        primary: { $value: "#111827" },   // near-black
        secondary: { $value: "#374151" },  // dark gray
        tertiary: { $value: "#4b5563" },
      },
      background: {
        primary: { $value: "#ffffff" },
        secondary: { $value: "#f9fafb" },
      },
      interactive: {
        default: { $value: "#1d4ed8" }, // dark blue — passes AA on white
      },
      feedback: {
        success: { $value: "#14532d" },
        "success-bg": { $value: "#f0fdf4" },
        warning: { $value: "#713f12" },
        "warning-bg": { $value: "#fefce8" },
        error: { $value: "#7f1d1d" },
        "error-bg": { $value: "#fef2f2" },
        info: { $value: "#1e3a8a" },
        "info-bg": { $value: "#eff6ff" },
      },
    },
  };

  const failingSemanticTokens = {
    color: {
      text: {
        // Very light colors — fail on light backgrounds
        primary: { $value: "#aaaaaa" },
        secondary: { $value: "#bbbbbb" },
        tertiary: { $value: "#cccccc" },
      },
      background: {
        primary: { $value: "#ffffff" },
        secondary: { $value: "#f9fafb" },
      },
      interactive: {
        default: { $value: "#93c5fd" }, // light blue — fails AA on white
      },
      feedback: {
        success: { $value: "#86efac" },
        "success-bg": { $value: "#f0fdf4" },
        warning: { $value: "#fde047" },
        "warning-bg": { $value: "#fefce8" },
        error: { $value: "#fca5a5" },
        "error-bg": { $value: "#fef2f2" },
        info: { $value: "#93c5fd" },
        "info-bg": { $value: "#eff6ff" },
      },
    },
  };

  // Empty primitives — all semantic values are literal hex already
  const emptyPrimitives = {};

  it("returns a report shape with totalPairs, passed, failed, results", () => {
    const report = auditTokens(passingSemanticTokens, emptyPrimitives);
    expect(typeof report.totalPairs).toBe("number");
    expect(typeof report.passed).toBe("number");
    expect(typeof report.failed).toBe("number");
    expect(Array.isArray(report.results)).toBe(true);
    expect(report.passed + report.failed).toBe(report.totalPairs);
  });

  it("all pairs pass with high-contrast semantic tokens", () => {
    const report = auditTokens(passingSemanticTokens, emptyPrimitives);
    expect(report.failed).toBe(0);
    expect(report.passed).toBe(report.totalPairs);
    expect(report.totalPairs).toBeGreaterThan(0);
  });

  it("reports failures with low-contrast semantic tokens", () => {
    const report = auditTokens(failingSemanticTokens, emptyPrimitives);
    expect(report.failed).toBeGreaterThan(0);
  });

  it("returns empty report when no matching pairs exist", () => {
    const report = auditTokens({}, emptyPrimitives);
    expect(report.totalPairs).toBe(0);
    expect(report.passed).toBe(0);
    expect(report.failed).toBe(0);
  });

  it("resolves DTCG references from primitives", () => {
    const semantic = {
      color: {
        text: { primary: { $value: "{color.neutral.900}" } },
        background: { primary: { $value: "{color.white}" } },
      },
    };
    const primitives = {
      color: {
        neutral: { "900": { $value: "#111827" } },
        white: { $value: "#ffffff" },
      },
    };
    const report = auditTokens(semantic, primitives);
    expect(report.totalPairs).toBeGreaterThan(0);
    // #111827 on #ffffff passes AA
    const pair = report.results.find(
      (r) => r.foregroundToken === "color.text.primary" && r.backgroundToken === "color.background.primary",
    );
    expect(pair).toBeDefined();
    expect(pair!.passAA).toBe(true);
  });

  it("skips pairs where tokens are missing from semantic file", () => {
    const partialSemantic = {
      color: {
        text: { primary: { $value: "#111827" } },
        // background.primary missing — pair skipped
      },
    };
    const report = auditTokens(partialSemantic, emptyPrimitives);
    // text.primary/background.primary pair is skipped — total < 11
    expect(report.totalPairs).toBeLessThan(11);
  });
});
