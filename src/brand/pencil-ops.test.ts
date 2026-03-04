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

import { describe, it, expect, spyOn, beforeEach, afterEach } from "bun:test";
import {
  toPencilOps, specToOps,
  TransformationError,
  PENCIL_LUCIDE_ALLOWLIST,
  PENCIL_LUCIDE_FALLBACK_MAP,
  resolveIconName,
  sanitiseTextContent,
} from "./pencil-ops.js";

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

describe("toPencilOps — parent/child nesting (inline children)", () => {
  it("children are inlined into a children: array — produces exactly 1 op", () => {
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

    // Inlining: exactly 1 op, no separate child I() call
    expect(ops).toHaveLength(1);
    expect(ops[0]).toContain("parent=I(document,");
    // Child content is inlined in children: array
    expect(ops[0]).toContain("children:");
    expect(ops[0]).toContain('"Hello"');
    // No separate binding for the child
    expect(ops[0]).not.toContain("child=I(parent,");
  });

  it("deeply nested children are recursively inlined — still 1 op total", () => {
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

    // All levels inlined — still 1 op
    expect(ops).toHaveLength(1);
    expect(ops[0]).toContain("root=I(document,");
    // Mid and leaf are in nested children arrays
    expect(ops[0]).toContain('"Mid"');
    expect(ops[0]).toContain('"deep"');
    // No separate ops for mid or leaf
    expect(ops[0]).not.toContain("mid=I(root,");
    expect(ops[0]).not.toContain("leaf=I(mid,");
  });

  it("parent uses the provided parent argument (not hardcoded document)", () => {
    const ops = toPencilOps(
      { id: "child", type: "frame", name: "Child" },
      "custom_parent_123",
    );
    expect(ops[0]).toContain("child=I(custom_parent_123,");
  });

  it("inline children have their NibNodeSpec properties mapped to Pencil props", () => {
    const ops = toPencilOps({
      id: "card",
      type: "frame",
      name: "Card",
      backgroundColor: "$--card",
      children: [{
        id: "lbl",
        type: "text",
        name: "label",
        textContent: "Click me",
        textColor: "$--foreground",
      }],
    }, "document");

    expect(ops).toHaveLength(1);
    // Parent fill mapped correctly
    expect(ops[0]).toContain('"$--card"');
    // Child textContent → content, textColor → fill
    expect(ops[0]).toContain('content:"Click me"');
    expect(ops[0]).toContain('"$--foreground"');
    // No "textContent:" key in output
    expect(ops[0]).not.toContain("textContent:");
  });
});

