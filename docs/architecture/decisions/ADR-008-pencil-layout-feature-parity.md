# ADR-008: Pencil Layout Feature Parity

**Status:** Accepted
**Date:** 2026-03-02
**Deciders:** Daniel Gomes

---

## Context

After studying the official shadcnui.pen Pencil design kit (session 9), we discovered that
`NibNodeSpec` and `toPencilOps()` were missing several native Pencil layout capabilities.
The widget builders in `kit.ts` used workarounds:

- Switch thumb: `type:"frame"` with `x`/`y` coordinates (ignored by flex)
- Radio selected: thick border (`borderWidth:5`) instead of inner dot
- Checkbox checked: empty filled square without a check icon
- Badge: `padding:8` (square) instead of `[4,8]` (proper pill proportions)
- Combobox: empty `type:"frame"` placeholder instead of real icon
- All horizontal rows: missing `alignItems:"center"`, causing top-aligned children

Two ADR-007 rules were also empirically disproven:
- **Rule 4** ("No per-side borders") — FALSE: `stroke:{thickness:{bottom:1}}` works.
- **Rule 5** ("`textAlign` not supported") — FALSE: `textAlign:"center"` and `textAlignVertical:"middle"` both work.

---

## Decision

Extend `NibNodeSpec` with the full Pencil property surface, and update `toPencilOps()` to
handle all discovered properties. The complete transformation contract is documented below.

---

## Canonical Property Reference

This table defines the full `NibNodeSpec` → Pencil `batch_design` transformation after this ADR.
`toPencilOps()` is the only place these mappings live — callers never deal with Pencil quirks.

| NibNodeSpec property | Pencil batch_design | Node types | Notes |
|---|---|---|---|
| `type:"frame"` | `type:"frame"` | frame | Layout container |
| `type:"text"` | `type:"text"` | text | Text node |
| `type:"ellipse"` | `type:"ellipse"` | ellipse | Circle/oval shape; no layout/gap/padding |
| `type:"icon_font"` | `type:"icon_font"` | icon | Needs `iconFontFamily` + `iconFontName` |
| `iconFontFamily` | `iconFontFamily` | icon_font | e.g. `"lucide"` |
| `iconFontName` | `iconFontName` | icon_font | e.g. `"check"`, `"chevrons-up-down"` |
| `backgroundColor` | `fill` | frame, ellipse | Variable ref (`$--primary`) or hex |
| `borderColor` | `stroke.fill` | frame | Produces full stroke object |
| `borderWidth` (number) | `stroke.thickness` | frame | Uniform thickness |
| `borderWidth` ({bottom:N}) | `stroke.thickness:{bottom:N}` | frame | Per-side stroke (see note) |
| `borderAlign` | `stroke.align` | frame | Default: `"inside"` |
| `layout` | `layout` | frame | `"horizontal"` or `"vertical"` |
| `gap` | `gap` | frame | Flex gap in px |
| `padding` (number) | `padding` | frame | Uniform padding |
| `padding` ([v,h]) | `padding` | frame | 2-value array |
| `padding` ([t,r,b,l]) | `padding` | frame | 4-value array |
| `cornerRadius` (number) | `cornerRadius:[N,N,N,N]` | frame | Expanded to 4-tuple |
| `cornerRadius` (array) | `cornerRadius` | frame | Passed through |
| `alignItems` | `alignItems` | frame | `"center"`, `"start"`, `"end"` |
| `justifyContent` | `justifyContent` | frame | `"center"`, `"start"`, `"end"`, `"space_between"` |
| `clip` | `clip` | frame | Clips overflow to bounds |
| `textContent` | `content` | text | Text string |
| `textColor` | `fill` | text, icon_font | NOT `color:` — Pencil ignores `color:` on text |
| `fontSize` | `fontSize` | text, icon_font | Point size |
| `fontWeight` | `fontWeight` | text | e.g. `"500"`, `"600"` |
| `textAlign` | `textAlign` | text | `"center"`, `"left"`, `"right"` |
| `textAlignVertical` | `textAlignVertical` | text | `"middle"`, `"top"`, `"bottom"` |
| `lineHeight` | `lineHeight` | text | Multiplier (e.g. `1.4285714285714286`) |

