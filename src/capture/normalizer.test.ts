/**
 * Unit tests for PenNode → ResolvedNode normalization.
 *
 * Tests: normalizeNodes, ref resolution, override application,
 * layout normalization, stroke/shadow/padding normalization.
 */

import { describe, it, expect } from "bun:test";
import { normalizeNodes } from "./normalizer.js";
import type { PenNode } from "../types/pen.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function frame(id: string, overrides: Partial<PenNode> = {}): PenNode {
  return { id, type: "frame", name: id, x: 0, y: 0, width: 100, height: 100, ...overrides };
}

function textNode(id: string, text: string, overrides: Partial<PenNode> = {}): PenNode {
  return { id, type: "text", name: id, text, ...overrides };
}

// ─── Basic filtering ──────────────────────────────────────────────────────────

describe("normalizeNodes — filtering", () => {
  it("returns an empty array for empty input", () => {
    expect(normalizeNodes([], {})).toHaveLength(0);
  });

  it("filters out invisible nodes (visible: false)", () => {
    const nodes: PenNode[] = [
      frame("visible"),
      frame("hidden", { visible: false }),
    ];
    const result = normalizeNodes(nodes, {});
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("visible");
  });

  it("filters out note nodes", () => {
    const nodes: PenNode[] = [
      frame("f1"),
      { id: "note1", type: "note", name: "A sticky note" },
    ];
    const result = normalizeNodes(nodes, {});
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("f1");
  });

  it("filters out unknown node types", () => {
    const nodes: PenNode[] = [
      frame("f1"),
      { id: "unknown1", type: "unknown" as PenNode["type"] },
    ];
    const result = normalizeNodes(nodes, {});
    expect(result).toHaveLength(1);
  });
});

// ─── Node type mapping ────────────────────────────────────────────────────────

describe("normalizeNodes — type mapping", () => {
  it("maps 'frame' to type 'frame'", () => {
    const result = normalizeNodes([frame("f")], {});
    expect(result[0]!.type).toBe("frame");
  });

  it("maps 'text' to type 'text'", () => {
    const result = normalizeNodes([textNode("t", "hello")], {});
    expect(result[0]!.type).toBe("text");
  });

  it("maps 'component' to type 'frame'", () => {
    const nodes: PenNode[] = [{ id: "c1", type: "component", name: "Button" }];
    const result = normalizeNodes(nodes, {});
    expect(result[0]!.type).toBe("frame");
  });

  it("maps 'rectangle' to type 'rectangle'", () => {
    const nodes: PenNode[] = [{ id: "r1", type: "rectangle" }];
    const result = normalizeNodes(nodes, {});
    expect(result[0]!.type).toBe("rectangle");
  });

  it("maps 'ellipse' to type 'ellipse'", () => {
    const nodes: PenNode[] = [{ id: "e1", type: "ellipse" }];
    const result = normalizeNodes(nodes, {});
    expect(result[0]!.type).toBe("ellipse");
  });

  it("maps 'icon_font' to type 'icon_font'", () => {
    const nodes: PenNode[] = [{ id: "i1", type: "icon_font", iconName: "home" }];
    const result = normalizeNodes(nodes, {});
    expect(result[0]!.type).toBe("icon_font");
  });

  it("maps 'path' to type 'path'", () => {
    const nodes: PenNode[] = [{ id: "p1", type: "path", pathData: "M0 0 L10 10" }];
    const result = normalizeNodes(nodes, {});
    expect(result[0]!.type).toBe("path");
  });
});

// ─── Geometry preservation ────────────────────────────────────────────────────

describe("normalizeNodes — geometry", () => {
  it("copies x, y, width, height", () => {
    const result = normalizeNodes([frame("f1", { x: 10, y: 20, width: 300, height: 200 })], {});
    expect(result[0]!.x).toBe(10);
    expect(result[0]!.y).toBe(20);
    expect(result[0]!.width).toBe(300);
    expect(result[0]!.height).toBe(200);
  });

  it("copies rotation when present", () => {
    const result = normalizeNodes([frame("f1", { rotation: 45 })], {});
    expect(result[0]!.rotation).toBe(45);
  });

  it("does not include rotation when absent", () => {
    const result = normalizeNodes([frame("f1")], {});
    expect(result[0]!.rotation).toBeUndefined();
  });

  it("copies horizontalSizing and verticalSizing", () => {
    const result = normalizeNodes(
      [frame("f1", { horizontalSizing: "fill_container", verticalSizing: "fit_content" })],
      {},
    );
    expect(result[0]!.horizontalSizing).toBe("fill_container");
    expect(result[0]!.verticalSizing).toBe("fit_content");
  });
});

