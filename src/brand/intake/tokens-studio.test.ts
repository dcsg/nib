/**
 * Unit tests for src/brand/intake/tokens-studio.ts
 *
 * Tests use temp files created per describe block and cleaned up via afterAll.
 * No network calls; no Pencil MCP; no brand.config.json writes.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tokensStudioIntake, tokensStudioPreview } from "./tokens-studio.js";

// ─── Fixture factory ───────────────────────────────────────────────────────────

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "nib-ts-test-"));
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

/** Write a fixture JSON file to tmpDir and return its path. */
async function writeFixture(name: string, content: unknown): Promise<string> {
  const path = join(tmpDir, name);
  await writeFile(path, JSON.stringify(content, null, 2));
  return path;
}

// ─── Fixtures ──────────────────────────────────────────────────────────────────

/** Minimal Tokens Studio file with flat structure. */
const MINIMAL_TOKENS = {
  global: {
    color: {
      brand: {
        primary: { value: "#3b82f6", type: "color" },
        secondary: { value: "#6366f1", type: "color" },
      },
      neutral: {
        white: { value: "#ffffff", type: "color" },
        black: { value: "#000000", type: "color" },
      },
    },
    typography: {
      fontFamily: {
        sans: { value: "Inter, sans-serif", type: "fontFamilies" },
        mono: { value: "JetBrains Mono, monospace", type: "fontFamilies" },
      },
    },
  },
};

/** Multi-set Tokens Studio file (as exported by Tokens Studio plugin). */
const MULTI_SET_TOKENS = {
  $metadata: {
    tokenSetOrder: ["core", "semantic"],
  },
  core: {
    color: {
      "brand-500": { value: "#2563eb", type: "color" },
      "brand-400": { value: "#60a5fa", type: "color" },
      "neutral-900": { value: "#111827", type: "color" },
    },
  },
  semantic: {
    color: {
      interactive: { value: "{core.color.brand-500}", type: "color" },
      background: { value: "#ffffff", type: "color" },
    },
    typography: {
      fontFamily: { value: "Geist, sans-serif", type: "fontFamilies" },
    },
  },
};

/** File without explicit type annotations — inferred from hex values. */
const UNTYPED_TOKENS = {
  brand: {
    primary: { value: "#e11d48" },
    accent:  { value: "#f59e0b" },
  },
  neutrals: {
    100: { value: "#f3f4f6" },
    900: { value: "#111827" },
  },
};

/** File with an explicit brand name token. */
const NAMED_BRAND_TOKENS = {
  global: {
    "brand-name": { value: "Acme Corp", type: "other" },
    color: {
      primary: { value: "#7c3aed", type: "color" },
    },
  },
};

/** File with only alias (reference) tokens — no resolvable color values. */
const ALIAS_ONLY_TOKENS = {
  semantic: {
    interactive: { value: "{global.color.brand.primary}", type: "color" },
    bg: { value: "{global.color.neutral.white}", type: "color" },
  },
};

/** File with alias tokens AND direct values. */
const MIXED_ALIAS_TOKENS = {
  primitives: {
    "blue-600": { value: "#2563eb", type: "color" },
    "indigo-500": { value: "#6366f1", type: "color" },
  },
  semantic: {
    interactive: { value: "{primitives.blue-600}", type: "color" },
    accent: { value: "{primitives.indigo-500}", type: "color" },
  },
};

// ─── tokensStudioIntake ────────────────────────────────────────────────────────

