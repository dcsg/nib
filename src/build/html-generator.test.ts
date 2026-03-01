/**
 * Unit tests for HTML generation from DesignDocument nodes.
 */

import { describe, it, expect } from "bun:test";
import { generateHtml } from "./html-generator.js";
import type { DesignDocument, ResolvedNode } from "../types/design.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDoc(canvasChildren: ResolvedNode[] = [], name = "Home"): DesignDocument {
  return {
    version: "1",
    source: "test.pen",
    capturedAt: new Date().toISOString(),
    canvases: [
      {
        id: "canvas-1",
        name,
        width: 390,
        height: 844,
        children: canvasChildren,
      },
    ],
    components: {},
    variables: {},
    themes: { axes: {} },
    assets: [],
  };
}

function baseOptions() {
  return {
    template: "clean" as const,
    css: "/* test css */",
    assetLinks: [],
  };
}

// ─── Document structure ───────────────────────────────────────────────────────

describe("generateHtml — document structure", () => {
  it("returns a non-empty HTML string", () => {
    const html = generateHtml(makeDoc(), baseOptions());
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(0);
  });

  it("includes the CSS in output", () => {
    const html = generateHtml(makeDoc(), { ...baseOptions(), css: ".custom { color: red; }" });
    expect(html).toContain(".custom { color: red; }");
  });

  it("includes each canvas as a div.nib-canvas", () => {
    const html = generateHtml(makeDoc(), baseOptions());
    expect(html).toContain('class="nib-canvas"');
    expect(html).toContain('data-name="Home"');
  });

  it("includes canvas index as data-index", () => {
    const html = generateHtml(makeDoc(), baseOptions());
    expect(html).toContain('data-index="0"');
  });
});

// ─── Text rendering ───────────────────────────────────────────────────────────

describe("generateHtml — text node rendering", () => {
  it("renders small text as <p>", () => {
    const node: ResolvedNode = {
      id: "t1", type: "text", text: "Body text",
      textStyle: { fontSize: 16 },
    };
    const html = generateHtml(makeDoc([node]), baseOptions());
    expect(html).toContain("<p ");
    expect(html).toContain("Body text");
  });

  it("renders fontSize >= 32 as <h1>", () => {
    const node: ResolvedNode = {
      id: "t2", type: "text", text: "Big Heading",
      textStyle: { fontSize: 36 },
    };
    const html = generateHtml(makeDoc([node]), baseOptions());
    expect(html).toContain("<h1 ");
    expect(html).toContain("Big Heading");
  });

  it("renders fontSize >= 24 and < 32 as <h2>", () => {
    const node: ResolvedNode = {
      id: "t3", type: "text", text: "Section Header",
      textStyle: { fontSize: 24 },
    };
    const html = generateHtml(makeDoc([node]), baseOptions());
    expect(html).toContain("<h2 ");
  });

  it("renders fontSize >= 20 and < 24 as <h3>", () => {
    const node: ResolvedNode = {
      id: "t4", type: "text", text: "Subsection",
      textStyle: { fontSize: 20 },
    };
    const html = generateHtml(makeDoc([node]), baseOptions());
    expect(html).toContain("<h3 ");
  });

  it("defaults to <p> when textStyle is absent", () => {
    const node: ResolvedNode = { id: "t5", type: "text", text: "Default" };
    const html = generateHtml(makeDoc([node]), baseOptions());
    expect(html).toContain("<p ");
  });

  it("escapes HTML special characters in text content", () => {
    const node: ResolvedNode = {
      id: "t6", type: "text", text: "<b>bold</b>",
    };
    const html = generateHtml(makeDoc([node]), baseOptions());
    // The escaped text should appear inside the <p> tag
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
    // Raw unescaped tag must not appear as an element
    expect(html).not.toMatch(/<p[^>]*><b>/);
  });

  it("escapes & in text content", () => {
    const node: ResolvedNode = { id: "t7", type: "text", text: "Terms & Conditions" };
    const html = generateHtml(makeDoc([node]), baseOptions());
    expect(html).toContain("Terms &amp; Conditions");
  });
});

// ─── Path rendering ───────────────────────────────────────────────────────────

describe("generateHtml — path node rendering", () => {
  it("renders a path node as <svg><path>", () => {
    const node: ResolvedNode = {
      id: "p1", type: "path",
      pathData: "M 0 0 L 10 10",
      width: 24, height: 24,
    };
    const html = generateHtml(makeDoc([node]), baseOptions());
    expect(html).toContain("<svg ");
    expect(html).toContain("<path ");
    expect(html).toContain('d="M 0 0 L 10 10"');
  });

  it("uses node fill color for path fill", () => {
    const node: ResolvedNode = {
      id: "p2", type: "path",
      pathData: "M 0 0",
      fills: [{ type: "solid", color: "#3b82f6" }],
    };
    const html = generateHtml(makeDoc([node]), baseOptions());
    expect(html).toContain('fill="#3b82f6"');
  });

  it("falls back to currentColor when no fill", () => {
    const node: ResolvedNode = { id: "p3", type: "path", pathData: "M 0 0" };
    const html = generateHtml(makeDoc([node]), baseOptions());
    expect(html).toContain('fill="currentColor"');
  });

  it("renders empty div when pathData is missing", () => {
    const node: ResolvedNode = { id: "p4", type: "path" };
    const html = generateHtml(makeDoc([node]), baseOptions());
    expect(html).toContain("<div ");
    expect(html).not.toContain("<svg");
  });

  it("escapes path data in attribute", () => {
    const node: ResolvedNode = {
      id: "p5", type: "path",
      pathData: 'M 0 "0"',
    };
    const html = generateHtml(makeDoc([node]), baseOptions());
    expect(html).toContain("&quot;");
  });
});