// ─── Children ─────────────────────────────────────────────────────────────────

describe("normalizeNodes — children", () => {
  it("recursively normalizes children", () => {
    const parent = frame("parent", {
      children: [textNode("child", "hello"), frame("child2")],
    });
    const result = normalizeNodes([parent], {});
    expect(result[0]!.children).toHaveLength(2);
    expect(result[0]!.children![0]!.type).toBe("text");
    expect(result[0]!.children![1]!.type).toBe("frame");
  });

  it("filters invisible children", () => {
    const parent = frame("parent", {
      children: [frame("visible-child"), frame("hidden-child", { visible: false })],
    });
    const result = normalizeNodes([parent], {});
    expect(result[0]!.children).toHaveLength(1);
    expect(result[0]!.children![0]!.id).toBe("visible-child");
  });

  it("does not include children when node has none", () => {
    const result = normalizeNodes([frame("leaf")], {});
    expect(result[0]!.children).toBeUndefined();
  });
});

// ─── Visual properties ────────────────────────────────────────────────────────

describe("normalizeNodes — visual properties", () => {
  it("copies fills", () => {
    const node = frame("f", { fills: [{ type: "solid", color: "#3b82f6" }] });
    const result = normalizeNodes([node], {});
    expect(result[0]!.fills).toHaveLength(1);
    expect(result[0]!.fills![0]!.color).toBe("#3b82f6");
  });

  it("normalizes strokes — adds defaults for style and position", () => {
    const node = frame("f", { strokes: [{ color: "#000000", width: 1 }] });
    const result = normalizeNodes([node], {});
    const stroke = result[0]!.strokes![0]!;
    expect(stroke.style).toBe("solid");
    expect(stroke.position).toBe("inside");
    expect(stroke.color).toBe("#000000");
    expect(stroke.width).toBe(1);
  });

  it("normalizes shadows — adds default spread of 0", () => {
    const node = frame("f", {
      shadows: [{ type: "drop", color: "rgba(0,0,0,.1)", x: 0, y: 4, blur: 6 }],
    });
    const result = normalizeNodes([node], {});
    const shadow = result[0]!.shadows![0]!;
    expect(shadow.spread).toBe(0);
    expect(shadow.blur).toBe(6);
  });

  it("copies opacity when not 1", () => {
    const node = frame("f", { opacity: 0.5 });
    const result = normalizeNodes([node], {});
    expect(result[0]!.opacity).toBe(0.5);
  });

  it("does not include opacity when it is 1 (default)", () => {
    const node = frame("f", { opacity: 1 });
    const result = normalizeNodes([node], {});
    expect(result[0]!.opacity).toBeUndefined();
  });

  it("copies borderRadius as number", () => {
    const node = frame("f", { borderRadius: 8 });
    const result = normalizeNodes([node], {});
    expect(result[0]!.borderRadius).toBe(8);
  });

  it("copies borderRadius as object", () => {
    const br = { topLeft: 8, topRight: 8, bottomRight: 0, bottomLeft: 0 };
    const node = frame("f", { borderRadius: br });
    const result = normalizeNodes([node], {});
    expect(result[0]!.borderRadius).toEqual(br);
  });
});

// ─── Layout ───────────────────────────────────────────────────────────────────

describe("normalizeNodes — layout", () => {
  it("returns no layout when node has no layout prop", () => {
    const result = normalizeNodes([frame("f")], {});
    expect(result[0]!.layout).toBeUndefined();
  });

  it("returns no layout for direction:none with no gap/padding", () => {
    const node = frame("f", { layout: { layout: "none" } });
    const result = normalizeNodes([node], {});
    expect(result[0]!.layout).toBeUndefined();
  });

  it("returns layout for horizontal direction", () => {
    const node = frame("f", { layout: { layout: "horizontal", gap: 16 } });
    const result = normalizeNodes([node], {});
    expect(result[0]!.layout).toBeDefined();
    expect(result[0]!.layout!.direction).toBe("horizontal");
    expect(result[0]!.layout!.gap).toBe(16);
  });

  it("normalizes uniform padding number → Spacing object", () => {
    const node = frame("f", { layout: { layout: "vertical", padding: 12 } });
    const result = normalizeNodes([node], {});
    expect(result[0]!.layout!.padding).toEqual({ top: 12, right: 12, bottom: 12, left: 12 });
  });

  it("passes through padding object as-is", () => {
    const pad = { top: 8, right: 16, bottom: 8, left: 16 };
    const node = frame("f", { layout: { layout: "horizontal", padding: pad } });
    const result = normalizeNodes([node], {});
    expect(result[0]!.layout!.padding).toEqual(pad);
  });
});