describe("tokensStudioIntake", () => {
  it("returns a BrandInput with a name, colors, and typography", async () => {
    const path = await writeFixture("minimal.json", MINIMAL_TOKENS);
    const result = await tokensStudioIntake(path);

    expect(result).toMatchObject({
      name: expect.any(String),
      colors: {
        primary: expect.stringMatching(/^#[0-9a-fA-F]{3,8}$/),
      },
      typography: {
        fontFamily: expect.any(String),
      },
    });
  });

  it("detects the primary color from an explicit 'primary' token", async () => {
    const path = await writeFixture("minimal2.json", MINIMAL_TOKENS);
    const result = await tokensStudioIntake(path);
    expect(result.colors.primary).toBe("#3b82f6");
  });

  it("sets secondary color from the second ranked color token", async () => {
    const path = await writeFixture("minimal3.json", MINIMAL_TOKENS);
    const result = await tokensStudioIntake(path);
    // secondary should be detected — either #6366f1 or another non-primary color
    expect(result.colors.secondary).toBeTruthy();
    expect(result.colors.secondary).toMatch(/^#[0-9a-fA-F]{3,8}$/);
  });

  it("extracts fontFamily from fontFamilies token", async () => {
    const path = await writeFixture("minimal4.json", MINIMAL_TOKENS);
    const result = await tokensStudioIntake(path);
    expect(result.typography.fontFamily).toBe("Inter");
  });

  it("extracts monospace font into monoFontFamily", async () => {
    const path = await writeFixture("minimal5.json", MINIMAL_TOKENS);
    const result = await tokensStudioIntake(path);
    expect(result.typography.monoFontFamily).toMatch(/JetBrains/i);
  });

  it("skips $metadata and $themes keys (Tokens Studio metadata)", async () => {
    const path = await writeFixture("multi-set.json", MULTI_SET_TOKENS);
    const result = await tokensStudioIntake(path);
    // Should not throw and should produce a valid result
    expect(result.colors.primary).toMatch(/^#[0-9a-fA-F]{3,8}$/);
  });

  it("resolves semantic font from multi-set file", async () => {
    const path = await writeFixture("multi-set2.json", MULTI_SET_TOKENS);
    const result = await tokensStudioIntake(path);
    expect(result.typography.fontFamily).toBe("Geist");
  });

  it("infers color type from hex value when type field is absent", async () => {
    const path = await writeFixture("untyped.json", UNTYPED_TOKENS);
    const result = await tokensStudioIntake(path);
    expect(result.colors.primary).toBe("#e11d48");
  });

  it("prefers tokens whose path contains 'primary' or 'brand' over neutral colors", async () => {
    // Fixture with a brand.primary color and a neutral that should be deprioritized
    const fixture = {
      brand: { primary: { value: "#e11d48", type: "color" } },
      neutrals: {
        "100": { value: "#f3f4f6", type: "color" },
        "900": { value: "#111827", type: "color" },
      },
    };
    const path = await writeFixture("brand-vs-neutral.json", fixture);
    const result = await tokensStudioIntake(path);
    // brand.primary should win over neutrals.100 or neutrals.900
    expect(result.colors.primary).toBe("#e11d48");
  });

  it("uses brand name token when present", async () => {
    const path = await writeFixture("named.json", NAMED_BRAND_TOKENS);
    const result = await tokensStudioIntake(path);
    expect(result.name).toBe("Acme Corp");
  });

  it("falls back to filename-derived brand name when no name token", async () => {
    const path = await writeFixture("my-company.json", MINIMAL_TOKENS);
    const result = await tokensStudioIntake(path);
    expect(result.name).toBe("My Company");
  });

  it("ignores alias-only tokens and still finds direct-value colors", async () => {
    const path = await writeFixture("mixed-alias.json", MIXED_ALIAS_TOKENS);
    const result = await tokensStudioIntake(path);
    // Should pick up blue-600 or indigo-500, not an alias reference
    expect(result.colors.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(result.colors.primary).not.toContain("{");
  });

  it("throws when the file has no resolvable color tokens", async () => {
    const path = await writeFixture("alias-only.json", ALIAS_ONLY_TOKENS);
    await expect(tokensStudioIntake(path)).rejects.toThrow(/no color tokens found/i);
  });

  it("throws when the file is not valid JSON", async () => {
    const path = join(tmpDir, "invalid.json");
    await writeFile(path, "not json { }}}");
    await expect(tokensStudioIntake(path)).rejects.toThrow(/invalid JSON/i);
  });

  it("throws when the top-level value is an array", async () => {
    const path = await writeFixture("array.json", [{ value: "#fff" }]);
    await expect(tokensStudioIntake(path)).rejects.toThrow(/expected a JSON object/i);
  });

  it("defaults personality to ['professional']", async () => {
    const path = await writeFixture("minimal6.json", MINIMAL_TOKENS);
    const result = await tokensStudioIntake(path);
    expect(result.personality).toEqual(["professional"]);
  });

  it("defaults fontFamily to 'Inter' when no font token is found", async () => {
    const noFont = { color: { primary: { value: "#3b82f6", type: "color" } } };
    const path = await writeFixture("no-font.json", noFont);
    const result = await tokensStudioIntake(path);
    expect(result.typography.fontFamily).toBe("Inter");
  });

  it("returns first font name only (strips comma-separated stack)", async () => {
    const path = await writeFixture("minimal7.json", MINIMAL_TOKENS);
    const result = await tokensStudioIntake(path);
    // "Inter, sans-serif" → "Inter"
    expect(result.typography.fontFamily).not.toContain(",");
  });
});

// ─── tokensStudioPreview ───────────────────────────────────────────────────────

describe("tokensStudioPreview", () => {
  it("returns preview object without writing any files", async () => {
    const path = await writeFixture("preview.json", MINIMAL_TOKENS);
    const preview = await tokensStudioPreview(path);

    expect(preview).toMatchObject({
      brandName: expect.any(String),
      primaryColor: expect.stringMatching(/^#[0-9a-fA-F]{3,8}$/),
      tokenCount: expect.any(Number),
      colorCount: expect.any(Number),
    });
  });

  it("tokenCount is greater than zero for a valid file", async () => {
    const path = await writeFixture("preview2.json", MINIMAL_TOKENS);
    const preview = await tokensStudioPreview(path);
    expect(preview.tokenCount).toBeGreaterThan(0);
  });

  it("colorCount matches the number of color tokens in the file", async () => {
    // MINIMAL_TOKENS has: brand.primary, brand.secondary, neutral.white, neutral.black = 4 colors
    const path = await writeFixture("preview3.json", MINIMAL_TOKENS);
    const preview = await tokensStudioPreview(path);
    expect(preview.colorCount).toBe(4);
  });

  it("secondaryColor is a hex string or null", async () => {
    const path = await writeFixture("preview4.json", MINIMAL_TOKENS);
    const preview = await tokensStudioPreview(path);
    if (preview.secondaryColor !== null) {
      expect(preview.secondaryColor).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    }
  });

  it("fontFamily is detected from font token", async () => {
    const path = await writeFixture("preview5.json", MINIMAL_TOKENS);
    const preview = await tokensStudioPreview(path);
    expect(preview.fontFamily).toBe("Inter");
  });

  it("fontFamily is null when no font token is present", async () => {
    const noFont = { color: { primary: { value: "#3b82f6", type: "color" } } };
    const path = await writeFixture("preview-no-font.json", noFont);
    const preview = await tokensStudioPreview(path);
    expect(preview.fontFamily).toBeNull();
  });

  it("throws on invalid JSON", async () => {
    const path = join(tmpDir, "bad-preview.json");
    await writeFile(path, "{ bad json");
    await expect(tokensStudioPreview(path)).rejects.toThrow(/invalid JSON/i);
  });

  it("excludes alias-only tokens from colorCount", async () => {
    const path = await writeFixture("preview-mixed.json", MIXED_ALIAS_TOKENS);
    const preview = await tokensStudioPreview(path);
    // Only direct hex values should be counted (blue-600, indigo-500 = 2)
    expect(preview.colorCount).toBe(2);
  });
});
