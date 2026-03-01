/**
 * Unit tests for CSS generation from DesignCanvas nodes.
 */

import { describe, it, expect } from "bun:test";
import { generateCss } from "./css-generator.js";
import type { DesignCanvas, ResolvedNode } from "../types/design.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function canvas(overrides: Partial<DesignCanvas> = {}): DesignCanvas {
  return {
    id: "canvas-1",
    name: "Home",
    width: 390,
    height: 844,
    children: [],
    ...overrides,
  };
}

function frameNode(id: string, overrides: Partial<ResolvedNode> = {}): ResolvedNode {
  return { id, type: "frame", x: 0, y: 0, width: 100, height: 50, ...overrides };
}

function textNode(id: string, text: string, overrides: Partial<ResolvedNode> = {}): ResolvedNode {
  return { id, type: "text", text, ...overrides };
}

// ─── Canvas container ─────────────────────────────────────────────────────────

describe("generateCss — canvas container", () => {
  it("emits a canvas selector with width and height", () => {
    const css = generateCss(canvas({ id: "home", width: 390, height: 844 }));
    expect(css).toContain("#canvas-home");
    expect(css).toContain("width: 390px");
    expect(css).toContain("height: 844px");
  });

  it("includes overflow: hidden on canvas", () => {
    const css = generateCss(canvas());
    expect(css).toContain("overflow: hidden");
  });

  it("includes background when backgroundColor is set", () => {
    const css = generateCss(canvas({ backgroundColor: "#f9fafb" }));
    expect(css).toContain("background: #f9fafb");
  });

  it("escapes special characters in canvas id", () => {
    const css = generateCss(canvas({ id: "canvas/home" }));
    expect(css).toContain("#canvas-canvas_home");
  });
});

// ─── Absolute positioning ─────────────────────────────────────────────────────

describe("generateCss — absolute positioning", () => {
  it("positions children absolutely by default (no parent layout)", () => {
    const css = generateCss(canvas({
      children: [frameNode("box", { x: 24, y: 48 })],
    }));
    expect(css).toContain("position: absolute");
    expect(css).toContain("left: 24px");
    expect(css).toContain("top: 48px");
  });

  it("emits width and height for absolute nodes", () => {
    const css = generateCss(canvas({
      children: [frameNode("box", { x: 0, y: 0, width: 200, height: 80 })],
    }));
    expect(css).toContain("width: 200px");
    expect(css).toContain("height: 80px");
  });
});

// ─── Flex layout ─────────────────────────────────────────────────────────────

describe("generateCss — flex layout", () => {
  it("emits display:flex for horizontal layout", () => {
    const parent = frameNode("parent", {
      layout: { direction: "horizontal", gap: 16 },
      children: [frameNode("child")],
    });
    const css = generateCss(canvas({ children: [parent] }));
    expect(css).toContain("display: flex");
    expect(css).toContain("flex-direction: row");
    expect(css).toContain("gap: 16px");
  });

  it("emits flex-direction:column for vertical layout", () => {
    const parent = frameNode("parent", {
      layout: { direction: "vertical" },
    });
    const css = generateCss(canvas({ children: [parent] }));
    expect(css).toContain("flex-direction: column");
  });

  it("emits padding when layout.padding is set", () => {
    const parent = frameNode("parent", {
      layout: {
        direction: "horizontal",
        padding: { top: 8, right: 16, bottom: 8, left: 16 },
      },
    });
    const css = generateCss(canvas({ children: [parent] }));
    expect(css).toContain("padding: 8px 16px 8px 16px");
  });

  it("flex child with fill_container gets flex: 1 1 0%", () => {
    const parent = frameNode("parent", {
      layout: { direction: "horizontal" },
      children: [frameNode("child", { horizontalSizing: "fill_container" })],
    });
    const css = generateCss(canvas({ children: [parent] }));
    expect(css).toContain("flex: 1 1 0%");
  });

  it("flex child with fit_content gets flex: 0 0 auto", () => {
    const parent = frameNode("parent", {
      layout: { direction: "horizontal" },
      children: [frameNode("child", { horizontalSizing: "fit_content" })],
    });
    const css = generateCss(canvas({ children: [parent] }));
    expect(css).toContain("flex: 0 0 auto");
  });

  it("emits align-items and justify-content", () => {
    const parent = frameNode("parent", {
      layout: { direction: "horizontal", alignItems: "center", justifyContent: "space-between" },
    });
    const css = generateCss(canvas({ children: [parent] }));
    expect(css).toContain("align-items: center");
    expect(css).toContain("justify-content: space-between");
  });

  it("maps 'start' to flex-start for alignItems", () => {
    const parent = frameNode("parent", {
      layout: { direction: "horizontal", alignItems: "start" },
    });
    const css = generateCss(canvas({ children: [parent] }));
    expect(css).toContain("align-items: flex-start");
  });

  it("emits flex-wrap: wrap when wrap is true", () => {
    const parent = frameNode("parent", {
      layout: { direction: "horizontal", wrap: true },
    });
    const css = generateCss(canvas({ children: [parent] }));
    expect(css).toContain("flex-wrap: wrap");
  });
});