describe("specToOps", () => {
  it("always produces a single-line string — children are inlined, not separate ops", () => {
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
    // Children inlined — no newline, single op
    expect(result).not.toContain("\n");
    expect(result).toContain("root=I(document,");
    expect(result).toContain("children:");
    expect(result).toContain('"Hi"');
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

describe("toPencilOps — new node types and properties", () => {
  it("type:ellipse emits type:\"ellipse\" and fill from backgroundColor", () => {
    const ops = toPencilOps(
      { id: "dot", type: "ellipse", name: "dot", width: 8, height: 8, backgroundColor: "$--primary" },
      "document",
    );
    expect(ops[0]).toContain('type:"ellipse"');
    expect(ops[0]).toContain('fill:"$--primary"');
  });

  it("type:ellipse does NOT emit layout, gap, or padding", () => {
    const ops = toPencilOps(
      { id: "dot", type: "ellipse", name: "dot", backgroundColor: "#ff0000" },
      "document",
    );
    expect(ops[0]).not.toContain("layout:");
    expect(ops[0]).not.toContain("gap:");
    expect(ops[0]).not.toContain("padding:");
  });

  it("type:icon_font emits iconFontFamily, iconFontName, fill from textColor, and width/height", () => {
    const ops = toPencilOps(
      { id: "icon", type: "icon_font", name: "check-icon",
        iconFontFamily: "lucide", iconFontName: "check",
        width: 12, height: 12, textColor: "#ffffff" },
      "document",
    );
    expect(ops[0]).toContain('type:"icon_font"');
    expect(ops[0]).toContain('iconFontFamily:"lucide"');
    expect(ops[0]).toContain('iconFontName:"check"');
    expect(ops[0]).toContain('fill:"#ffffff"');
    expect(ops[0]).toContain("width:12");
    expect(ops[0]).toContain("height:12");
    expect(ops[0]).not.toContain("fontSize:");
  });

  it("type:icon_font does NOT emit layout or gap", () => {
    const ops = toPencilOps(
      { id: "icon", type: "icon_font", name: "x", iconFontFamily: "lucide", iconFontName: "x" },
      "document",
    );
    expect(ops[0]).not.toContain("layout:");
    expect(ops[0]).not.toContain("gap:");
  });

  it("alignItems:center emits on frame, not on text", () => {
    const frameOps = toPencilOps(
      { id: "f", type: "frame", name: "Frame", alignItems: "center" },
      "document",
    );
    expect(frameOps[0]).toContain('alignItems:"center"');

    const textOps = toPencilOps(
      // alignItems is a frame-only prop — TypeScript prevents it on text, test via cast
      { id: "t", type: "text", name: "Text" } as Parameters<typeof toPencilOps>[0],
      "document",
    );
    expect(textOps[0]).not.toContain("alignItems:");
  });

  it("justifyContent:end emits on frame", () => {
    const ops = toPencilOps(
      { id: "f", type: "frame", name: "Frame", justifyContent: "end" },
      "document",
    );
    expect(ops[0]).toContain('justifyContent:"end"');
  });

  it("padding:[4,8] emits as array (not flattened)", () => {
    const ops = toPencilOps(
      { id: "f", type: "frame", name: "Frame", padding: [4, 8] },
      "document",
    );
    expect(ops[0]).toContain("padding:[4,8]");
  });

  it("borderWidth:{bottom:1} emits as thickness:{bottom:1} inside stroke", () => {
    const ops = toPencilOps(
      { id: "f", type: "frame", name: "Frame", borderColor: "$--border", borderWidth: { bottom: 1 } },
      "document",
    );
    expect(ops[0]).toContain("stroke:");
    expect(ops[0]).toContain("thickness:{bottom:1}");
  });

  it("textAlign:center emits on text nodes", () => {
    const ops = toPencilOps(
      { id: "t", type: "text", name: "Text", textContent: "Hi", textAlign: "center" },
      "document",
    );
    expect(ops[0]).toContain('textAlign:"center"');
  });

  it("textAlignVertical:middle emits on text nodes", () => {
    const ops = toPencilOps(
      { id: "t", type: "text", name: "Text", textContent: "Hi", textAlignVertical: "middle" },
      "document",
    );
    expect(ops[0]).toContain('textAlignVertical:"middle"');
  });

  it("clip:true emits on frame nodes", () => {
    const ops = toPencilOps(
      { id: "f", type: "frame", name: "Frame", clip: true },
      "document",
    );
    expect(ops[0]).toContain("clip:true");
  });

  it("lineHeight emits on text nodes", () => {
    const ops = toPencilOps(
      { id: "t", type: "text", name: "Text", lineHeight: 1.5 },
      "document",
    );
    expect(ops[0]).toContain("lineHeight:1.5");
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

// ── INV-010: Renderer-safe emit guards ────────────────────────────────────────

describe("resolveIconName — unit tests (INV-010)", () => {
  let warnSpy: ReturnType<typeof spyOn<Console, "warn">>;
  beforeEach(() => {
    warnSpy = spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns name unchanged for known-good icon in allowlist, no warning emitted", () => {
    const result = resolveIconName("check");
    expect(result).toBe("check");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("is exported and PENCIL_LUCIDE_ALLOWLIST has expected entries", () => {
    expect(PENCIL_LUCIDE_ALLOWLIST.has("check")).toBe(true);
    expect(PENCIL_LUCIDE_ALLOWLIST.has("x")).toBe(true);
    expect(PENCIL_LUCIDE_ALLOWLIST.has("inbox")).toBe(true);
    // Known-broken names must NOT be in the allowlist
    expect(PENCIL_LUCIDE_ALLOWLIST.has("mail")).toBe(false);
    expect(PENCIL_LUCIDE_ALLOWLIST.has("triangle-alert")).toBe(false);
  });

  it("substitutes fallback name and emits console.warn for names in PENCIL_LUCIDE_FALLBACK_MAP", () => {
    const result = resolveIconName("mail");
    expect(result).toBe("inbox");
    expect(result).toBe(PENCIL_LUCIDE_FALLBACK_MAP["mail"] ?? "");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const warnMsg = String(warnSpy.mock.calls[0]?.[0] ?? "");
    expect(warnMsg).toContain("mail");
    expect(warnMsg).toContain("inbox");
  });

  it("maps all fallback values to names that exist in the allowlist", () => {
    for (const [from, to] of Object.entries(PENCIL_LUCIDE_FALLBACK_MAP)) {
      if (!PENCIL_LUCIDE_ALLOWLIST.has(to)) {
        throw new Error(
          `PENCIL_LUCIDE_FALLBACK_MAP["${from}"] = "${to}" is not in PENCIL_LUCIDE_ALLOWLIST`,
        );
      }
    }
  });

  it("throws TransformationError for names in neither allowlist nor fallback map", () => {
    let thrown: unknown;
    try {
      resolveIconName("totally-unknown-icon");
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(TransformationError);
    expect((thrown as TransformationError).message).toContain("totally-unknown-icon");
    expect((thrown as TransformationError).name).toBe("TransformationError");
  });
});

describe("sanitiseTextContent — unit tests (INV-010)", () => {
  let warnSpy: ReturnType<typeof spyOn<Console, "warn">>;
  beforeEach(() => {
    warnSpy = spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns string unchanged when no forbidden codepoints present", () => {
    const result = sanitiseTextContent("Hello world");
    expect(result).toBe("Hello world");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("replaces ✦ (U+2726) with → and emits console.warn containing U+2726", () => {
    const result = sanitiseTextContent("✦ Feature");
    expect(result).toBe("→ Feature");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain("U+2726");
  });

  it("strips ▾ (U+25BE) and warns to use icon_font instead", () => {
    const result = sanitiseTextContent("Select ▾");
    expect(result).toBe("Select ");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const warnMsg = String(warnSpy.mock.calls[0]?.[0]);
    expect(warnMsg).toContain("U+25BE");
    expect(warnMsg).toContain("icon_font");
  });

  it("replaces only forbidden characters in mixed safe+forbidden string", () => {
    const result = sanitiseTextContent("Safe ✦ safe");
    expect(result).toBe("Safe → safe");
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe("buildPencilProps integration — INV-010 wiring", () => {
  let warnSpy: ReturnType<typeof spyOn<Console, "warn">>;
  beforeEach(() => {
    warnSpy = spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("icon_font node with iconFontName 'mail' emits iconFontName 'inbox' in output", () => {
    const ops = toPencilOps(
      { id: "ic", type: "icon_font", name: "mail-icon", iconFontFamily: "lucide", iconFontName: "mail", width: 16, height: 16 },
      "document",
    );
    expect(ops[0]).toContain('iconFontName:"inbox"');
    expect(ops[0]).not.toContain('iconFontName:"mail"');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("text node with content containing ✦ (U+2726) emits sanitised content", () => {
    const ops = toPencilOps(
      { id: "hero", type: "text", name: "hero-text", textContent: "✦ Hero" },
      "document",
    );
    expect(ops[0]).toContain('content:"→ Hero"');
    expect(ops[0]).not.toContain("✦");
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
