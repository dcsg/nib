# INV-009: Pencil Kit Builder Patterns — Non-Negotiable Rules

**Status:** Active
**Date:** 2026-03-02
**Scope:** `src/brand/kit.ts` and any future component scaffold code that produces Pencil `batch_design` operations via `NibNodeSpec`.

---

## Purpose

These rules encode what was learned from studying the official shadcnui.pen Pencil kit.
Each rule prevents a specific class of visual bug that appeared in early kit scaffolding.
They are non-negotiable — violating them produces incorrect visual output that cannot be
detected by TypeScript or tests alone.

---

## Rules

### Rule 1: Switch thumb is `type:"ellipse"` — never `type:"frame"`

The thumb must be an `ellipse` node. ON-state track uses `justifyContent:"end"`, OFF-state
uses `justifyContent:"start"`. Absolute `x`/`y` coordinates are silently ignored inside flex
and must not be used.

**Correct:**
```typescript
{ type: "ellipse", name: "thumb", width: 20, height: 20, backgroundColor: cfg.thumbBg }
// Track: justifyContent: variant === "on" ? "end" : "start"
```

**Wrong:**
```typescript
{ type: "frame", name: "thumb", x: 24, y: 2, width: 20, height: 20 }  // x/y ignored in flex
```

---

### Rule 2: Checkbox checked state has a `type:"icon_font"` check — not an empty filled square

A checked checkbox must contain a visible check glyph inside the colored square.
The empty square-with-fill pattern does not communicate "checked" state to a viewer.

**Correct:**
```typescript
// Box children when checked:
[{ type: "icon_font", iconFontFamily: "lucide", iconFontName: "check",
   fontSize: 12, textColor: "#ffffff" }]
// Box frame: layout:"horizontal", alignItems:"center", justifyContent:"center"
```

**Wrong:**
```typescript
// Box with no children — just a filled square. Visually indistinguishable from "off".
{ type: "frame", backgroundColor: "$--primary", width: 18, height: 18 }
```

---

### Rule 3: Radio selected state has an inner `type:"ellipse"` dot — not the thick-border workaround

The inner dot must be a child `ellipse` node. Using `borderWidth:5` (thick border simulating a dot)
looks incorrect, does not scale well, and does not match the shadcnui.pen reference.

**Correct:**
```typescript
// Outer ring: borderWidth:2, layout:"horizontal", alignItems:"center", justifyContent:"center"
// Inner dot:
{ type: "ellipse", name: "dot", width: 8, height: 8, backgroundColor: "$--primary" }
```

**Wrong:**
```typescript
// ADR-007 original (now superseded) — thick-border dot workaround:
{ type: "frame", borderWidth: 5, borderColor: "$--primary", ... }
```

---

### Rule 4: Every `layout:"horizontal"` frame with mixed-height children has `alignItems:"center"`

Without `alignItems:"center"`, children top-align. Text labels misalign with their
checkbox/radio/switch controls. This must be on:
- Every checkbox/radio/switch root row
- Every badge/combobox control row
- Every toast content row
- Every alert root row
- Every dialog footer row
- Any future horizontal row containing text + control pairs

**Correct:**
```typescript
{ type: "frame", layout: "horizontal", gap: 8, alignItems: "center" }
```

**Wrong:**
```typescript
{ type: "frame", layout: "horizontal", gap: 8 }  // children top-align
```

---

### Rule 5: Icon glyphs use `type:"icon_font"` — never empty frames

Icon slots (chevrons, close buttons, check marks) must use `type:"icon_font"` with
`iconFontFamily:"lucide"` and the appropriate `iconFontName`. An empty frame is a
placeholder, not an icon.

**Correct:**
```typescript
{ type: "icon_font", iconFontFamily: "lucide", iconFontName: "chevrons-up-down",
  fontSize: 16, textColor: "$--foreground-muted" }
```

**Wrong:**
```typescript
{ type: "frame", name: "chevron", width: 16, height: 16 }  // invisible placeholder
```

---

### Rule 6: Close/dismiss glyphs use `×` (U+00D7) — not `✕` (U+2715)

`✕` (U+2715, Unicode Multiply Sign) is not in Inter's Basic Latin block and renders
as a missing-glyph box. `×` (U+00D7, Latin-1 Supplement) renders reliably.

```typescript
textContent: "\u00D7"  // × CORRECT
textContent: "\u2715"  // ✕ WRONG — may render as box
```

---

### Rule 7: Button width is fit-content — never fixed pixels

Buttons must NOT have a fixed pixel `width`. Pencil sizes them from content + padding.
Fixed-width buttons clip labels on smaller variants.

```typescript
// Correct: no width on button root
{ id: "btn", type: "frame", height: 40, padding: 12, layout: "horizontal" }

// Wrong: fixed width
{ id: "btn", type: "frame", width: 120, height: 40 }
```

---

### Rule 8: Per-side stroke is valid syntax (supersedes ADR-007 Rule 4)

`stroke:{align:"inside", fill:"$--border", thickness:{bottom:1}}` is valid Pencil syntax.
Use it for underline-only borders. See `NibNodeSpec.borderWidth` which accepts a `NibBorderSides`
object.

```typescript
// Correct — per-side via NibNodeSpec:
borderColor: "$--border", borderWidth: { bottom: 2 }

// Also correct — still needed for accent bars and segmented tabs:
// Insert a child frame for the accent, as in the Toast builder.
```

---

### Rule 9: `textAlign:"center"` works — use it on display text (supersedes ADR-007 Rule 5)

`textAlign:"center"` and `textAlignVertical:"middle"` are valid on Pencil text nodes.
The symmetric-padding technique (ADR-007 Rule 5) remains valid for buttons, but is no longer
the only option.

---

### Rule 10: `justifyContent:"space_between"` for title + action layouts

Header frames with a title on the left and a button on the right must use
`justifyContent:"space_between"`. No spacer frames.

```typescript
{ layout: "horizontal", justifyContent: "space_between", alignItems: "center",
  children: [title, actionButton] }
```

---

### Rule 11: `padding` arrays are valid for asymmetric padding

Use `[vertical, horizontal]` or `[top, right, bottom, left]` arrays for components where
vertical and horizontal padding differ. `padding:8` on a badge produces a square that is
too tall.

```typescript
// Correct:
padding: [4, 8]   // badge — 4px top/bottom, 8px left/right

// Wrong (produces too-tall badge):
padding: 8
```

---

## Enforcement

These rules are verified by:
1. TypeScript strict types on `NibNodeSpec` (catch wrong `type` values at compile time)
2. Unit tests in `src/brand/pencil-ops.test.ts` (verify correct op string output)
3. Visual verification via `get_screenshot` after `batch_design` (catch render issues)

New widget builders must be reviewed against all 11 rules before merging.
