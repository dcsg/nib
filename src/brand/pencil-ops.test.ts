/**
 * Unit tests for the Pencil transformation layer (pencil-ops.ts).
 *
 * These tests verify the critical property mappings enforced by toPencilOps():
 *   - frame.backgroundColor  → Pencil: fill
 *   - frame.borderColor      → Pencil: stroke.fill
 *   - text.textColor         → Pencil: fill (NOT color — Pencil silently ignores color:)
 *   - text.textContent       → Pencil: content
 *   - cornerRadius: N        → [N, N, N, N]
 *   - children are nested in correct parent-child order
 *   - variable references ($token) pass through unchanged
 */

import { describe, it, expect } from "bun:test";
import { toPencilOps, specToOps } from "./pencil-ops.js";

describe("toPencilOps — frame", () => {
  it("frame with backgroundColor emits fill: not color:", () => {
    const ops = toPencilOps(
      { id: "btn", type: "frame", name: "Button", width: 100, height: 40, backgroundColor: "#ff0000" },
      "document",
    );
    expect(ops[0]).toContain("fill:");
    expect(ops[0]).not.toContain("color:");
    expect(ops[0]).toContain('"#ff0000"');
  });

  it("frame with borderColor emits stroke object with align, fill, thickness", () => {
    const ops = toPencilOps(
      { id: "box", type: "frame", name: "Box", width: 100, height: 100, borderColor: "$--border" },
      "document",
    );
    expect(ops[0]).toContain("stroke:");
    expect(ops[0]).toContain("align:");
    expect(ops[0]).toContain('"inside"');
    expect(ops[0]).toContain("thickness:");
    expect(ops[0]).toContain('"$--border"');
  });

  it("frame with borderColor uses inside alignment by default", () => {
    const ops = toPencilOps(
      { id: "f", type: "frame", name: "F", borderColor: "$--border" },
      "document",
    );
    expect(ops[0]).toContain('"inside"');
  });

  it("frame with borderAlign overrides the default alignment", () => {
    const ops = toPencilOps(
      { id: "f", type: "frame", name: "F", borderColor: "$--border", borderAlign: "outside" },
      "document",
    );
    expect(ops[0]).toContain('"outside"');
  });

  it("frame with borderWidth overrides the default thickness of 1", () => {
    const ops = toPencilOps(
      { id: "f", type: "frame", name: "F", borderColor: "$--border", borderWidth: 2 },
      "document",
    );
    expect(ops[0]).toContain("thickness:2");
  });

  it("cornerRadius number expands to [N,N,N,N] array", () => {
    const ops = toPencilOps(
      { id: "f", type: "frame", name: "Frame", cornerRadius: 6 },
      "document",
    );
    expect(ops[0]).toContain("cornerRadius:[6,6,6,6]");
  });

  it("cornerRadius array passes through unchanged", () => {
    const ops = toPencilOps(
      { id: "f", type: "frame", name: "Frame", cornerRadius: [4, 8, 4, 8] },
      "document",
    );
    expect(ops[0]).toContain("cornerRadius:[4,8,4,8]");
  });

  it("frame without backgroundColor emits no fill property", () => {
    const ops = toPencilOps(
      { id: "f", type: "frame", name: "Frame" },
      "document",
    );
    expect(ops[0]).not.toContain("fill:");
  });

  it("frame without borderColor emits no stroke property", () => {
    const ops = toPencilOps(
      { id: "f", type: "frame", name: "Frame" },
      "document",
    );
    expect(ops[0]).not.toContain("stroke:");
  });
});

describe("toPencilOps — text", () => {
  it("text with textColor emits fill: not color:", () => {
    const ops = toPencilOps(
      { id: "lbl", type: "text", name: "label", textContent: "Hello", textColor: "#111111" },
      "document",
    );
    expect(ops[0]).toContain("fill:");
    expect(ops[0]).not.toContain("color:");
    expect(ops[0]).toContain('"#111111"');
  });

  it("text with textColor variable reference emits fill with $sigil", () => {
    const ops = toPencilOps(
      { id: "lbl", type: "text", name: "label", textContent: "Hi", textColor: "$--foreground" },
      "document",
    );
    expect(ops[0]).toContain('fill:"$--foreground"');
  });

  it("textContent maps to content property", () => {
    const ops = toPencilOps(
      { id: "lbl", type: "text", name: "Label", textContent: "Hello World" },
      "document",
    );
    expect(ops[0]).toContain('content:"Hello World"');
    expect(ops[0]).not.toContain("textContent:");
  });

  it("text node does NOT emit layout, gap, or padding properties", () => {
    const ops = toPencilOps(
      { id: "lbl", type: "text", name: "Label", textContent: "Hi", textColor: "#111" },
      "document",
    );
    expect(ops[0]).not.toContain("layout:");
    expect(ops[0]).not.toContain("gap:");
    expect(ops[0]).not.toContain("padding:");
  });

  it("text node does NOT emit stroke even if backgroundColor were somehow present", () => {
    // backgroundColor is a frame-only property — text nodes ignore it
    const spec = { id: "lbl", type: "text" as const, name: "L", textContent: "X" };
    const ops = toPencilOps(spec, "document");
    expect(ops[0]).not.toContain("stroke:");
  });
});