**Per-side stroke note:** `borderWidth:{bottom:1}` produces `stroke:{align:"inside",fill:"...",thickness:{bottom:1}}`.
Valid side keys: `top`, `right`, `bottom`, `left`. Any combination works.

---

## Mandated Component Patterns

These patterns are required in all current and future widget builders (see also INV-009):

### Switch
```typescript
// Track: justifyContent determines thumb position
{ type: "frame", cornerRadius: [12,12,12,12], layout: "horizontal", padding: 2,
  alignItems: "center", justifyContent: "start",  // OFF: "start", ON: "end"
  children: [{ type: "ellipse", width: 20, height: 20 }] }  // ← ELLIPSE not frame
```

### Checkbox (checked)
```typescript
{ type: "frame", cornerRadius: [4,4,4,4], layout: "horizontal",
  alignItems: "center", justifyContent: "center",
  children: [{ type: "icon_font", iconFontFamily: "lucide", iconFontName: "check",
               fontSize: 12, textColor: "#ffffff" }] }
```

### Radio (selected)
```typescript
// Outer ring
{ type: "frame", cornerRadius: [9,9,9,9], layout: "horizontal",
  alignItems: "center", justifyContent: "center", borderWidth: 2,
  children: [{ type: "ellipse", width: 8, height: 8, backgroundColor: "$--primary" }] }
// ← inner ELLIPSE dot, NOT thick border
```

### Horizontal rows with mixed-height children
```typescript
{ type: "frame", layout: "horizontal", alignItems: "center", ... }
// Without alignItems:"center", children top-align, making labels misaligned with controls.
```

### Badge / pills with asymmetric padding
```typescript
{ padding: [4, 8] }  // 4px top/bottom, 8px left/right — NOT padding: 8 (square)
```

### space_between for title + action layouts
```typescript
{ layout: "horizontal", justifyContent: "space_between", alignItems: "center" }
// No spacer frames needed.
```

---

## Intent-to-Icon Mapping

Standard Lucide icon names to use for semantic intent. All builders producing intent-aware
components (Toast, Alert, Badge, Button) must reference this table.

| Intent | `iconFontName` | Notes |
|---|---|---|
| info | `"info"` | — |
| success | `"check-circle"` | — |
| warning | `"alert-triangle"` | — |
| error | `"x-circle"` | — |
| close/dismiss | `"x"` | Use `type:"icon_font"`, not `type:"text"` |
| add | `"plus"` | Button with-icon variant |
| expand/collapse | `"chevrons-up-down"` | Combobox, Select |

Icon nodes must use `type:"icon_font"`, `iconFontFamily:"lucide"`, `fontSize` matching the
surrounding text size (usually 16–24px), and `textColor` matching the semantic color token.
Never use `backgroundColor` or `cornerRadius` to create a colored circle as an icon substitute.

---

## Consequences

### Positive
- Widget builders produce visually correct output for Switch, Checkbox, Radio without workarounds.
- `NibNodeSpec` is the single source of truth — Pencil quirks never leak into caller code.
- Future builders can use `alignItems`/`justifyContent`/`textAlign` without re-discovering them.
- Per-side borders enable accurate TextInput focus-state and table row separator patterns.

### Neutral
- `NibNodeSpec` interface grows. But it is strongly typed — misuse is caught at compile time.
- `toPencilOps()` has more branches. Each branch is independently testable.

### Risks
- Pencil may change internal behavior. Since all mappings are centralized in `toPencilOps()`,
  any corrections require changes in one place only.

---

## Alternatives Considered

### A: Add Pencil properties directly to batch_design op strings in each builder
Would bypass type-checking and let Pencil quirks spread across 12+ builders. Rejected.

### B: Add a separate `PencilNodeSpec` type alongside `NibNodeSpec`
Would create two parallel type hierarchies. The existing `NibNodeSpec` → Pencil mapping
pattern already works well. Extending it is the simpler choice. Rejected.
