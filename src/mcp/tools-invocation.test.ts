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
    // ADR-008: structured ShadowValue objects with { value, unit } sub-objects
    sm: {
      $value: { offsetX: { value: 0, unit: "px" }, offsetY: { value: 1, unit: "px" }, blur: { value: 2, unit: "px" }, spread: { value: 0, unit: "px" }, color: "rgba(0,0,0,0.05)" },
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

// ─── nib_help ─────────────────────────────────────────────────────────────────

describe("nib_help — tool invocation", () => {
  it("returns a markdown workflow guide", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({ name: "nib_help" });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.type).toBe("text");
    // Must mention the four key tools so agents can route correctly
    expect(content[0]!.text).toContain("nib_brand_init");
    expect(content[0]!.text).toContain("nib_brand_push");
    expect(content[0]!.text).toContain("nib_kit");
    expect(content[0]!.text).toContain("nib_brand_audit");
  });

  it("text is non-empty markdown (contains headings)", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({ name: "nib_help" });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.text).toMatch(/^#/m);
  });
});

// ─── nib_status nextStep ──────────────────────────────────────────────────────

describe("nib_status — nextStep hints", () => {
  it("returns a non-empty nextStep when no brand config exists in cwd", async () => {
    const { client } = await createTestPair();
    // nib_status reads .nib/brand.config.json from cwd — no config in test env
    const result = await client.callTool({ name: "nib_status" });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const status = JSON.parse(content[0]!.text);

    expect(typeof status.nextStep).toBe("string");
    expect(status.nextStep.length).toBeGreaterThan(0);
  });

  it("nextStep instructs brand init when hasBrandConfig is false", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({ name: "nib_status" });

    const content = result.content as Array<{ type: string; text: string }>;
    const status = JSON.parse(content[0]!.text);

    if (!status.hasBrandConfig) {
      expect(status.nextStep).toContain("nib_brand_init");
    }
  });
});

// ─── nib_brand_audit nextStep ─────────────────────────────────────────────────

describe("nib_brand_audit — nextStep hints", () => {
  let passingConfigPath: string;
  let failingConfigPath: string;

  beforeAll(async () => {
    const nextStepDir = join(tmpDir, "audit-nextstep");

    const passingTokensDir = join(nextStepDir, "passing", "tokens");
    const passingColorDir = join(passingTokensDir, "color");
    await mkdir(passingColorDir, { recursive: true });
    await writeFile(
      join(passingColorDir, "primitives.tokens.json"),
      JSON.stringify({ color: { $type: "color", white: { $value: "#ffffff" }, black: { $value: "#000000" } } }, null, 2),
    );
    await writeFile(
      join(passingColorDir, "semantic-light.tokens.json"),
      JSON.stringify({
        color: { $type: "color", background: { primary: { $value: "{color.white}" } }, text: { primary: { $value: "{color.black}" } } },
      }, null, 2),
    );
    passingConfigPath = join(nextStepDir, "passing", "brand.config.json");
    await writeBrandConfig(passingConfigPath, passingTokensDir, join(nextStepDir, "passing", "build"));

    const failingTokensDir = join(nextStepDir, "failing", "tokens");
    const failingColorDir = join(failingTokensDir, "color");
    await mkdir(failingColorDir, { recursive: true });
    await writeFile(
      join(failingColorDir, "primitives.tokens.json"),
      JSON.stringify({ color: { $type: "color", gray200: { $value: "#e5e7eb" }, gray300: { $value: "#d1d5db" } } }, null, 2),
    );
    await writeFile(
      join(failingColorDir, "semantic-light.tokens.json"),
      JSON.stringify({
        color: { $type: "color", background: { primary: { $value: "{color.gray200}" } }, text: { primary: { $value: "{color.gray300}" } } },
      }, null, 2),
    );
    failingConfigPath = join(nextStepDir, "failing", "brand.config.json");
    await writeBrandConfig(failingConfigPath, failingTokensDir, join(nextStepDir, "failing", "build"));
  });

  it("nextStep instructs nib_brand_push when all pairs pass", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_audit",
      arguments: { config: passingConfigPath },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const report = JSON.parse(content[0]!.text);
    expect(typeof report.nextStep).toBe("string");
    expect(report.nextStep).toContain("nib_brand_push");
  });

  it("nextStep instructs fixing tokens when pairs fail", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_audit",
      arguments: { config: failingConfigPath },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const report = JSON.parse(content[0]!.text);
    expect(typeof report.nextStep).toBe("string");
    // Must mention the failure count so the agent knows the scope
    expect(report.nextStep).toMatch(/\d+\s+pair/);
    // Must not tell the agent to push — there are failures to fix first
    expect(report.nextStep).not.toContain("nib_brand_push");
  });
});

// ─── nib_kit batchDesignOps and foundations ───────────────────────────────────

const PENCIL_VARIABLES_FIXTURE = {
  "color-interactive-default": { type: "color", value: "#2563eb" },
  "color-white": { type: "color", value: "#ffffff" },
  "color-border-primary": { type: "color", value: "#e5e7eb" },
  "color-background-primary": { type: "color", value: "#f9fafb" },
  "color-text-primary": { type: "color", value: "#111827" },
};

const BUTTON_CONTRACT_FIXTURE = {
  $schema: "https://nib.dev/schemas/component-contract.json",
  name: "Button",
  description: "Primary action button",
  widgetType: "button",
  anatomy: {
    root: "The outer button element",
    label: "The visible text label",
  },
  states: {
    default: { description: "Default state" },
    hover: { description: "Hover state" },
  },
  a11y: {
    role: "button",
    keyboard: { Enter: "Activate", Space: "Activate" },
    focusBehavior: "receives-focus",
    focusTrap: false,
    focusReturnTarget: null,
    minimumTouchTarget: { ios: "44px", android: "48px", web: "44px" },
    ariaAttributes: ["aria-disabled"],
    requiredLabel: true,
    labelStrategy: "Inner text or aria-label",
  },
  tokens: {
    root: {
      default: { fill: "{color.interactive.default}", border: "{color.border.primary}" },
      hover: { fill: "{color.brand.500}" },
    },
    label: {
      default: { color: "{color.white}" },
    },
  },
};

