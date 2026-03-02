# ADR-007: Component Visual Contracts (Variant Matrix + Visual Class + Constraints)

**Status:** Accepted
**Date:** 2026-03-01
**Deciders:** Daniel Gomes

---

## Context

During the first full E2E run of `nib_kit_bootstrap` on the Zephyr brand, the following classes of bugs were discovered in the scaffolded design system canvas:

### Bug 1: Single state per component
Every widget builder (`buildButtonOps`, `buildBadgeOps`, etc.) produces exactly one frame — the default state. A real design system requires all meaningful states shown side-by-side so designers can pick the right one without guessing. The kit had no concept of "variants" or "interaction states."

### Bug 2: Toast and Alert look identical
Both components were scaffolded with the same visual structure: light tinted background, colored border, icon circle, title, body text. They are semantically different:
- **Alert** — inline contextual message embedded in page content. Stays visible until dismissed or resolved.
- **Toast** — ephemeral overlay notification. Appears temporarily, floats above content, auto-dismisses.

Nothing in the component contract encoded this distinction. The kit builder produced the same anatomy for both.

### Bug 3: Unrendered glyphs
The close button used `✕` (U+2715, Unicode Multiply Sign). This character falls outside the Basic Latin block and is not guaranteed to render in the configured brand font (Inter). The result is a missing-glyph box (shown as `1` or `i` in some renderers). There was no constraint preventing use of unsafe Unicode in the contract.

### Bug 4: Dialog button text not centering
Dialog buttons used `layout:"horizontal"` with a fixed width and a `fill_container` text node. `textAlign:"center"` is not supported by Pencil's text node model. Without it, text always renders left-aligned inside the flex container regardless of padding. No constraint existed to encode the correct button anatomy for Pencil.

### Root cause
`nib_component_init` writes contracts that capture:
- Anatomy (slot names)
- Token bindings
- WAI-ARIA keyboard patterns

It does **not** capture:
- Visual class / behavioral category
- Variant matrix (which variants exist, what states each has)
- Visual constraints (background type, glyph safety, centering technique)
- Token resolution requirements (which tokens must resolve at scaffold time)

---

## Decision

Extend the component contract schema with four new fields:

### 1. `visualClass` — behavioral category

```json
"visualClass": "ephemeral-overlay"
```

Enum values and their enforced visual defaults:

| visualClass | Background | Width | Dismiss | Body text |
|---|---|---|---|---|
| `inline-contextual` | Semantic-tinted | fill-container | optional | required |
| `ephemeral-overlay` | White + accent-bar | fixed narrow | required | optional |
| `interactive-control` | Token-driven | fit-content | n/a | n/a |
| `structural` | Token-driven | fill-container | n/a | n/a |

The kit builder reads `visualClass` to determine the frame structure. A `Toast` with `"visualClass": "ephemeral-overlay"` gets the accent-bar structure; an `Alert` with `"visualClass": "inline-contextual"` gets the tinted card structure. They can never look the same.

### 2. `variants` — explicit variant matrix

```json
"variants": {
  "intent": ["info", "success", "warning", "error"],
  "dismissible": ["yes", "no"]
}
```

The kit builder generates a row of frames for every combination (or the primary axis, for brevity). Without this field, only the default state is scaffolded.

For controls (Button, Checkbox, Switch), the variant matrix is:

```json
"variants": {
  "style": ["primary", "secondary", "outline", "destructive"],
  "state": ["default", "disabled"]
}
```

### 3. `constraints` — visual rules enforced at scaffold time

```json
"constraints": {
  "closeGlyph": "ascii-safe",
  "textCentering": "symmetric-padding",
  "buttonWidth": "fit-content",
  "requiredTokens": ["$toast-bg", "$toast-text"]
}
```

**`closeGlyph: "ascii-safe"`** — the kit builder uses `x` (U+0078) not `✕` (U+2715).

**`textCentering: "symmetric-padding"`** — the kit builder does NOT use `textAlign:"center"` (not supported by Pencil). Instead it gives buttons `fit-content` width with equal left/right padding so text is centered by physical symmetry.

**`buttonWidth: "fit-content"`** — buttons never get a fixed pixel width. They size to their label with padding.

**`requiredTokens`** — tokens listed here are validated at `nib_brand_build` time. If any resolve to `#000000` (the Pencil fallback for unresolved tokens), a build warning is emitted and the scaffolded component is marked with a `⚠ token unresolved` annotation.

### 4. `accentBar` (ephemeral-overlay only) — left-border accent structure

```json
"accentBar": {
  "width": 4,
  "fill": "$toast-accent-{intent}"
}
```

Instructs the kit builder to render the component as:
```
[accentBar 4px | content area fill_container]
```
instead of a uniform background. This is the canonical visual differentiator between Toast and Alert.

---

## Key Property Mappings (the visual contract)

### Toast (`ephemeral-overlay`)

| Property | Value |
|---|---|
| Card fill | `#ffffff` |
| Card border | `1px solid #e2e8f0` |
| Left accent | 4px × fill_container, semantic color |
| Width | 220px fixed (floating) |
| Height | `fit_content` |
| Close button | `×` (U+00D7, ascii-safe) |
| Button centering | symmetric padding, no `textAlign` |
| Body text | optional |

### Alert (`inline-contextual`)

