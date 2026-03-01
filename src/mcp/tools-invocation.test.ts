/**
 * MCP tool invocation tests — Priority 3.
 *
 * These tests call MCP tools with real fixture configs and verify they produce
 * correct outputs, not just valid response shapes. Each test exercises the full
 * stack: MCP client → server → tool handler → business logic → file system.
 *
 * Integration tests that require Pencil MCP (nib_capture, nib_brand_push)
 * are guarded with test.skipIf(!isIntegration) per INV-007.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createNibMcpServer } from "./server.js";

const isIntegration = process.env["NIB_INTEGRATION"] === "1";

async function createTestPair() {
  const server = createNibMcpServer();
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "nib-invocation-test", version: "1.0.0" });
  await client.connect(clientTransport);
  return { client };
}

// ─── Shared fixture data ──────────────────────────────────────────────────────

const PRIMITIVE_TOKENS = {
  color: {
    $type: "color",
    white: { $value: "#ffffff" },
    black: { $value: "#000000" },
    gray200: { $value: "#e5e7eb" },
    gray300: { $value: "#d1d5db" },
    brand: {
      "500": { $value: "#3b82f6" },
      "600": { $value: "#2563eb" },
    },
    neutral: {
      "50": { $value: "#f9fafb" },
      "200": { $value: "#e5e7eb" },
      "600": { $value: "#4b5563" },
      "900": { $value: "#111827" },
    },
  },
};

const SEMANTIC_LIGHT_TOKENS = {
  color: {
    $type: "color",
    background: { primary: { $value: "{color.white}" } },
    text: {
      primary: { $value: "{color.black}" },
      secondary: { $value: "{color.neutral.600}" },
    },
    border: { primary: { $value: "{color.neutral.200}" } },
    interactive: { default: { $value: "{color.brand.600}" } },
  },
};

const SEMANTIC_DARK_TOKENS = {
  color: {
    $type: "color",
    background: { primary: { $value: "{color.neutral.900}" } },
    text: { primary: { $value: "{color.white}" } },
    interactive: { default: { $value: "{color.brand.500}" } },
  },
};

const TYPOGRAPHY_TOKENS = {
  "font-family": { sans: { $value: "Inter, sans-serif", $type: "fontFamily" } },
  "font-size": {
    xs: { $value: "12px", $type: "dimension" },
    sm: { $value: "14px", $type: "dimension" },
    base: { $value: "16px", $type: "dimension" },
    lg: { $value: "18px", $type: "dimension" },
    xl: { $value: "20px", $type: "dimension" },
    "2xl": { $value: "24px", $type: "dimension" },
  },
};

const SPACING_TOKENS = {
  spacing: { md: { $value: "16px", $type: "dimension" } },
};

const RADIUS_TOKENS = {
  "border-radius": { md: { $value: "6px", $type: "dimension" } },
};

const ELEVATION_TOKENS = {
  elevation: {
    sm: {
      $value: { offsetX: "0px", offsetY: "1px", blur: "2px", spread: "0px", color: "rgba(0,0,0,0.05)" },
      $type: "shadow",
    },
  },
};

const MOTION_TOKENS = {
  duration: { fast: { $value: "100ms", $type: "duration" }, normal: { $value: "200ms", $type: "duration" } },
};

const SIZING_TOKENS = { sizing: { icon: { $value: "24px", $type: "dimension" } } };
const BORDER_WIDTH_TOKENS = { "border-width": { default: { $value: "1px", $type: "dimension" } } };
const OPACITY_TOKENS = { opacity: { disabled: { $value: "0.4", $type: "number" } } };
const Z_INDEX_TOKENS = { "z-index": { modal: { $value: "1000", $type: "number" } } };
const BREAKPOINT_TOKENS = {
  breakpoint: {
    md: { $value: "768px", $type: "dimension" },
    lg: { $value: "1024px", $type: "dimension" },
  },
};

/** Write the full set of required token fixtures into a tokens directory. */
async function writeTokenFixtures(tokensDir: string): Promise<void> {
  const colorDir = join(tokensDir, "color");
  await mkdir(colorDir, { recursive: true });
  await Promise.all([
    writeFile(join(colorDir, "primitives.tokens.json"), JSON.stringify(PRIMITIVE_TOKENS, null, 2)),
    writeFile(join(colorDir, "semantic-light.tokens.json"), JSON.stringify(SEMANTIC_LIGHT_TOKENS, null, 2)),
    writeFile(join(colorDir, "semantic-dark.tokens.json"), JSON.stringify(SEMANTIC_DARK_TOKENS, null, 2)),
    writeFile(join(tokensDir, "typography.tokens.json"), JSON.stringify(TYPOGRAPHY_TOKENS, null, 2)),
    writeFile(join(tokensDir, "spacing.tokens.json"), JSON.stringify(SPACING_TOKENS, null, 2)),
    writeFile(join(tokensDir, "border-radius.tokens.json"), JSON.stringify(RADIUS_TOKENS, null, 2)),
    writeFile(join(tokensDir, "elevation.tokens.json"), JSON.stringify(ELEVATION_TOKENS, null, 2)),
    writeFile(join(tokensDir, "motion.tokens.json"), JSON.stringify(MOTION_TOKENS, null, 2)),
    writeFile(join(tokensDir, "sizing.tokens.json"), JSON.stringify(SIZING_TOKENS, null, 2)),
    writeFile(join(tokensDir, "border-width.tokens.json"), JSON.stringify(BORDER_WIDTH_TOKENS, null, 2)),
    writeFile(join(tokensDir, "opacity.tokens.json"), JSON.stringify(OPACITY_TOKENS, null, 2)),
    writeFile(join(tokensDir, "z-index.tokens.json"), JSON.stringify(Z_INDEX_TOKENS, null, 2)),
    writeFile(join(tokensDir, "breakpoints.tokens.json"), JSON.stringify(BREAKPOINT_TOKENS, null, 2)),
  ]);
}