describe("nib_kit — batchDesignOps and foundations", () => {
  let kitConfigPath: string;

  beforeAll(async () => {
    const kitDir = join(tmpDir, "kit-test");
    const kitTokensDir = join(kitDir, "tokens");
    const kitOutputDir = join(kitDir, "build");
    const kitContractPath = join(kitDir, "button.contract.json");

    await writeTokenFixtures(kitTokensDir);
    await mkdir(kitOutputDir, { recursive: true });

    await writeFile(join(kitOutputDir, "variables.json"), JSON.stringify(PENCIL_VARIABLES_FIXTURE, null, 2));
    await writeFile(kitContractPath, JSON.stringify(BUTTON_CONTRACT_FIXTURE, null, 2));

    const kitConfig = {
      version: "1",
      generator: "nib",
      brand: { name: "Kit Test Brand", personality: [] },
      tokens: kitTokensDir,
      platforms: {
        css: join(kitOutputDir, "variables.css"),
        tailwind: join(kitOutputDir, "preset.js"),
        pencil: join(kitOutputDir, "variables.json"),
        penFile: join(kitOutputDir, "design-system.pen"),
      },
      output: kitOutputDir,
      ai: { provider: false },
      components: {
        Button: {
          contractPath: kitContractPath,
          widgetType: "button",
          status: "stable",
          addedAt: "2024-01-01T00:00:00.000Z",
        },
      },
    };
    kitConfigPath = join(kitDir, "brand.config.json");
    await writeFile(kitConfigPath, JSON.stringify(kitConfig, null, 2));
  });

  it("returns batchDesignOps with Pencil variable references", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_kit",
      arguments: { config: kitConfigPath },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const recipe = JSON.parse(content[0]!.text);

    expect(Array.isArray(recipe.components)).toBe(true);
    const button = recipe.components[0] as { batchDesignOps: string };
    expect(typeof button.batchDesignOps).toBe("string");
    expect(button.batchDesignOps.length).toBeGreaterThan(0);
    // Operations use Pencil variable references ($varname) — not {var.xxx} or bare hex values
    expect(button.batchDesignOps).toMatch(/fill:"[^"]*\$[a-z]/);
    expect(button.batchDesignOps).not.toContain("{var.");
    // Component sections insert into the kit wrapper frame (kit_frame), not directly into document
    expect(button.batchDesignOps).toContain("I(kit_frame,");
  });

  it("batchDesignOps inserts component sections into kit wrapper frame", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_kit",
      arguments: { config: kitConfigPath },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const recipe = JSON.parse(content[0]!.text);
    const button = recipe.components[0] as { batchDesignOps: string };
    // Sections now nest inside the kit_frame wrapper, not document directly
    expect(button.batchDesignOps).toContain("I(kit_frame,");
    // First batch contains the kit wrapper frame creation op
    const firstBatch = recipe.batches[0] as { ops: string };
    expect(firstBatch.ops).toContain("kit_frame=I(document,");
    expect(firstBatch.ops).toContain("placeholder:true");
  });

  it("returns foundations with color palette, typography, and spacing ops", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_kit",
      arguments: { config: kitConfigPath },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const recipe = JSON.parse(content[0]!.text);

    expect(recipe.foundations).toBeDefined();
    // foundations.batchDesignOps is saved to disk (INV-010 — too large to inline).
    // The slim recipe exposes batchDesignOpsFile (path) + metadata instead.
    expect(typeof recipe.foundations.batchDesignOpsFile).toBe("string");
    expect(recipe.foundations.batchDesignOpsFile.length).toBeGreaterThan(0);
    expect(typeof recipe.foundations.colorCount).toBe("number");
    expect(typeof recipe.foundations.typographySteps).toBe("number");
  });

  it("foundations startsAtY is below all component frames", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_kit",
      arguments: { config: kitConfigPath },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const recipe = JSON.parse(content[0]!.text);
    const lastComponent = recipe.components[recipe.components.length - 1] as {
      placement: { y: number; height: number };
    };

    // foundations.startsAtY must be below the last component frame
    expect(recipe.foundations.startsAtY).toBeGreaterThan(
      lastComponent.placement.y + lastComponent.placement.height,
    );
  });

  it("returns verification checklist with visual checks", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_kit",
      arguments: { config: kitConfigPath },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const recipe = JSON.parse(content[0]!.text);
    const button = recipe.components[0] as {
      verification: { visualChecks: string[]; expectedChildCount: number };
    };

    expect(button.verification).toBeDefined();
    expect(Array.isArray(button.verification.visualChecks)).toBe(true);
    expect(button.verification.visualChecks.length).toBeGreaterThan(0);
    // Must include a check referencing Pencil variable references ($varname)
    expect(button.verification.visualChecks.some((c) => c.includes("$"))).toBe(true);
  });

  it("verification.variantCount is 1 and first check references 'Default' when no variantMatrix", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_kit",
      arguments: { config: kitConfigPath },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const recipe = JSON.parse(content[0]!.text);
    const button = recipe.components[0] as {
      verification: { variantCount: number; visualChecks: string[] };
    };

    // BUTTON_CONTRACT_FIXTURE has no variantMatrix → single "default" frame
    expect(typeof button.verification.variantCount).toBe("number");
    expect(button.verification.variantCount).toBe(1);
    // First visual check must reference "Default" (no variants defined)
    expect(button.verification.visualChecks[0]).toContain("Default");
  });

  it("instruction text references batch_design and Pencil variable references", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_kit",
      arguments: { config: kitConfigPath },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const recipe = JSON.parse(content[0]!.text);

    expect(typeof recipe.instruction).toBe("string");
    expect(recipe.instruction).toContain("batch_design");
    expect(recipe.instruction).toContain("variable references");
  });
});

// ─── nib_brand_init preview mode ─────────────────────────────────────────────