// ─── Icon rendering ───────────────────────────────────────────────────────────

describe("generateHtml — icon_font node rendering", () => {
  it("renders Material icon as <span class='material-symbols-...'>", () => {
    const node: ResolvedNode = {
      id: "i1", type: "icon_font",
      iconFamily: "Material Symbols",
      iconName: "home",
      iconStyle: "outlined",
    };
    const html = generateHtml(makeDoc([node]), baseOptions());
    expect(html).toContain("<span ");
    expect(html).toContain("material-symbols-outlined");
    expect(html).toContain("home");
  });

  it("renders Lucide icon as <i data-lucide='...'>", () => {
    const node: ResolvedNode = {
      id: "i2", type: "icon_font",
      iconFamily: "Lucide",
      iconName: "arrow-right",
    };
    const html = generateHtml(makeDoc([node]), baseOptions());
    expect(html).toContain('<i ');
    expect(html).toContain('data-lucide="arrow-right"');
  });

  it("falls back to generic icon span for unknown families", () => {
    const node: ResolvedNode = {
      id: "i3", type: "icon_font",
      iconFamily: "CustomIcons",
      iconName: "star",
    };
    const html = generateHtml(makeDoc([node]), baseOptions());
    expect(html).toContain('class="icon"');
    expect(html).toContain("star");
  });

  it("escapes icon name in HTML content", () => {
    const node: ResolvedNode = {
      id: "i4", type: "icon_font",
      iconFamily: "Material Symbols",
      iconName: "<bad>",
    };
    const html = generateHtml(makeDoc([node]), baseOptions());
    expect(html).toContain("&lt;bad&gt;");
    expect(html).not.toContain("<bad>");
  });
});

// ─── Div (frame/rectangle/group) rendering ────────────────────────────────────

describe("generateHtml — div rendering", () => {
  it("renders a frame as a div with its id", () => {
    const node: ResolvedNode = { id: "frame-1", type: "frame" };
    const html = generateHtml(makeDoc([node]), baseOptions());
    expect(html).toContain('id="n-frame-1"');
    expect(html).toContain("<div ");
  });

  it("includes data-node-name when node has a name", () => {
    const node: ResolvedNode = { id: "btn", type: "frame", name: "Primary Button" };
    const html = generateHtml(makeDoc([node]), baseOptions());
    expect(html).toContain('data-node-name="Primary Button"');
  });

  it("escapes node name in data attribute", () => {
    const node: ResolvedNode = { id: "btn", type: "frame", name: 'Say "hello"' };
    const html = generateHtml(makeDoc([node]), baseOptions());
    expect(html).toContain("&quot;hello&quot;");
  });

  it("renders children inside the div", () => {
    const node: ResolvedNode = {
      id: "parent", type: "frame",
      children: [{ id: "child", type: "text", text: "nested" }],
    };
    const html = generateHtml(makeDoc([node]), baseOptions());
    expect(html).toContain("nested");
    // child should appear inside parent
    const parentIdx = html.indexOf('id="n-parent"');
    const childIdx = html.indexOf('id="n-child"');
    expect(childIdx).toBeGreaterThan(parentIdx);
  });

  it("escapes special characters in node id", () => {
    const node: ResolvedNode = { id: "frame/section.1", type: "frame" };
    const html = generateHtml(makeDoc([node]), baseOptions());
    expect(html).toContain('id="n-frame_section_1"');
    expect(html).not.toContain("frame/section.1");
  });
});

// ─── Multiple canvases ────────────────────────────────────────────────────────

describe("generateHtml — multiple canvases", () => {
  it("renders all canvases", () => {
    const doc: DesignDocument = {
      version: "1",
      source: "test.pen",
      capturedAt: new Date().toISOString(),
      canvases: [
        { id: "c1", name: "Home", width: 390, height: 844, children: [] },
        { id: "c2", name: "Sign Up", width: 390, height: 844, children: [] },
      ],
      components: {},
      variables: {},
      themes: { axes: {} },
      assets: [],
    };
    const html = generateHtml(doc, baseOptions());
    expect(html).toContain('data-name="Home"');
    expect(html).toContain('data-name="Sign Up"');
    expect(html).toContain('data-index="0"');
    expect(html).toContain('data-index="1"');
  });
});