// ─── Fills ────────────────────────────────────────────────────────────────────

describe("generateCss — fills", () => {
  it("solid fill emits background color", () => {
    const node = frameNode("box", { fills: [{ type: "solid", color: "#3b82f6" }] });
    const css = generateCss(canvas({ children: [node] }));
    expect(css).toContain("background: #3b82f6");
  });

  it("solid fill with opacity applies alpha to hex color", () => {
    const node = frameNode("box", { fills: [{ type: "solid", color: "#3b82f6", opacity: 0.5 }] });
    const css = generateCss(canvas({ children: [node] }));
    // Opacity applied as 8-char hex (#3b82f6 + alpha)
    expect(css).toMatch(/background: #3b82f6[0-9a-f]{2}/);
  });

  it("linear gradient fill emits linear-gradient()", () => {
    const node = frameNode("box", {
      fills: [{
        type: "linear",
        gradient: [
          { position: 0, color: "#000000" },
          { position: 1, color: "#ffffff" },
        ],
      }],
    });
    const css = generateCss(canvas({ children: [node] }));
    expect(css).toContain("linear-gradient");
  });

  it("radial gradient fill emits radial-gradient()", () => {
    const node = frameNode("box", {
      fills: [{
        type: "radial",
        gradient: [
          { position: 0, color: "#3b82f6" },
          { position: 1, color: "#1e40af" },
        ],
      }],
    });
    const css = generateCss(canvas({ children: [node] }));
    expect(css).toContain("radial-gradient");
  });
});

// ─── Strokes ─────────────────────────────────────────────────────────────────

describe("generateCss — strokes", () => {
  it("inside stroke emits border + box-sizing: border-box", () => {
    const node = frameNode("box", {
      strokes: [{ color: "#e5e7eb", width: 1, style: "solid", position: "inside" }],
    });
    const css = generateCss(canvas({ children: [node] }));
    expect(css).toContain("border: 1px solid #e5e7eb");
    expect(css).toContain("box-sizing: border-box");
  });

  it("outside stroke emits outline", () => {
    const node = frameNode("box", {
      strokes: [{ color: "#3b82f6", width: 2, style: "solid", position: "outside" }],
    });
    const css = generateCss(canvas({ children: [node] }));
    expect(css).toContain("outline: 2px solid #3b82f6");
  });
});

// ─── Shadows ─────────────────────────────────────────────────────────────────

describe("generateCss — shadows", () => {
  it("drop shadow emits box-shadow without inset", () => {
    const node = frameNode("box", {
      shadows: [{ type: "drop", color: "rgba(0,0,0,.1)", x: 0, y: 4, blur: 6, spread: 0 }],
    });
    const css = generateCss(canvas({ children: [node] }));
    expect(css).toContain("box-shadow: 0px 4px 6px 0px rgba(0,0,0,.1)");
  });

  it("inner shadow emits box-shadow with inset", () => {
    const node = frameNode("box", {
      shadows: [{ type: "inner", color: "rgba(0,0,0,.2)", x: 0, y: 2, blur: 4, spread: 0 }],
    });
    const css = generateCss(canvas({ children: [node] }));
    expect(css).toContain("inset 0px 2px 4px 0px");
  });

  it("multiple shadows are comma-separated", () => {
    const node = frameNode("box", {
      shadows: [
        { type: "drop", color: "rgba(0,0,0,.1)", x: 0, y: 1, blur: 2, spread: 0 },
        { type: "drop", color: "rgba(0,0,0,.2)", x: 0, y: 4, blur: 8, spread: 0 },
      ],
    });
    const css = generateCss(canvas({ children: [node] }));
    const shadowLine = css.split("\n").find((l) => l.includes("box-shadow"))!;
    expect(shadowLine).toContain(", ");
  });
});

// ─── Border radius ────────────────────────────────────────────────────────────

describe("generateCss — border radius", () => {
  it("uniform border radius emits border-radius: Npx", () => {
    const node = frameNode("box", { borderRadius: 8 });
    const css = generateCss(canvas({ children: [node] }));
    expect(css).toContain("border-radius: 8px");
  });

  it("zero border radius is not emitted", () => {
    const node = frameNode("box", { borderRadius: 0 });
    const css = generateCss(canvas({ children: [node] }));
    expect(css).not.toContain("border-radius");
  });

  it("per-corner border radius emits four values", () => {
    const node = frameNode("box", {
      borderRadius: { topLeft: 8, topRight: 8, bottomRight: 0, bottomLeft: 0 },
    });
    const css = generateCss(canvas({ children: [node] }));
    expect(css).toContain("border-radius: 8px 8px 0px 0px");
  });

  it("ellipse always gets border-radius: 50%", () => {
    const node: ResolvedNode = { id: "circle", type: "ellipse", width: 40, height: 40 };
    const css = generateCss(canvas({ children: [node] }));
    expect(css).toContain("border-radius: 50%");
  });
});

// ─── Text styles ──────────────────────────────────────────────────────────────

describe("generateCss — text styles", () => {
  it("emits font-family, font-size, font-weight, color", () => {
    const node = textNode("label", "Hello", {
      textStyle: { fontFamily: "Inter", fontSize: 16, fontWeight: 600, color: "#111827" },
    });
    const css = generateCss(canvas({ children: [node] }));
    expect(css).toContain("font-family: 'Inter', sans-serif");
    expect(css).toContain("font-size: 16px");
    expect(css).toContain("font-weight: 600");
    expect(css).toContain("color: #111827");
  });

  it("emits line-height as px when numeric", () => {
    const node = textNode("label", "Hi", {
      textStyle: { lineHeight: 24 },
    });
    const css = generateCss(canvas({ children: [node] }));
    expect(css).toContain("line-height: 24px");
  });

  it("emits font-style: italic when fontStyle is italic", () => {
    const node = textNode("label", "Hi", {
      textStyle: { fontStyle: "italic" },
    });
    const css = generateCss(canvas({ children: [node] }));
    expect(css).toContain("font-style: italic");
  });

  it("emits text-decoration: underline", () => {
    const node = textNode("label", "link", {
      textStyle: { textDecoration: "underline" },
    });
    const css = generateCss(canvas({ children: [node] }));
    expect(css).toContain("text-decoration: underline");
  });

  it("does not emit text-decoration: none (default)", () => {
    const node = textNode("label", "text", {
      textStyle: { textDecoration: "none" },
    });
    const css = generateCss(canvas({ children: [node] }));
    expect(css).not.toContain("text-decoration");
  });
});

// ─── Other visual ─────────────────────────────────────────────────────────────

describe("generateCss — other visual properties", () => {
  it("emits opacity when < 1", () => {
    const node = frameNode("box", { opacity: 0.75 });
    const css = generateCss(canvas({ children: [node] }));
    expect(css).toContain("opacity: 0.75");
  });

  it("does not emit opacity when undefined", () => {
    const css = generateCss(canvas({ children: [frameNode("box")] }));
    expect(css).not.toContain("opacity");
  });

  it("emits overflow:hidden when set", () => {
    const node = frameNode("box", { overflow: "hidden" });
    const css = generateCss(canvas({ children: [node] }));
    expect(css).toContain("overflow: hidden");
  });

  it("emits transform:rotate for rotation", () => {
    const node = frameNode("box", { rotation: 45 });
    const css = generateCss(canvas({ children: [node] }));
    expect(css).toContain("transform: rotate(45deg)");
  });

  it("emits filter:blur for layer blur", () => {
    const node = frameNode("box", { blur: { type: "layer", radius: 8 } });
    const css = generateCss(canvas({ children: [node] }));
    expect(css).toContain("filter: blur(8px)");
  });

  it("emits backdrop-filter:blur for background blur", () => {
    const node = frameNode("box", { blur: { type: "background", radius: 12 } });
    const css = generateCss(canvas({ children: [node] }));
    expect(css).toContain("backdrop-filter: blur(12px)");
  });
});