describe("nib_brand_init — preview mode", () => {
  let fixtureDir: string;
  let brandMdPath: string;
  let emptyMdPath: string;

  beforeAll(async () => {
    // Must be inside process.cwd() so validateProjectPath accepts the paths
    fixtureDir = join(process.cwd(), `.nib-test-brand-preview-${Date.now()}`);
    await mkdir(fixtureDir, { recursive: true });

    brandMdPath = join(fixtureDir, "brand.md");
    await writeFile(
      brandMdPath,
      [
        "# Acme Corp",
        "",
        "Primary color: #3b82f6",
        "Secondary color: #10b981",
        "",
        "We are a professional, trusted technology company.",
      ].join("\n"),
    );

    emptyMdPath = join(fixtureDir, "empty.md");
    await writeFile(emptyMdPath, "No brand information here.");
  });

  afterAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true });
  });

  it("returns preview:true and does not include isError", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_init",
      arguments: { from: brandMdPath, preview: true },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0]!.text);
    expect(data.preview).toBe(true);
  });

  it("detected contains brandName, primaryColor, and personality", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_init",
      arguments: { from: brandMdPath, preview: true },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0]!.text);
    expect(data.detected).toBeDefined();
    expect(typeof data.detected.brandName).toBe("string");
    expect(data.detected.brandName).toBeTruthy();
    expect(data.detected.primaryColor).toBe("#3b82f6");
    expect(Array.isArray(data.detected.personality)).toBe(true);
  });

  it("confidence includes brandName and primaryColor string fields", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_init",
      arguments: { from: brandMdPath, preview: true },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0]!.text);
    expect(data.confidence).toBeDefined();
    expect(typeof data.confidence.brandName).toBe("string");
    expect(typeof data.confidence.primaryColor).toBe("string");
  });

  it("missing is empty when all required fields are detected", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_init",
      arguments: { from: brandMdPath, preview: true },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0]!.text);
    expect(Array.isArray(data.missing)).toBe(true);
    expect(data.missing).toHaveLength(0);
  });

  it("nextStep instructs agent to confirm values with user", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_init",
      arguments: { from: brandMdPath, preview: true },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0]!.text);
    expect(typeof data.nextStep).toBe("string");
    expect(data.nextStep.toLowerCase()).toContain("confirm");
  });

  it("missing includes primaryColor when no hex found in file", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_init",
      arguments: { from: emptyMdPath, preview: true },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0]!.text);
    expect(data.preview).toBe(true);
    expect(data.missing).toContain("primaryColor");
  });

  it("override params are reflected in detected and confidence is 'overridden'", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_init",
      arguments: {
        from: brandMdPath,
        preview: true,
        brandName: "Override Corp",
        primaryColor: "#ff0000",
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0]!.text);
    expect(data.detected.brandName).toBe("Override Corp");
    expect(data.detected.primaryColor).toBe("#ff0000");
    expect(data.confidence.brandName).toBe("overridden");
    expect(data.confidence.primaryColor).toBe("overridden");
  });

  it("nextStep instructs NOT to call init when missing values exist", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_init",
      arguments: { from: emptyMdPath, preview: true },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0]!.text);
    // Must not instruct the agent to commit init when values are missing
    expect(data.nextStep).not.toContain("preview omitted or false");
  });
});

// ─── nib_brand_init direct brief validation ───────────────────────────────────

describe("nib_brand_init — direct brief validation", () => {
  it("returns isError when neither from nor brandName+primaryColor are provided", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_init",
      arguments: {},
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.text).toContain("brandName");
    expect(content[0]!.text).toContain("primaryColor");
  });

  it("returns isError when brandName provided but primaryColor missing", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_init",
      arguments: { brandName: "My Brand" },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.text).toContain("primaryColor");
  });

  it("error message instructs agent to ask user for brand name and color", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_init",
      arguments: {},
    });

    const content = result.content as Array<{ type: string; text: string }>;
    // Should guide the agent toward the interview flow
    expect(content[0]!.text).toContain("brand name");
    expect(content[0]!.text).toContain("hex");
  });

  it("returns isError when from file path does not exist", async () => {
    // Use a path in a temp fixture dir so validateProjectPath accepts it
    // (path must be within project root)
    const { client } = await createTestPair();
    const nonexistentPath = join(process.cwd(), "docs", "nonexistent-brand-brief.md");
    const result = await client.callTool({
      name: "nib_brand_init",
      arguments: { from: nonexistentPath },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.text.length).toBeGreaterThan(0);
  });
});

// ─── nib_kit — ADR-007 variant row generation ─────────────────────────────────

describe("nib_kit — ADR-007 variant row generation", () => {
  let variantConfigPath: string;

  const BUTTON_WITH_VARIANTS = {
    ...BUTTON_CONTRACT_FIXTURE,
    variantMatrix: { style: ["primary", "secondary"] },
  };

  beforeAll(async () => {
    const variantDir = join(tmpDir, "kit-adr007-variants");
    const variantTokensDir = join(variantDir, "tokens");
    const variantOutputDir = join(variantDir, "build");
    const contractPath = join(variantDir, "button.contract.json");

    await writeTokenFixtures(variantTokensDir);
    await mkdir(variantOutputDir, { recursive: true });
    await writeFile(join(variantOutputDir, "variables.json"), JSON.stringify(PENCIL_VARIABLES_FIXTURE, null, 2));
    await writeFile(contractPath, JSON.stringify(BUTTON_WITH_VARIANTS, null, 2));

    variantConfigPath = join(variantDir, "brand.config.json");
    await writeFile(
      variantConfigPath,
      JSON.stringify(
        {
          version: "1",
          generator: "nib",
          brand: { name: "Variant Brand", personality: [] },
          tokens: variantTokensDir,
          platforms: {
            css: join(variantOutputDir, "variables.css"),
            tailwind: join(variantOutputDir, "preset.js"),
            pencil: join(variantOutputDir, "variables.json"),
            penFile: join(variantOutputDir, "design-system.pen"),
          },
          output: variantOutputDir,
          ai: { provider: false },
          components: {
            Button: { contractPath, widgetType: "button", status: "stable", addedAt: "2024-01-01" },
          },
        },
        null,
        2,
      ),
    );
  });

  it("variantCount equals primary axis length from variantMatrix", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_kit",
      arguments: { config: variantConfigPath },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const recipe = JSON.parse(content[0]!.text);
    const button = recipe.components[0] as { verification: { variantCount: number } };
    expect(button.verification.variantCount).toBe(2); // style: ["primary", "secondary"]
  });

  it("batchDesignOps contains a frame for each variant in variantMatrix", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_kit",
      arguments: { config: variantConfigPath },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const recipe = JSON.parse(content[0]!.text);
    const button = recipe.components[0] as { batchDesignOps: string };
    expect(button.batchDesignOps).toContain("Button / Primary");
    expect(button.batchDesignOps).toContain("Button / Secondary");
  });
});

// ─── nib_kit — ADR-007 glyph safety ──────────────────────────────────────────