| Property | Value |
|---|---|
| Card fill | semantic-tinted (`#f0fdf4` etc.) |
| Card border | `1px solid semantic-color` |
| Width | `fill_container` (inline) |
| Height | `fit_content` |
| Close button | none (optional) |
| Body text | required |

---

## Consequences

### Good

- **Bug 2 is structurally impossible** — `visualClass` determines the frame structure before any props are set. Toast and Alert can never be scaffolded identically.
- **Bug 3 is caught at authoring time** — `closeGlyph: "ascii-safe"` is enforced in the kit builder's text node generation.
- **Bug 4 is encoded** — `textCentering: "symmetric-padding"` tells the builder to use `fit-content` buttons with symmetric padding. No `textAlign` is ever emitted.
- **Bug 1 is fixed systematically** — `variants` is a required field. A contract without variants cannot be used to scaffold a kit row.
- **Token failures surface early** — `requiredTokens` validation at build time, not at visual inspection time.

### Trade-offs

- **Contract schema grows** — contracts are now more verbose. Compensated by `nib_component_init` generating sensible defaults based on `widgetType`.
- **Widget builders become data-driven** — builders need to read `variants` and loop, rather than being hardcoded. This increases complexity in `kit.ts` but removes the 12-builder duplication.

---

## Alternatives Considered

### A: Keep contracts as-is, fix bugs in widget builders manually
Fast per-bug fix, but no structural prevention. Next developer (or AI agent) writing a new component hits the same bugs. **Rejected.**

### B: Encode visual class as a comment, not a contract field
No machine-readable enforcement. The kit builder cannot read comments. **Rejected.**

### C: Full Storybook-style story file per component
Out of scope. Storybook integration is tracked separately (GAP-16 in `.dof/product/gap-analysis.md`). The contract field approach is the right scope for the kit scaffold phase. **Deferred.**

---

## Pencil Implementation Notes

These bugs were discovered during the first full E2E canvas build and must be encoded in the kit builder. Any agent or developer implementing this ADR must follow these rules.

### Rule 1: `layout` is silently dropped on nested frame insert — always re-apply via `U()`

When inserting a frame with `layout:"horizontal"` as a child of another frame, Pencil sometimes does not persist the `layout` property. The frame is created without it, causing all children to be absolutely positioned (top-left).

**Pattern to use:**
```typescript
// In batchDesignOps, after inserting a container frame, explicitly update its layout:
`content=I(card, {...})\nU(content, {layout:"horizontal",gap:10,padding:10})`
```

Never rely on a single `I()` call setting layout correctly on nested frames. Always emit a follow-up `U()` for any frame that must be a flex container.

### Rule 2: `width:"fill_container"` on text requires the parent to have layout set

A text node with `width:"fill_container"` does nothing if its parent frame has no `layout`. The fill has no flex context to fill against. Apply Rule 1 first, then set `width:"fill_container"` on the text node.

### Rule 3: Card frame width must be sized to the full content chain

For fixed-width cards (Toast, Badge, Button), compute minimum width before emitting ops:

```
card_width ≥ Σ(child_widths) + Σ(gaps) + 2 × padding
```

For the 4-toast row, the container frame must be ≥ 4×toast_width + 3×gap + 2×frame_padding.
If a component row overflows the parent frame, widen the parent — not the individual component.

### Rule 4: No per-side borders in Pencil — use visual alternatives

Pencil's `stroke` applies to all 4 sides. There is no `borderBottom` or `borderLeft`. Two proven workarounds:

- **Active tab indicator** → Use background-lift: active tab gets `fill:"#ffffff"` inside a gray `fill:"#f1f5f9"` pill container. No bottom border needed.
- **Toast left accent** → Insert a 4px-wide `fill_container`-height frame as the first child of the card's `layout:"horizontal"` row.

### Rule 5: `textAlign:"center"` is not supported — use symmetric padding

Pencil text nodes ignore `textAlign`. To center button labels:
- Button frame: `layout:"horizontal"`, no fixed width (`fit_content`)
- Text node: default (no `width:"fill_container"`)
- Equal `padding` on all sides produces visual centering by physical symmetry

Never emit `textAlign` in generated ops.

### Rule 6: Unicode close glyphs outside Basic Latin fail to render

`✕` (U+2715) is not in Inter's Basic Latin block and renders as a missing-glyph box in Pencil. Use `×` (U+00D7, HTML `&times;`) which is in Latin-1 Supplement and renders reliably.

### Rule 7: Tabs use segmented control, not underline indicator

The underline active-tab pattern requires a per-side bottom border (see Rule 4). The correct Pencil implementation:
- Container: `fill:"#f1f5f9"`, `cornerRadius:8`, `padding:4`, `layout:"horizontal"`, `gap:2`
- Active tab child: `fill:"#ffffff"`, `cornerRadius:6`, `padding:10` (equal all sides)
- Inactive tab child: no fill, `padding:10`

---

## Files to Change

| File | Change |
|---|---|
| `src/types/brand.ts` | Add `ComponentContract.visualClass`, `.variants`, `.constraints` |
| `src/brand/kit.ts` | Read `variants` matrix, loop to produce state rows; read `constraints` for glyph/centering rules |
| `src/mcp/tools/kit-bootstrap.ts` | Pass `visualClass` when calling `nib_component_init` for each of the 12 standard components |
| `src/brand/build.ts` | Add `requiredTokens` validation pass — warn on `#000000` fallback |
| `src/mcp/tools/brand.ts` | Surface token resolution warnings in `nib_brand_build` response |
