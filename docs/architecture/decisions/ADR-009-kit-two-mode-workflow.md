# ADR-009: nib Kit Two-Mode Workflow

**Status:** Accepted
**Date:** 2026-03-02
**Deciders:** Daniel Gomes
**Evidence:** franko.pt E2E experiment (sessions A + B, 2026-03-02)

---

## Context

Empirical testing with the Franko brand (Portuguese energy/telecom comparison platform,
275 tokens, 11/11 WCAG AA pairs) revealed two distinct use cases for the nib kit:

**Experiment A — Full nib pipeline** (`nib_kit_bootstrap` → components)
- Produces 12 generic, single-variant, English-placeholder components
- Complete color/type/spacing foundations (317 ops)
- Useful for design system documentation and developer handoff
- Not useful for stakeholder review — content is entirely placeholder

**Experiment B — nib tokens + direct Pencil design**
- Brand tokens used as variables; components drawn manually via `batch_design`
- 5 button variants (primary blue, green eco CTA, ghost, destructive, disabled)
- Portuguese product copy throughout (real use cases, real user flows)
- Stakeholder-ready; requires product/brand knowledge from the agent or user

The experiments confirmed that `nib_kit_bootstrap`'s component ops are a **starting scaffold**,
not a final design output. For product flows and stakeholder review, direct Pencil design
with brand-specific copy and variant depth consistently outperforms the generic recipe.

---

## Decision

### Two-mode recommendation

#### Mode 1 — Design System Documentation (developer audience)

Use the full nib pipeline. Call `nib_kit_bootstrap` and execute its component ops as-is.
The output is a branded, shadcn/ui-aligned, token-wired component library suitable for:
- Developer handoff with token-to-component mapping
- Design system reference (every token, every component state documented)
- Starting point to copy-and-customise before adding brand-specific variants

```
nib_brand_init → nib_brand_audit → nib_brand_push → nib_kit_bootstrap
→ execute foundations ops (from .nib/kit-foundations.ops)
→ execute component ops from recipe.components[].batchDesignOps
```

#### Mode 2 — Product Flows / Stakeholder Review (PM/stakeholder audience)

Use nib for tokens only. Skip `nib_kit_bootstrap` component ops. Draw components
directly in Pencil using `batch_design` with:
- Brand-specific variants (secondary color for semantic roles, e.g. green = eco/success)
- Real product copy in the target language
- Multiple states per component
- Domain-specific content (actual product names, error messages, category labels)

```
nib_brand_init → nib_brand_audit → nib_brand_push → set_variables(ALL)
→ batch_design components manually with brand-specific copy and variants
```

### The sweet spot

Run `nib_kit_bootstrap` once to get:
1. The `pencilVariables` map (full 275-var flat map — load ALL of it via `set_variables`)
2. The foundations ops (color palette, type scale, spacing scale — saved to `.nib/kit-foundations.ops`)

Then: use foundations ops as-is, skip `components[].batchDesignOps`, design components
manually with Pencil for full variant depth and product copy.

---

## Critical invariant: always load ALL variables

When calling Pencil's `set_variables`, always pass the **complete** `pencilVariables` flat map
from `nib_brand_push`. Never pass a subset.

If any variable is missing from `set_variables`, tokens referencing it (e.g. `$--surface`,
`$--background`, `$--card`) resolve to `#000000` (black) silently. This is a Pencil behavior:
unresolved `$varname` references default to black at insertion time.

```typescript
// Correct — pass ALL variables:
pencil.set_variables({ filePath, variables: allVarsFromNibBrandPush })

// Wrong — passing a subset causes silent black fills:
pencil.set_variables({ filePath, variables: { "--primary": "#1B4FE4" } })
```

The authoritative source for the full variable map is the `variables` field returned by
`nib_brand_push`, not the kit recipe (which no longer includes `pencilVariables` in the
MCP response per INV-010).

---

## nib_kit_bootstrap limitations (accepted, by design)

These are not bugs — they are consequences of nib's token-first architecture:

| Limitation | Reason | Workaround |
|---|---|---|
| 1 variant per component | Components are defined by token slots, not product scenarios | Copy the base op, adjust fills + content for each variant |
| Generic English content | nib has no product domain knowledge | Replace text content via U() ops or design manually |
| No secondary-color semantic variants | Token system is generic; secondary = "secondary", not "eco" | Use `$color-secondary-600` explicitly in manual ops |
| 317 foundations ops in one file | Complete palette documentation requires many ops | Split across multiple `batch_design` calls by section |

---

## Alternatives Considered

### A: Expand nib_kit_bootstrap to accept a `domain` parameter for localised copy
Would require product-domain knowledge in nib — out of scope. nib is a design control plane,
not a product content generator. Rejected.

### B: Generate N variants automatically from the token system
Token system has no concept of "this secondary color means eco". Variant semantics require
product knowledge. Rejected.

### C: Make nib_kit_bootstrap produce a richer multi-variant output by default
Would increase context window usage back toward the limits addressed by INV-010. Rejected.

---

## Consequences

- Agents should default to Mode 2 (hybrid) when designing product screens or stakeholder decks
- Agents should use Mode 1 (full pipeline) when the explicit goal is a design system reference
- `nib_kit_bootstrap` tool description and `who-is-nib-for.md` should surface this distinction
- The "always load ALL variables" rule is documented here and in INV-010