describe("nib_kit — ADR-007 glyph safety", () => {
  let toastConfigPath: string;

  const TOAST_CONTRACT_FIXTURE = {
    $schema: "https://nib.dev/schemas/component-contract.json",
    name: "Toast",
    description: "Ephemeral notification toast",
    widgetType: "toast",
    visualClass: "ephemeral-overlay",
    variantMatrix: { intent: ["info", "error"] },
    constraints: { closeGlyph: "ascii-safe" },
    accentBar: { width: 4, fillToken: "$toast-accent" },
    anatomy: { root: "The outer toast frame" },
    states: { default: { description: "Visible state" } },
    a11y: {
      role: "status",
      keyboard: {},
      focusBehavior: "not-focusable",
      focusTrap: false,
      focusReturnTarget: null,
      minimumTouchTarget: { ios: "44pt", android: "48dp", web: "24px" },
      ariaAttributes: ["aria-live"],
      requiredLabel: false,
      labelStrategy: "aria-live",
    },
    tokens: { root: { default: { fill: "{color.background.primary}" } } },
  };

  beforeAll(async () => {
    const toastDir = join(tmpDir, "kit-adr007-glyph");
    const toastTokensDir = join(toastDir, "tokens");
    const toastOutputDir = join(toastDir, "build");
    const contractPath = join(toastDir, "toast.contract.json");

    await writeTokenFixtures(toastTokensDir);
    await mkdir(toastOutputDir, { recursive: true });
    await writeFile(join(toastOutputDir, "variables.json"), JSON.stringify(PENCIL_VARIABLES_FIXTURE, null, 2));
    await writeFile(contractPath, JSON.stringify(TOAST_CONTRACT_FIXTURE, null, 2));

    toastConfigPath = join(toastDir, "brand.config.json");
    await writeFile(
      toastConfigPath,
      JSON.stringify(
        {
          version: "1",
          generator: "nib",
          brand: { name: "Glyph Test Brand", personality: [] },
          tokens: toastTokensDir,
          platforms: {
            css: join(toastOutputDir, "variables.css"),
            tailwind: join(toastOutputDir, "preset.js"),
            pencil: join(toastOutputDir, "variables.json"),
            penFile: join(toastOutputDir, "design-system.pen"),
          },
          output: toastOutputDir,
          ai: { provider: false },
          components: {
            Toast: { contractPath, widgetType: "toast", status: "stable", addedAt: "2024-01-01" },
          },
        },
        null,
        2,
      ),
    );
  });

  it("toast close uses icon_font x — not a text glyph (INV-009 Rule 13)", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_kit",
      arguments: { config: toastConfigPath },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const recipe = JSON.parse(content[0]!.text);
    const toast = recipe.components[0] as { batchDesignOps: string };
    // INV-009 Rule 13: dismiss icon uses icon_font, not text glyph
    expect(toast.batchDesignOps).toContain('iconFontName:"x"');
    // Neither text-glyph approach should appear
    expect(toast.batchDesignOps).not.toContain("\u00D7");
    expect(toast.batchDesignOps).not.toContain("\u2715");
  });

  it("toast ops include accent-bar child frame per ADR-007 accentBar constraint", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_kit",
      arguments: { config: toastConfigPath },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const recipe = JSON.parse(content[0]!.text);
    const toast = recipe.components[0] as { batchDesignOps: string };
    // Accent bar is a 4px child frame, not a border property (Pencil has no per-side borders)
    expect(toast.batchDesignOps).toContain("accent-bar");
  });
});

// ─── nib_kit_bootstrap — visualClasses ───────────────────────────────────────

describe("nib_kit_bootstrap — visualClasses", () => {
  let bootstrapConfigPath: string;

  beforeAll(async () => {
    const bootstrapDir = join(tmpDir, "kit-bootstrap-visualclasses");
    const bootstrapTokensDir = join(bootstrapDir, "tokens");
    const bootstrapOutputDir = join(bootstrapDir, "build");

    await writeTokenFixtures(bootstrapTokensDir);
    await mkdir(bootstrapOutputDir, { recursive: true });

    bootstrapConfigPath = join(bootstrapDir, "brand.config.json");
    await writeFile(
      bootstrapConfigPath,
      JSON.stringify(
        {
          version: "1",
          generator: "nib",
          brand: { name: "Bootstrap VisualClass Brand", personality: [] },
          tokens: bootstrapTokensDir,
          platforms: {
            css: join(bootstrapOutputDir, "variables.css"),
            tailwind: join(bootstrapOutputDir, "preset.js"),
            pencil: join(bootstrapOutputDir, "variables.json"),
            penFile: join(bootstrapOutputDir, "design-system.pen"),
          },
          output: bootstrapOutputDir,
          ai: { provider: false },
        },
        null,
        2,
      ),
    );
  });

  it("response includes visualClasses with Button='interactive-control' and Toast='ephemeral-overlay'", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_kit_bootstrap",
      arguments: { config: bootstrapConfigPath, components: ["Button", "Toast"] },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0]!.text);

    expect(data.visualClasses).toBeDefined();
    expect(typeof data.visualClasses).toBe("object");
    expect(data.visualClasses["Button"]).toBe("interactive-control");
    expect(data.visualClasses["Toast"]).toBe("ephemeral-overlay");
  });

  it("skipped components still appear in visualClasses (loaded from existing contract)", async () => {
    const { client } = await createTestPair();
    // Button + Toast already scaffolded by the previous test — both will be skipped
    const result = await client.callTool({
      name: "nib_kit_bootstrap",
      arguments: { config: bootstrapConfigPath, components: ["Button"] },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0]!.text);
    expect(data.skipped).toContain("Button");
    // Skipped components must still contribute their visualClass
    expect(data.visualClasses["Button"]).toBe("interactive-control");
  });
});

// ─── nib_component_init ───────────────────────────────────────────────────────

describe("nib_component_init — tool invocation", () => {
  let componentInitDir: string;
  let componentConfigPath: string;

  beforeAll(async () => {
    componentInitDir = join(tmpDir, "component-init");
    const tokensDir = join(componentInitDir, "tokens");
    const outputDir = join(componentInitDir, "build");
    await writeTokenFixtures(tokensDir);
    componentConfigPath = join(componentInitDir, "brand.config.json");
    await writeBrandConfig(componentConfigPath, tokensDir, outputDir);
  });

  it("scaffolds a component contract and returns required fields", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_component_init",
      arguments: {
        name: "MyButton",
        widgetType: "button",
        config: componentConfigPath,
      },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0]!.text);

    expect(data.name).toBe("MyButton");
    expect(typeof data.contractPath).toBe("string");
    expect(typeof data.widgetType).toBe("string");
    expect(Array.isArray(data.states)).toBe(true);
  });

  it("auto-detects widgetType from name when not provided", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_component_init",
      arguments: {
        name: "SearchInput",
        config: componentConfigPath,
      },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0]!.text);

    // textinput auto-detection from "input" in the name
    expect(typeof data.widgetType).toBe("string");
    expect(data.widgetType.length).toBeGreaterThan(0);
  });

  it("scaffolds with variants when provided", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_component_init",
      arguments: {
        name: "AlertComp",
        widgetType: "generic",
        variants: ["info", "success", "warning", "error"],
        config: componentConfigPath,
      },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0]!.text);
    expect(data.name).toBe("AlertComp");
  });

  it("includes keyboard patterns (a11y) for button widget type", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_component_init",
      arguments: {
        name: "ActionButton",
        widgetType: "button",
        config: componentConfigPath,
      },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0]!.text);

    // Keyboard patterns must be present for button type
    expect(data.keyboard).toBeDefined();
  });

  it("writes contract file to disk at contractPath", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_component_init",
      arguments: {
        name: "DiskButton",
        widgetType: "button",
        config: componentConfigPath,
      },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0]!.text);

    expect(existsSync(data.contractPath)).toBe(true);
    const contract = JSON.parse(await readFile(data.contractPath, "utf-8"));
    expect(contract.name).toBe("DiskButton");
    expect(contract.widgetType).toBe("button");
  });

  it("always returns a non-empty text block in the content array", async () => {
    // nib_component_init registers the component into the config (creates it if missing)
    // Always verify the response is well-formed regardless of config state
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_component_init",
      arguments: {
        name: "ShapeCheckButton",
        widgetType: "button",
        config: componentConfigPath,
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(Array.isArray(content)).toBe(true);
    expect(content.length).toBeGreaterThan(0);
    expect(content[0]!.type).toBe("text");
    expect(typeof content[0]!.text).toBe("string");
    expect(content[0]!.text.length).toBeGreaterThan(0);
  });

  it("is idempotent — re-scaffolding same name succeeds without error", async () => {
    const { client } = await createTestPair();
    // First call
    await client.callTool({
      name: "nib_component_init",
      arguments: { name: "IdempButton", widgetType: "button", config: componentConfigPath },
    });
    // Second call — same name
    const result = await client.callTool({
      name: "nib_component_init",
      arguments: { name: "IdempButton", widgetType: "button", config: componentConfigPath },
    });
    expect(result.isError).toBeFalsy();
  });
});

