# ADR-006: Pencil Transformation Layer (NibNodeSpec)

**Status:** Accepted
**Date:** 2026-03-01
**Deciders:** Daniel Gomes

---

## Context

`kit.ts` widget builders previously emitted Pencil `batch_design` op strings as TypeScript
template literals. This caused two related bugs and created a maintainability problem:

### Bug 1: `color:` vs `fill:` on text nodes

Pencil uses `fill` for **both** frame backgrounds and text colour. There is no `color` property.
Using `color:` on a text node is silently ignored — the text renders black.

The widget builders (12 functions) correctly used `fill:"$button-text-primary"` for text nodes.
However, `buildFoundationsOps` contained **8 instances** of `color: "${headingColor}"` on text
nodes (section titles, swatch labels, typography specimens, spacing labels). These were all
invisible — black text on light backgrounds.

### Bug 2: No compile-time safety

With template literals, wrong property names produce no TypeScript error. The bug in Bug 1
was invisible until a visual inspection of the rendered `.pen` file.

### Extensibility problem

Future output targets (CSS-in-JS, Figma) would require re-implementing the same property
mappings from scratch, and each re-implementation would risk introducing the same bugs.

---

## Decision

Introduce a **transformation layer** in `src/brand/pencil-ops.ts`:

1. **`NibNodeSpec` interface** — a canonical node spec with semantic property names:
   - `backgroundColor` (not `fill`) for frame backgrounds
   - `textColor` (not `fill` or `color`) for text colour
   - `textContent` (not `content`) for text strings
   - `borderColor` / `borderWidth` / `borderAlign` (not the `stroke` object)
   - `cornerRadius: number | [number, number, number, number]` (auto-expansion)

2. **`toPencilOps(spec, parent): string[]`** — adapter that maps NibNodeSpec to Pencil
   `batch_design` op strings, enforcing all Pencil quirks in one place.

3. **`specToOps(spec, parent): string`** — convenience wrapper that joins the op array
   into a single multi-line string for use in `batchDesignOps`.

All 12 widget builders and the generic fallback were refactored to use `specToOps()`.
The `buildFoundationsOps` template-literal paths were fixed (`color:` → `fill:`) as a
direct bug fix — full NibNodeSpec refactoring of foundations is deferred (it uses dynamic
loops over variable data that don't benefit as much from the typed tree structure).

---

## Key Property Mappings (the transformation contract)

| NibNodeSpec property | Pencil property | Node type |
|---|---|---|
| `backgroundColor` | `fill` | frame |
| `borderColor` | `stroke.fill` | frame |
| `borderWidth` | `stroke.thickness` (default 1) | frame |
| `borderAlign` | `stroke.align` (default "inside") | frame |
| `cornerRadius: N` | `cornerRadius: [N,N,N,N]` | frame |
| `textContent` | `content` | text |
| `textColor` | `fill` | text ← critical: Pencil uses fill, not color |
| `layout` | `layout` | frame |
| `gap` | `gap` | frame |
| `padding` | `padding` | frame |

The serializer (`serializeValue`) produces JavaScript object literal syntax:
- String values → `"double-quoted"`
- Number/boolean values → bare
- Arrays → `[elem,...]`
- Objects → `{key:value,...}` (keys unquoted, matching Pencil's expected format)

---

## Consequences

### Good

- **Bug 1 is structurally impossible** — `textColor` always produces `fill:`, never `color:`.
  The Pencil quirk is isolated in one place, not replicated across 12+ functions.
- **Bug 2 is mitigated** — TypeScript checks property names at compile time (e.g. `textColer`
  would be a type error).
- **Extensibility** — adding a Figma adapter or CSS-in-JS output requires only a new adapter
  function targeting `NibNodeSpec`, not re-reading 12 widget builder functions.
- **Testability** — `toPencilOps` is a pure function; 28 unit tests cover all mappings in
  `src/brand/pencil-ops.test.ts`.

### Trade-offs

- **Indirection** — widget builders no longer produce their output inline; requires reading
  `pencil-ops.ts` to understand the final format.
- **Foundations not fully refactored** — `buildFoundationsOps` still uses template literals
  (with the `color:` bug fixed). Full refactoring is deferred; the function uses dynamic
  loops over variable data that are less ergonomic with a typed tree.

---

## Alternatives Considered

### A: Fix the 8 `color:` instances in-place (no abstraction)

Simple find-replace. Fast. But doesn't prevent the bug from recurring — next developer
writing a template literal could make the same mistake.

**Rejected** because the structural fix (making the wrong thing impossible) is low-cost.

### B: Use JSON.stringify for op serialization

`JSON.stringify` would produce `"fill":"$value"` (quoted keys), while Pencil's existing
integration tests assert `fill:"$value"` (unquoted keys). Updating the test regex is
possible but the existing format (matching Pencil's documented examples) is preferred.

**Rejected** in favour of the custom `serializeValue` that produces JS-literal format.

### C: Full Figma plugin output in same PR

Out of scope. The NibNodeSpec interface is designed to support this in a future PR
(add `toFigmaOps()` adapter alongside `toPencilOps()`).

---

## Files Changed

| File | Change |
|---|---|
| `src/brand/pencil-ops.ts` | New — NibNodeSpec interface + toPencilOps() + specToOps() |
| `src/brand/kit.ts` | Refactored 12 widget builders + fixed `color:` → `fill:` in foundations |
| `src/brand/pencil-ops.test.ts` | New — 28 unit tests for the transformation layer |