// ─── Text properties ──────────────────────────────────────────────────────────

describe("normalizeNodes — text", () => {
  it("copies text content", () => {
    const result = normalizeNodes([textNode("t", "Hello World")], {});
    expect(result[0]!.text).toBe("Hello World");
  });

  it("copies textStyle", () => {
    const node = textNode("t", "Hi", {
      textStyle: { fontFamily: "Inter", fontSize: 16, color: "#111827" },
    });
    const result = normalizeNodes([node], {});
    expect(result[0]!.textStyle!.fontFamily).toBe("Inter");
    expect(result[0]!.textStyle!.fontSize).toBe(16);
  });
});

// ─── Ref resolution ───────────────────────────────────────────────────────────

describe("normalizeNodes — ref resolution", () => {
  const buttonComponent: PenNode = {
    id: "comp-button",
    type: "frame",
    name: "Button",
    width: 120,
    height: 40,
    fills: [{ type: "solid", color: "#3b82f6" }],
    children: [
      { id: "comp-label", type: "text", name: "label", text: "Click me" },
    ],
  };

  const components = { "comp-button": buttonComponent };

  it("resolves a ref node by cloning the component tree", () => {
    const ref: PenNode = {
      id: "ref-1",
      type: "ref",
      componentId: "comp-button",
      x: 50,
      y: 100,
    };
    const result = normalizeNodes([ref], components);
    expect(result).toHaveLength(1);
    const resolved = result[0]!;
    expect(resolved.id).toBe("ref-1");
    expect(resolved.type).toBe("frame");
    expect(resolved.x).toBe(50);
    expect(resolved.y).toBe(100);
  });

  it("resolved ref includes component children", () => {
    const ref: PenNode = { id: "ref-1", type: "ref", componentId: "comp-button" };
    const result = normalizeNodes([ref], components);
    expect(result[0]!.children).toHaveLength(1);
    expect(result[0]!.children![0]!.text).toBe("Click me");
  });

  it("applies overrides to the resolved ref children", () => {
    const ref: PenNode = {
      id: "ref-2",
      type: "ref",
      componentId: "comp-button",
      overrides: {
        "comp-label": { text: "Submit" },
      },
    };
    const result = normalizeNodes([ref], components);
    expect(result[0]!.children![0]!.text).toBe("Submit");
  });

  it("override does not mutate the original component", () => {
    const ref: PenNode = {
      id: "ref-3",
      type: "ref",
      componentId: "comp-button",
      overrides: { "comp-label": { text: "Changed" } },
    };
    normalizeNodes([ref], components);
    // Original component label text should still be "Click me"
    expect(buttonComponent.children![0]!.text).toBe("Click me");
  });

  it("returns null (skips) when componentId is missing", () => {
    const ref: PenNode = { id: "ref-bad", type: "ref" };
    const result = normalizeNodes([ref], components);
    expect(result).toHaveLength(0);
  });

  it("returns null (skips) when component is not found in registry", () => {
    const ref: PenNode = { id: "ref-404", type: "ref", componentId: "nonexistent" };
    const result = normalizeNodes([ref], components);
    expect(result).toHaveLength(0);
  });

  it("uses ref x/y position, not component x/y", () => {
    const compWithPosition: PenNode = { ...buttonComponent, x: 999, y: 999 };
    const comps = { "comp-button": compWithPosition };
    const ref: PenNode = { id: "ref-pos", type: "ref", componentId: "comp-button", x: 20, y: 40 };
    const result = normalizeNodes([ref], comps);
    expect(result[0]!.x).toBe(20);
    expect(result[0]!.y).toBe(40);
  });

  it("preserves ref width/height when specified", () => {
    const ref: PenNode = {
      id: "ref-sz",
      type: "ref",
      componentId: "comp-button",
      width: 200,
      height: 60,
    };
    const result = normalizeNodes([ref], components);
    expect(result[0]!.width).toBe(200);
    expect(result[0]!.height).toBe(60);
  });
});