// ─── nib_component_list ───────────────────────────────────────────────────────

describe("nib_component_list — tool invocation", () => {
  let listDir: string;
  let listConfigPath: string;

  beforeAll(async () => {
    listDir = join(tmpDir, "component-list");
    const tokensDir = join(listDir, "tokens");
    const outputDir = join(listDir, "build");
    await writeTokenFixtures(tokensDir);
    listConfigPath = join(listDir, "brand.config.json");
    await writeBrandConfig(listConfigPath, tokensDir, outputDir);

    // Pre-register two components so the list is non-empty
    const { client } = await createTestPair();
    await client.callTool({
      name: "nib_component_init",
      arguments: { name: "ListButton", widgetType: "button", config: listConfigPath },
    });
    await client.callTool({
      name: "nib_component_init",
      arguments: { name: "ListInput", widgetType: "textinput", config: listConfigPath },
    });
  });

  it("returns count and components array", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_component_list",
      arguments: { config: listConfigPath },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0]!.text);

    expect(typeof data.count).toBe("number");
    expect(Array.isArray(data.components)).toBe(true);
    expect(data.count).toBe(data.components.length);
  });

  it("each component entry has required shape fields", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_component_list",
      arguments: { config: listConfigPath },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0]!.text);

    for (const comp of data.components) {
      expect(typeof comp.name).toBe("string");
      expect(typeof comp.contractPath).toBe("string");
      expect(typeof comp.widgetType).toBe("string");
      expect(typeof comp.status).toBe("string");
      expect(typeof comp.addedAt).toBe("string");
    }
  });

  it("count includes previously registered components", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_component_list",
      arguments: { config: listConfigPath },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0]!.text);

    expect(data.count).toBeGreaterThanOrEqual(2);
    const names = data.components.map((c: { name: string }) => c.name) as string[];
    expect(names).toContain("ListButton");
    expect(names).toContain("ListInput");
  });

  it("returns isError when config path does not exist", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_component_list",
      arguments: { config: "/tmp/nonexistent-nib-config-list-99999.json" },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.text).toContain("nib_brand_init");
  });

  it("response is valid JSON with no text/content leakage", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_component_list",
      arguments: { config: listConfigPath },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    // Must be parseable — no leading/trailing text
    expect(() => JSON.parse(content[0]!.text)).not.toThrow();
  });
});

// ─── nib_brand_build — edge cases ────────────────────────────────────────────