/** Write a brand.config.json pointing at a given tokens directory. */
async function writeBrandConfig(
  configPath: string,
  tokensDir: string,
  outputDir: string,
): Promise<void> {
  const config = {
    version: "1",
    generator: "nib",
    brand: { name: "Invocation Test Brand", personality: [] },
    tokens: tokensDir,
    platforms: {
      css: join(outputDir, "variables.css"),
      tailwind: join(outputDir, "preset.js"),
      pencil: join(outputDir, "variables.json"),
      penFile: join(outputDir, "design-system.pen"),
    },
    output: outputDir,
    ai: { provider: false },
  };
  await mkdir(join(configPath, ".."), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2));
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

/** /tmp dir for brand tests (no validateProjectPath restriction). */
let tmpDir: string;

/**
 * Dir inside process.cwd() for prototype tests — required because
 * nib_build_prototype validates the input path is within the project root.
 */
let protoFixtureDir: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "nib-invocation-"));

  // Prototype fixtures must live inside the project root to pass validateProjectPath
  protoFixtureDir = join(process.cwd(), `.nib-test-proto-${Date.now()}`);
  await mkdir(protoFixtureDir, { recursive: true });
});

afterAll(async () => {
  await Promise.all([
    rm(tmpDir, { recursive: true, force: true }),
    rm(protoFixtureDir, { recursive: true, force: true }),
  ]);
});

// ─── nib_brand_build ─────────────────────────────────────────────────────────

describe("nib_brand_build — tool invocation", () => {
  let buildDir: string;
  let configPath: string;

  beforeAll(async () => {
    buildDir = join(tmpDir, "brand-build");
    const tokensDir = join(buildDir, "tokens");
    const outputDir = join(buildDir, "build");
    await writeTokenFixtures(tokensDir);
    configPath = join(buildDir, "brand.config.json");
    await writeBrandConfig(configPath, tokensDir, outputDir);
  });

  it("completes without error for a valid config", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_build",
      arguments: { config: configPath },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.text).toContain("completed");
  });

  it("writes CSS file with -- prefixed variables", async () => {
    const cssPath = join(tmpDir, "brand-build", "build", "variables.css");
    const css = await readFile(cssPath, "utf-8");

    expect(css).toContain(":root {");
    expect(css).toContain("--color-white: #ffffff");
    expect(css).toContain("--color-brand-600: #2563eb");
    expect(css).toContain("--color-background-primary: var(--color-white)");
    expect(css).toContain("--color-text-primary: var(--color-black)");
  });

  it("writes Tailwind preset with CSS var references", async () => {
    const presetPath = join(tmpDir, "brand-build", "build", "preset.js");
    const preset = await readFile(presetPath, "utf-8");

    expect(preset).toContain("export default");
    expect(preset).toContain("var(--color-brand-600)");
    // Preset must not contain raw DTCG references
    expect(preset).not.toMatch(/\{color\.\w/);
  });

  it("returns isError for a missing config file", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_build",
      arguments: { config: "/tmp/nonexistent-nib-config-99999.json" },
    });

    expect(result.isError).toBe(true);
  });
});

