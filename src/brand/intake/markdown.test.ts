import { describe, expect, it } from "bun:test";
import { extractFonts, extractColors, extractBrandName } from "./markdown.js";

describe("extractFonts", () => {
  it("extracts a single font family from a colon pattern", () => {
    expect(extractFonts("Heading font: Inter")).toContain("Inter");
  });

  it("does not capture the next line as part of the font name", () => {
    // Regression: "Inter\nBody" was captured when \s was used in the colonPattern
    const brief = `Heading font: Inter\nBody font: Inter\nCode font: JetBrains Mono`;
    const fonts = extractFonts(brief);
    for (const font of fonts) {
      expect(font).not.toContain("\n");
    }
  });

  it("extracts multiple distinct font families from a brief", () => {
    const brief = [
      "## Typography",
      "Heading font: Inter",
      "Body font: Inter",
      "Code font: JetBrains Mono",
    ].join("\n");
    const fonts = extractFonts(brief);
    expect(fonts).toContain("Inter");
    expect(fonts).toContain("JetBrains Mono");
  });

  it("deduplicates repeated fonts", () => {
    const brief = "Heading font: Inter\nBody font: Inter";
    const fonts = extractFonts(brief);
    expect(fonts.filter((f) => f === "Inter")).toHaveLength(1);
  });

  it("handles two-word font names without crossing newlines", () => {
    const brief = "Heading font: Source Sans\nBody font: Source Sans";
    const fonts = extractFonts(brief);
    expect(fonts).toContain("Source Sans");
    for (const font of fonts) {
      expect(font).not.toContain("\n");
    }
  });
});

describe("extractColors", () => {
  it("extracts hex colors from text", () => {
    const text = "Primary: #0EA5E9\nSecondary: #7C3AED";
    expect(extractColors(text)).toEqual(["#0EA5E9", "#7C3AED"]);
  });

  it("deduplicates colors", () => {
    const text = "Color: #0EA5E9 and also #0EA5E9";
    expect(extractColors(text)).toHaveLength(1);
  });
});

describe("extractBrandName", () => {
  it("extracts brand name from H1", () => {
    expect(extractBrandName("# Brand Brief — Zephyr")).toBe("Zephyr");
  });

  it("extracts brand name from colon pattern", () => {
    expect(extractBrandName("Brand name: Zephyr")).toBe("Zephyr");
  });
});