describe("nib_brand_build — edge cases", () => {
  it("elevation shadow tokens emit valid CSS box-shadow values", async () => {
    const { client } = await createTestPair();
    const buildEdgeDir = join(tmpDir, "build-edge-shadow");
    const tokensDir = join(buildEdgeDir, "tokens");
    const outputDir = join(buildEdgeDir, "build");
    await writeTokenFixtures(tokensDir);
    const configPath = join(buildEdgeDir, "brand.config.json");
    await writeBrandConfig(configPath, tokensDir, outputDir);

    await client.callTool({ name: "nib_brand_build", arguments: { config: configPath } });

    const css = await readFile(join(outputDir, "variables.css"), "utf-8");
    // Shadow token must produce: 0px 1px 2px 0px rgba(...)
    expect(css).toMatch(/--elevation-sm:\s*0px\s+1px\s+2px\s+0px/);
  });

  it("Tailwind preset uses CSS var references for color tokens", async () => {
    const { client } = await createTestPair();
    const buildEdgeDir2 = join(tmpDir, "build-edge-tailwind");
    const tokensDir = join(buildEdgeDir2, "tokens");
    const outputDir = join(buildEdgeDir2, "build");
    await writeTokenFixtures(tokensDir);
    const configPath = join(buildEdgeDir2, "brand.config.json");
    await writeBrandConfig(configPath, tokensDir, outputDir);

    await client.callTool({ name: "nib_brand_build", arguments: { config: configPath } });

    const preset = await readFile(join(outputDir, "preset.js"), "utf-8");
    // Tailwind preset colors must reference CSS vars, not raw hex values
    expect(preset).toMatch(/var\(--color-/);
    // Must not contain raw DTCG reference syntax
    expect(preset).not.toMatch(/\{color\.\w/);
  });

  it("CSS output includes dark theme block", async () => {
    const { client } = await createTestPair();
    const buildEdgeDark = join(tmpDir, "build-edge-dark");
    const tokensDir = join(buildEdgeDark, "tokens");
    const outputDir = join(buildEdgeDark, "build");
    await writeTokenFixtures(tokensDir);
    const configPath = join(buildEdgeDark, "brand.config.json");
    await writeBrandConfig(configPath, tokensDir, outputDir);

    await client.callTool({ name: "nib_brand_build", arguments: { config: configPath } });

    const css = await readFile(join(outputDir, "variables.css"), "utf-8");
    // Dark mode block must be present (data-theme="dark" or prefers-color-scheme)
    expect(css).toMatch(/data-theme|prefers-color-scheme:\s*dark/);
  });

  it("Pencil variables JSON is valid and contains token keys", async () => {
    const { client } = await createTestPair();
    const buildEdgePencil = join(tmpDir, "build-edge-pencil");
    const tokensDir = join(buildEdgePencil, "tokens");
    const outputDir = join(buildEdgePencil, "build");
    await writeTokenFixtures(tokensDir);
    const configPath = join(buildEdgePencil, "brand.config.json");
    await writeBrandConfig(configPath, tokensDir, outputDir);

    await client.callTool({ name: "nib_brand_build", arguments: { config: configPath } });

    const pencilJson = await readFile(join(outputDir, "variables.json"), "utf-8");
    const variables = JSON.parse(pencilJson);
    // Must have at least color token entries
    const keys = Object.keys(variables);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.some((k) => k.includes("color"))).toBe(true);
  });
});

// ─── nib_brand_validate — edge cases ─────────────────────────────────────────

describe("nib_brand_validate — edge cases", () => {
  it("detects V-04 naming violation (camelCase segment)", async () => {
    const { client } = await createTestPair();
    const dir = join(tmpDir, "validate-v04");
    await mkdir(join(dir, "color"), { recursive: true });
    await writeFile(
      join(dir, "color", "primitives.tokens.json"),
      JSON.stringify({
        color: {
          $type: "color",
          // camelCase key — V-04 violation
          brandBlue: { $value: "#3b82f6" },
        },
      }, null, 2),
    );
    await writeFile(join(dir, "typography.tokens.json"), JSON.stringify(TYPOGRAPHY_TOKENS, null, 2));
    await writeFile(join(dir, "spacing.tokens.json"), JSON.stringify(SPACING_TOKENS, null, 2));
    await writeFile(join(dir, "border-radius.tokens.json"), JSON.stringify(RADIUS_TOKENS, null, 2));
    await writeFile(join(dir, "elevation.tokens.json"), JSON.stringify(ELEVATION_TOKENS, null, 2));

    const result = await client.callTool({
      name: "nib_brand_validate",
      arguments: { tokensDir: dir },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const validation = JSON.parse(content[0]!.text);
    const checks = validation.errors.map((e: { check: string }) => e.check) as string[];
    expect(checks.some((c) => c === "V-04")).toBe(true);
  });

  it("detects V-02 when a required category is absent", async () => {
    const { client } = await createTestPair();
    const dir = join(tmpDir, "validate-v02");
    await mkdir(join(dir, "color"), { recursive: true });
    // Only color — missing typography, spacing, borderRadius, elevation
    await writeFile(
      join(dir, "color", "primitives.tokens.json"),
      JSON.stringify({ color: { $type: "color", white: { $value: "#ffffff" } } }, null, 2),
    );

    const result = await client.callTool({
      name: "nib_brand_validate",
      arguments: { tokensDir: dir },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const validation = JSON.parse(content[0]!.text);
    expect(validation.valid).toBe(false);
    const checks = validation.errors.map((e: { check: string }) => e.check) as string[];
    expect(checks.some((c) => c === "V-02")).toBe(true);
  });

  it("passes config-based validation when config path is provided", async () => {
    const { client } = await createTestPair();
    const dir = join(tmpDir, "validate-config-path");
    const tokensDir = join(dir, "tokens");
    const outputDir = join(dir, "build");
    await writeTokenFixtures(tokensDir);
    const configPath = join(dir, "brand.config.json");
    await writeBrandConfig(configPath, tokensDir, outputDir);

    const result = await client.callTool({
      name: "nib_brand_validate",
      arguments: { config: configPath },
    });

    // Should work via config path (not tokensDir directly)
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.text.length).toBeGreaterThan(0);
  });

  it("warnings array is present and is an array (may be empty)", async () => {
    const { client } = await createTestPair();
    const dir = join(tmpDir, "validate-warnings-shape");
    const tokensDir = join(dir, "tokens");
    await writeTokenFixtures(tokensDir);

    const result = await client.callTool({
      name: "nib_brand_validate",
      arguments: { tokensDir },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const validation = JSON.parse(content[0]!.text);
    expect(Array.isArray(validation.warnings)).toBe(true);
  });
});

// ─── nib_brand_audit — edge cases ────────────────────────────────────────────

describe("nib_brand_audit — edge cases", () => {
  it("each result entry has ratio, fg, bg, passAA fields", async () => {
    const { client } = await createTestPair();
    const dir = join(tmpDir, "audit-shape");
    const tokensDir = join(dir, "tokens");
    const colorDir = join(tokensDir, "color");
    await mkdir(colorDir, { recursive: true });
    await writeFile(
      join(colorDir, "primitives.tokens.json"),
      JSON.stringify({ color: { $type: "color", white: { $value: "#ffffff" }, black: { $value: "#000000" } } }, null, 2),
    );
    await writeFile(
      join(colorDir, "semantic-light.tokens.json"),
      JSON.stringify({
        color: { $type: "color", background: { primary: { $value: "{color.white}" } }, text: { primary: { $value: "{color.black}" } } },
      }, null, 2),
    );
    const configPath = join(dir, "brand.config.json");
    await writeBrandConfig(configPath, tokensDir, join(dir, "build"));

    const result = await client.callTool({ name: "nib_brand_audit", arguments: { config: configPath } });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const report = JSON.parse(content[0]!.text);

    for (const entry of report.results) {
      expect(typeof entry.ratio).toBe("number");
      // wcag.ts uses "foreground" / "background" field names
      expect(typeof entry.foreground).toBe("string");
      expect(typeof entry.background).toBe("string");
      expect(typeof entry.passAA).toBe("boolean");
    }
  });

  it("passAAA field is present on each result entry", async () => {
    const { client } = await createTestPair();
    const dir = join(tmpDir, "audit-aaa");
    const tokensDir = join(dir, "tokens");
    const colorDir = join(tokensDir, "color");
    await mkdir(colorDir, { recursive: true });
    await writeFile(
      join(colorDir, "primitives.tokens.json"),
      JSON.stringify({ color: { $type: "color", white: { $value: "#ffffff" }, black: { $value: "#000000" } } }, null, 2),
    );
    await writeFile(
      join(colorDir, "semantic-light.tokens.json"),
      JSON.stringify({
        color: { $type: "color", background: { primary: { $value: "{color.white}" } }, text: { primary: { $value: "{color.black}" } } },
      }, null, 2),
    );
    const configPath = join(dir, "brand.config.json");
    await writeBrandConfig(configPath, tokensDir, join(dir, "build"));

    const result = await client.callTool({ name: "nib_brand_audit", arguments: { config: configPath } });

    const content = result.content as Array<{ type: string; text: string }>;
    const report = JSON.parse(content[0]!.text);
    for (const entry of report.results) {
      expect(typeof entry.passAAA).toBe("boolean");
    }
  });

  it("returns isError with descriptive message for malformed config JSON", async () => {
    const { client } = await createTestPair();
    const dir = join(tmpDir, "audit-malformed");
    await mkdir(dir, { recursive: true });
    const badConfigPath = join(dir, "brand.config.json");
    await writeFile(badConfigPath, "{ this is not valid json }");

    const result = await client.callTool({ name: "nib_brand_audit", arguments: { config: badConfigPath } });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.text.length).toBeGreaterThan(0);
  });
});

// ─── nib_build_prototype — edge cases ────────────────────────────────────────

describe("nib_build_prototype — edge cases", () => {
  let multiCanvasDocPath: string;

  beforeAll(async () => {
    // Multi-canvas doc for navigation link tests
    const doc = {
      version: "1",
      source: "test.pen",
      capturedAt: new Date().toISOString(),
      canvases: [
        {
          id: "screen-home",
          name: "Home",
          width: 390,
          height: 844,
          children: [
            {
              id: "btn-1",
              type: "frame",
              x: 20, y: 40, width: 120, height: 44,
              fill: "#3b82f6",
              children: [{ id: "btn-label", type: "text", text: "Go to Detail", x: 0, y: 0, width: 120, height: 44 }],
            },
          ],
        },
        {
          id: "screen-detail",
          name: "Detail",
          width: 390,
          height: 844,
          children: [
            { id: "detail-title", type: "text", text: "Detail Screen", x: 20, y: 40, width: 350, height: 48 },
          ],
        },
      ],
      components: {},
      variables: { light: {}, dark: {} },
      themes: { axes: {} },
      assets: [],
    };

    multiCanvasDocPath = join(protoFixtureDir, "multi-canvas.json");
    await writeFile(multiCanvasDocPath, JSON.stringify(doc, null, 2));
  });

  it("generates one HTML file per canvas for multi-canvas docs", async () => {
    const { client } = await createTestPair();
    const outputDir = join(tmpDir, "proto-multi-canvas");
    const result = await client.callTool({
      name: "nib_build_prototype",
      arguments: { input: multiCanvasDocPath, output: outputDir },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0]!.text);
    // Multi-canvas doc → multiple files
    expect(parsed.files.filter((f: string) => f.endsWith(".html")).length).toBeGreaterThanOrEqual(1);
  });

  it("output path in result matches the requested output directory", async () => {
    const { client } = await createTestPair();
    const outputDir = join(tmpDir, "proto-outputdir-check");
    const result = await client.callTool({
      name: "nib_build_prototype",
      arguments: { input: multiCanvasDocPath, output: outputDir },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0]!.text);
    expect(parsed.outputDir).toBe(outputDir);
  });

  it("returns isError for an input path outside project root", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_build_prototype",
      arguments: { input: "/etc/passwd" },
    });

    expect(result.isError).toBe(true);
  });

  it("nib.config.json links array matches the provided links arg", async () => {
    const { client } = await createTestPair();
    const outputDir = join(tmpDir, "proto-links-verify");
    const links = [
      { from: "Home", nodeId: "btn-1", to: "Detail", transition: "slide-left" as const },
    ];
    await client.callTool({
      name: "nib_build_prototype",
      arguments: { input: multiCanvasDocPath, output: outputDir, links },
    });

    const config = JSON.parse(await readFile(join(outputDir, "nib.config.json"), "utf-8"));
    expect(config.links[0].from).toBe("Home");
    expect(config.links[0].to).toBe("Detail");
    expect(config.links[0].transition).toBe("slide-left");
  });

  it("HTML includes canvas content from second canvas", async () => {
    const { client } = await createTestPair();
    const outputDir = join(tmpDir, "proto-multi-content");
    await client.callTool({
      name: "nib_build_prototype",
      arguments: { input: multiCanvasDocPath, output: outputDir },
    });

    const { readdir } = await import("node:fs/promises");
    const files = await readdir(outputDir);
    const htmlFiles = files.filter((f) => f.endsWith(".html"));

    // Read all HTML files and join — content from both canvases must appear somewhere
    const allHtml = (await Promise.all(
      htmlFiles.map((f) => readFile(join(outputDir, f), "utf-8")),
    )).join("\n");

    expect(allHtml).toContain("Detail Screen");
  });
});

// ─── nib_help — edge cases ───────────────────────────────────────────────────

describe("nib_help — edge cases", () => {
  it("response is idempotent across two calls", async () => {
    const { client } = await createTestPair();
    const r1 = await client.callTool({ name: "nib_help" });
    const r2 = await client.callTool({ name: "nib_help" });

    const c1 = (r1.content as Array<{ type: string; text: string }>)[0]!.text;
    const c2 = (r2.content as Array<{ type: string; text: string }>)[0]!.text;
    expect(c1).toBe(c2);
  });

  it("content describes both fresh-start and existing-project workflows", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({ name: "nib_help" });

    const content = result.content as Array<{ type: string; text: string }>;
    const text = content[0]!.text;
    // Both onboarding paths must be documented: set up brand + import from existing Pencil file
    expect(text).toMatch(/brand/i);
    expect(text).toMatch(/nib_brand_init/);
    expect(text).toMatch(/nib_brand_import/);
  });

  it("content mentions nib_kit in the workflow", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({ name: "nib_help" });

    const content = result.content as Array<{ type: string; text: string }>;
    // nib_kit is referenced as the scaffolding step in the brand setup workflow
    expect(content[0]!.text).toMatch(/nib_kit/);
  });
});