describe("toPencilOps — variable references", () => {
  it("$-prefixed fill references pass through unchanged", () => {
    const ops = toPencilOps(
      { id: "btn", type: "frame", name: "Button", backgroundColor: "$button-bg-primary" },
      "document",
    );
    expect(ops[0]).toContain('"$button-bg-primary"');
  });

  it("$-prefixed text color references pass through unchanged", () => {
    const ops = toPencilOps(
      { id: "lbl", type: "text", name: "label", textColor: "$button-text-primary" },
      "document",
    );
    expect(ops[0]).toContain('"$button-text-primary"');
  });

  it("$-prefixed border references pass through unchanged in stroke", () => {
    const ops = toPencilOps(
      { id: "f", type: "frame", name: "F", borderColor: "$--border" },
      "document",
    );
    expect(ops[0]).toContain('"$--border"');
  });
});

describe("toPencilOps — parent/child nesting", () => {
  it("children are recursively emitted with correct parent binding", () => {
    const ops = toPencilOps({
      id: "parent",
      type: "frame",
      name: "Parent",
      children: [{
        id: "child",
        type: "text",
        name: "Child",
        textContent: "Hello",
      }],
    }, "document");

    expect(ops).toHaveLength(2);
    expect(ops[0]).toContain("parent=I(document,");
    expect(ops[1]).toContain("child=I(parent,");
  });

  it("deeply nested children reference their immediate parent binding", () => {
    const ops = toPencilOps({
      id: "root",
      type: "frame",
      name: "Root",
      children: [{
        id: "mid",
        type: "frame",
        name: "Mid",
        children: [{
          id: "leaf",
          type: "text",
          name: "Leaf",
          textContent: "deep",
        }],
      }],
    }, "document");

    expect(ops).toHaveLength(3);
    expect(ops[0]).toContain("root=I(document,");
    expect(ops[1]).toContain("mid=I(root,");
    expect(ops[2]).toContain("leaf=I(mid,");
  });

  it("parent uses the provided parent argument (not hardcoded document)", () => {
    const ops = toPencilOps(
      { id: "child", type: "frame", name: "Child" },
      "custom_parent_123",
    );
    expect(ops[0]).toContain("child=I(custom_parent_123,");
  });
});

describe("specToOps", () => {
  it("joins all ops into a single multi-line string", () => {
    const result = specToOps({
      id: "root",
      type: "frame",
      name: "Root",
      children: [{
        id: "child",
        type: "text",
        name: "Child",
        textContent: "Hi",
      }],
    }, "document");

    expect(typeof result).toBe("string");
    const lines = result.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("root=I(document,");
    expect(lines[1]).toContain("child=I(root,");
  });

  it("single node produces a single-line string (no trailing newline)", () => {
    const result = specToOps(
      { id: "f", type: "frame", name: "Frame" },
      "document",
    );
    expect(result).not.toContain("\n");
    expect(result).toContain("f=I(document,");
  });
});

describe("toPencilOps — op string format", () => {
  it("produces binding=I(parent, props) format", () => {
    const ops = toPencilOps(
      { id: "btn_root", type: "frame", name: "Button" },
      "document",
    );
    expect(ops[0]).toMatch(/^btn_root=I\(document, \{/);
  });

  it("type and name are always first props in the object", () => {
    const ops = toPencilOps(
      { id: "f", type: "frame", name: "My Frame", backgroundColor: "$--bg" },
      "document",
    );
    expect(ops[0]).toMatch(/\{type:"frame",name:"My Frame"/);
  });

  it("frame fill and stroke match the regex used in integration tests", () => {
    const ops = toPencilOps(
      { id: "btn_root", type: "frame", name: "Button", backgroundColor: "$button-bg-primary" },
      "document",
    );
    // Same regex as tools-invocation.test.ts line 777
    expect(ops[0]).toMatch(/fill:"[^"]*\$[a-z]/);
  });
});