// ─── nib_brand_audit ─────────────────────────────────────────────────────────

describe("nib_brand_audit — tool invocation", () => {
  let passingConfigPath: string;
  let failingConfigPath: string;

  beforeAll(async () => {
    const auditDir = join(tmpDir, "brand-audit");

    // High contrast: black text on white background → 21:1 ratio, passes AA
    const passingTokensDir = join(auditDir, "passing", "tokens");
    const passingColorDir = join(passingTokensDir, "color");
    await mkdir(passingColorDir, { recursive: true });
    await writeFile(
      join(passingColorDir, "primitives.tokens.json"),
      JSON.stringify({
        color: {
          $type: "color",
          white: { $value: "#ffffff" },
          black: { $value: "#000000" },
        },
      }, null, 2),
    );
    await writeFile(
      join(passingColorDir, "semantic-light.tokens.json"),
      JSON.stringify({
        color: {
          $type: "color",
          background: { primary: { $value: "{color.white}" } },
          text: { primary: { $value: "{color.black}" } },
        },
      }, null, 2),
    );
    passingConfigPath = join(auditDir, "passing", "brand.config.json");
    await writeBrandConfig(passingConfigPath, passingTokensDir, join(auditDir, "passing", "build"));

    // Low contrast: near-identical light grays → < 2:1 ratio, fails AA
    const failingTokensDir = join(auditDir, "failing", "tokens");
    const failingColorDir = join(failingTokensDir, "color");
    await mkdir(failingColorDir, { recursive: true });
    await writeFile(
      join(failingColorDir, "primitives.tokens.json"),
      JSON.stringify({
        color: {
          $type: "color",
          gray200: { $value: "#e5e7eb" },
          gray300: { $value: "#d1d5db" },
        },
      }, null, 2),
    );
    await writeFile(
      join(failingColorDir, "semantic-light.tokens.json"),
      JSON.stringify({
        color: {
          $type: "color",
          background: { primary: { $value: "{color.gray200}" } },
          text: { primary: { $value: "{color.gray300}" } },
        },
      }, null, 2),
    );
    failingConfigPath = join(auditDir, "failing", "brand.config.json");
    await writeBrandConfig(failingConfigPath, failingTokensDir, join(auditDir, "failing", "build"));
  });

  it("reports 0 failures for high-contrast (21:1) token pairs", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_audit",
      arguments: { config: passingConfigPath },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const report = JSON.parse(content[0]!.text);
    expect(report.failed).toBe(0);
    expect(report.passed).toBeGreaterThan(0);
    expect(typeof report.totalPairs).toBe("number");
    expect(Array.isArray(report.results)).toBe(true);
  });

  it("reports failures for low-contrast near-identical gray pairs", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_audit",
      arguments: { config: failingConfigPath },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const report = JSON.parse(content[0]!.text);
    expect(report.failed).toBeGreaterThan(0);
    // Verify the failing result has the expected shape
    const failedResult = report.results.find((r: { passAA: boolean }) => !r.passAA);
    expect(failedResult).toBeDefined();
    expect(typeof failedResult.ratio).toBe("number");
  });

  it("returns isError when config file does not exist", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_audit",
      arguments: { config: "/tmp/nonexistent-nib-audit-99999.json" },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.text).toContain("Audit failed");
  });
});

// ─── nib_brand_validate ───────────────────────────────────────────────────────

describe("nib_brand_validate — tool invocation", () => {
  let validTokensDir: string;
  let invalidTokensDir: string;

  beforeAll(async () => {
    const validateDir = join(tmpDir, "brand-validate");

    // Valid: all required categories present, every token has $type and $value
    validTokensDir = join(validateDir, "valid");
    await writeTokenFixtures(validTokensDir);

    // Invalid: token group without $type on the group node → V-01 (missing $type)
    // All other required categories are present to isolate the V-01 failure
    invalidTokensDir = join(validateDir, "invalid");
    await mkdir(join(invalidTokensDir, "color"), { recursive: true });
    await writeFile(
      join(invalidTokensDir, "color", "primitives.tokens.json"),
      JSON.stringify({
        color: {
          // No $type on group or token — triggers V-01
          white: { $value: "#ffffff" },
        },
      }, null, 2),
    );
    await writeFile(join(invalidTokensDir, "typography.tokens.json"), JSON.stringify(TYPOGRAPHY_TOKENS, null, 2));
    await writeFile(join(invalidTokensDir, "spacing.tokens.json"), JSON.stringify(SPACING_TOKENS, null, 2));
    await writeFile(join(invalidTokensDir, "border-radius.tokens.json"), JSON.stringify(RADIUS_TOKENS, null, 2));
    await writeFile(join(invalidTokensDir, "elevation.tokens.json"), JSON.stringify(ELEVATION_TOKENS, null, 2));
  });

  it("returns valid: true for well-formed token files", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_validate",
      arguments: { tokensDir: validTokensDir },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const validation = JSON.parse(content[0]!.text);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it("returns valid: false and V-01 errors when $type is missing", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_validate",
      arguments: { tokensDir: invalidTokensDir },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const validation = JSON.parse(content[0]!.text);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
    // At least one V-01 error must be present (missing $type on the token)
    const checks = validation.errors.map((e: { check: string }) => e.check) as string[];
    expect(checks.some((c) => c === "V-01")).toBe(true);
  });

  it("returns isError when tokensDir does not exist", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_validate",
      arguments: { tokensDir: "/tmp/nonexistent-nib-validate-99999" },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.text).toContain("Validation failed");
  });
});