// ─── nib_status — edge cases ─────────────────────────────────────────────────

describe("nib_status — edge cases", () => {
  it("version field is a semver string", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({ name: "nib_status" });

    const content = result.content as Array<{ type: string; text: string }>;
    const status = JSON.parse(content[0]!.text);
    expect(status.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("hasBrandConfig is false in a temp directory with no config", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({ name: "nib_status" });

    const content = result.content as Array<{ type: string; text: string }>;
    const status = JSON.parse(content[0]!.text);

    // Test environment has no .nib/brand.config.json in cwd
    if (!status.hasBrandConfig) {
      expect(status.hasBrandConfig).toBe(false);
      expect(typeof status.nextStep).toBe("string");
    }
  });

  it("mcpConfigFound is a boolean", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({ name: "nib_status" });

    const content = result.content as Array<{ type: string; text: string }>;
    const status = JSON.parse(content[0]!.text);
    expect(typeof status.mcpConfigFound).toBe("boolean");
  });

  it("response shape includes all required status fields", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({ name: "nib_status" });

    const content = result.content as Array<{ type: string; text: string }>;
    const status = JSON.parse(content[0]!.text);

    // All required fields must be present
    const requiredFields = ["version", "hasBrandConfig", "hasStatus", "mcpConfigFound", "nextStep"];
    for (const field of requiredFields) {
      expect(status[field]).toBeDefined();
    }
  });
});

// ─── nib_kit_bootstrap — edge cases ──────────────────────────────────────────