// ─── nib_build_prototype ─────────────────────────────────────────────────────

describe("nib_build_prototype — tool invocation", () => {
  let docPath: string;

  beforeAll(async () => {
    // Fixture must live inside process.cwd() — validateProjectPath enforces this
    const doc = {
      version: "1",
      source: "test.pen",
      capturedAt: new Date().toISOString(),
      canvases: [
        {
          id: "canvas-1",
          name: "Home",
          width: 390,
          height: 844,
          children: [
            {
              id: "heading-1",
              type: "text",
              text: "Welcome to nib",
              textStyle: { fontSize: 32, fontWeight: 700, color: "#111827" },
              x: 20,
              y: 40,
              width: 350,
              height: 48,
            },
          ],
        },
      ],
      components: {},
      variables: { light: {}, dark: {} },
      themes: { axes: {} },
      assets: [],
    };

    docPath = join(protoFixtureDir, "design.json");
    await writeFile(docPath, JSON.stringify(doc, null, 2));
  });

  it("builds an HTML prototype and returns outputDir + files list", async () => {
    const { client } = await createTestPair();
    const outputDir = join(tmpDir, "proto-output-1");
    const result = await client.callTool({
      name: "nib_build_prototype",
      arguments: { input: docPath, output: outputDir },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0]!.text);
    expect(typeof parsed.outputDir).toBe("string");
    expect(Array.isArray(parsed.files)).toBe(true);
    expect(parsed.files.length).toBeGreaterThan(0);
  });

  it("produces HTML that contains the canvas text content", async () => {
    const { client } = await createTestPair();
    const outputDir = join(tmpDir, "proto-output-2");
    await client.callTool({
      name: "nib_build_prototype",
      arguments: { input: docPath, output: outputDir },
    });

    const { readdir } = await import("node:fs/promises");
    const files = await readdir(outputDir);
    const htmlFile = files.find((f) => f.endsWith(".html"));
    expect(htmlFile).toBeDefined();

    const html = await readFile(join(outputDir, htmlFile!), "utf-8");
    expect(html).toContain("Welcome to nib");
    expect(html).toContain("nib-canvas");
  });

  it("writes nib.config.json to output dir when links are provided", async () => {
    const { client } = await createTestPair();
    const outputDir = join(tmpDir, "proto-output-links");
    const result = await client.callTool({
      name: "nib_build_prototype",
      arguments: {
        input: docPath,
        output: outputDir,
        links: [{ from: "Home", nodeId: "heading-1", to: "Home" }],
      },
    });

    expect(result.isError).toBeFalsy();
    expect(existsSync(join(outputDir, "nib.config.json"))).toBe(true);

    const configContent = JSON.parse(
      await readFile(join(outputDir, "nib.config.json"), "utf-8"),
    );
    expect(Array.isArray(configContent.links)).toBe(true);
    expect(configContent.links[0].from).toBe("Home");
  });

  it("returns isError with helpful message for a missing input file", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_build_prototype",
      arguments: { input: join(protoFixtureDir, "nonexistent.json") },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.text).toContain("Build failed");
  });
});

// ─── Integration-only tests (Pencil MCP required) ────────────────────────────

describe.skipIf(!isIntegration)("nib_capture — integration", () => {
  it("returns capture summary when Pencil MCP is available", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_capture",
      arguments: { file: "design-system.pen" },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.type).toBe("text");

    if (!result.isError) {
      const summary = JSON.parse(content[0]!.text);
      expect(typeof summary.canvasCount).toBe("number");
      expect(Array.isArray(summary.canvases)).toBe(true);
    }
  });
});