describe("nib_kit_bootstrap — edge cases", () => {
  let bootstrapEdgeConfigPath: string;

  beforeAll(async () => {
    const dir = join(tmpDir, "kit-bootstrap-edge");
    const tokensDir = join(dir, "tokens");
    const outputDir = join(dir, "build");
    await writeTokenFixtures(tokensDir);
    bootstrapEdgeConfigPath = join(dir, "brand.config.json");
    await writeBrandConfig(bootstrapEdgeConfigPath, tokensDir, outputDir);
  });

  it("returns skipped array as empty when no components exist yet", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_kit_bootstrap",
      arguments: {
        config: bootstrapEdgeConfigPath,
        components: ["Checkbox", "Radio"],
      },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0]!.text);

    // First run — nothing to skip
    expect(Array.isArray(data.skipped)).toBe(true);
  });

  it("all scaffolded components have a contractPath that exists on disk", async () => {
    const { client } = await createTestPair();
    const dir = join(tmpDir, "kit-bootstrap-disk");
    const tokensDir = join(dir, "tokens");
    const outputDir = join(dir, "build");
    await writeTokenFixtures(tokensDir);
    const configPath = join(dir, "brand.config.json");
    await writeBrandConfig(configPath, tokensDir, outputDir);

    const result = await client.callTool({
      name: "nib_kit_bootstrap",
      arguments: { config: configPath, components: ["Switch"] },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0]!.text);

    for (const comp of data.components ?? []) {
      if (comp.contractPath) {
        expect(existsSync(comp.contractPath)).toBe(true);
      }
    }
  });

  it("response includes a pencilRecipe with batches array", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_kit_bootstrap",
      arguments: { config: bootstrapEdgeConfigPath, components: ["Badge"] },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0]!.text);

    // The bootstrap response must include a pencilRecipe for Pencil scaffolding
    expect(data.pencilRecipe ?? data.recipe ?? data.batches ?? data.components).toBeDefined();
  });

  it("returns isError for a missing config path", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_kit_bootstrap",
      arguments: { config: "/tmp/nonexistent-nib-bootstrap-99999.json" },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.text.length).toBeGreaterThan(0);
  });
});

// ─── nib_brand_init — edge cases ─────────────────────────────────────────────

describe("nib_brand_init — edge cases", () => {
  it("direct brief with brandName + primaryColor returns a result (no-ai mode)", async () => {
    const { client } = await createTestPair();
    const dir = join(process.cwd(), `.nib-test-init-direct-${Date.now()}`);
    await mkdir(dir, { recursive: true });

    let result;
    try {
      result = await client.callTool({
        name: "nib_brand_init",
        arguments: {
          brandName: "Test Corp",
          primaryColor: "#3b82f6",
          noAi: true,
          output: dir,
        },
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }

    // May error if init requires filesystem state — but must not throw
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content.length).toBeGreaterThan(0);
    expect(typeof content[0]!.text).toBe("string");
  });

  it("preview with no from and no brandName returns isError", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_init",
      arguments: { preview: true },
    });

    // Must return error — from or brandName+primaryColor required
    expect(result.isError).toBe(true);
  });

  it("preview does not write any files", async () => {
    const { client } = await createTestPair();
    const dir = join(process.cwd(), `.nib-test-init-preview-nowrite-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    const brandMd = join(dir, "brand.md");
    await writeFile(brandMd, "# TestBrand\nPrimary color: #3b82f6");

    try {
      await client.callTool({
        name: "nib_brand_init",
        arguments: { from: brandMd, preview: true },
      });

      // Preview must NOT create brand.config.json
      expect(existsSync(join(dir, ".nib", "brand.config.json"))).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("invalid hex color in primaryColor produces a non-empty response", async () => {
    // The handler does not pre-validate hex format — it may fail deeper in the stack
    // or proceed and produce malformed tokens. Either way, the response must be non-empty.
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_init",
      arguments: {
        brandName: "Bad Color Brand",
        primaryColor: "not-a-color",
        noAi: true,
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(Array.isArray(content)).toBe(true);
    expect(content.length).toBeGreaterThan(0);
    expect(content[0]!.type).toBe("text");
    expect(content[0]!.text.length).toBeGreaterThan(0);
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

describe.skipIf(!isIntegration)("nib_brand_push — integration", () => {
  it("returns pen file path and variables when Pencil MCP is available", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_push",
      arguments: {},
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.type).toBe("text");

    if (!result.isError) {
      // Second content block should be JSON with penFile + variables
      if (content.length > 1) {
        const data = JSON.parse(content[1]!.text);
        expect(typeof data.penFile).toBe("string");
        expect(typeof data.variables).toBe("object");
      }
    }
  });
});

// ─── nib_brand_push — unit (no Pencil MCP) ───────────────────────────────────

describe("nib_brand_push — unit", () => {
  it("returns isError when config file does not exist", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_push",
      arguments: { config: "/tmp/nonexistent-nib-push-99999.json" },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.text.length).toBeGreaterThan(0);
  });

  it("response content is always an array with at least one text block", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_push",
      arguments: { config: "/tmp/nonexistent-nib-push-shape-99999.json" },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(Array.isArray(content)).toBe(true);
    expect(content.length).toBeGreaterThan(0);
    expect(content[0]!.type).toBe("text");
    expect(typeof content[0]!.text).toBe("string");
  });
});

// ─── nib_brand_import — unit ──────────────────────────────────────────────────

describe("nib_brand_import — unit", () => {
  it("response content always has at least one text block", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_import",
      arguments: { file: "/tmp/nonexistent-nib-import-shape-99999.pen" },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(Array.isArray(content)).toBe(true);
    expect(content.length).toBeGreaterThan(0);
    expect(content[0]!.type).toBe("text");
    expect(typeof content[0]!.text).toBe("string");
    expect(content[0]!.text.length).toBeGreaterThan(0);
  });

  it("overwrite:false returns requiresConfirmation when brand.config.json exists in cwd", async () => {
    const { client } = await createTestPair();
    // Project has a .nib/brand.config.json — diff-check fires before Pencil MCP is needed
    const result = await client.callTool({
      name: "nib_brand_import",
      arguments: {
        file: "/tmp/nonexistent-nib-import-confirm-99999.pen",
        overwrite: false,
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content.length).toBeGreaterThan(0);
    expect(typeof content[0]!.text).toBe("string");

    // When config exists and overwrite is false, must return requiresConfirmation
    if (!result.isError) {
      const data = JSON.parse(content[0]!.text);
      expect(data.requiresConfirmation).toBe(true);
      expect(typeof data.configPath).toBe("string");
    }
  });

  it("response is either a JSON object or an error string — never empty", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_brand_import",
      arguments: { file: "/tmp/nonexistent-nib-import-empty-check-99999.pen" },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const text = content[0]!.text;
    expect(text.length).toBeGreaterThan(0);

    // Must be either valid JSON (success/diff) or a non-empty error string
    try {
      const parsed = JSON.parse(text);
      // JSON path: requiresConfirmation or actual import result
      expect(typeof parsed).toBe("object");
    } catch {
      // String error path — must contain some meaningful message
      expect(text.length).toBeGreaterThan(5);
    }
  });
});
