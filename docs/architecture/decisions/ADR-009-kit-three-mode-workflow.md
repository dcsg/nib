# ADR-009: nib Kit — Three-Mode Workflow

**Status:** Revised
**Date:** 2026-03-02 (revised 2026-03-02)
**Deciders:** Daniel Gomes
**Evidence:** franko.pt E2E experiments (sessions A, B, C — 2026-03-02)

---

## Context

Three controlled experiments with the Franko brand (Portuguese energy/telecom comparison
platform, primary `#1B4FE4`, secondary `#16a34a`, Inter font, 11/11 WCAG AA pairs) compared
the full nib pipeline against two alternative approaches for producing a component kit in Pencil.

### Experiment A — Full nib pipeline

`nib_brand_init` → `nib_brand_audit` → `nib_brand_push` → `nib_kit_bootstrap` → execute recipe ops

- **Setup calls:** ~3 (init + audit + push)
- **Design calls:** 7× `batch_design` (component ops) + 13× `batch_design` (foundations) = **20 design calls**
- **Total MCP interactions:** ~25
- **Variables loaded:** 150+ DTCG tokens (full algorithmic system)
- **Output:** 12 generic single-variant English-placeholder components + complete color/type/spacing foundations (317 ops)
- **Also produced:** `docs/design/system/build/css/variables.css`, `tailwind/preset.js`, WCAG report, `brand.md` context file

### Experiment B (original, now Mode 3) — nib tokens + product-specific Pencil design

`nib_brand_init` → `nib_brand_push` → `batch_design` with Portuguese product copy

- **Design calls:** ~8 `batch_design` calls
- **Variables loaded:** 150+ (via nib_brand_push)
- **Output:** 6 button variants with Portuguese labels, 3 energy plan comparison cards (EDP/Galp/Endesa Verde with real prices), form with NIF/email/address fields, 3 product-specific toasts in PT
- **Character:** Stakeholder-ready, product-realistic — a PM immediately understands the product

### Experiment C (new, now Mode 2) — Direct Pencil prompting, same 12 components

`nib_brand_init` → `set_variables` (18 key vars) → `batch_design` directly, no nib recipe

- **Setup calls:** 2 (init + set_variables)
- **Design calls:** **5× `batch_design`** (all 12 components across 4 batches + 1 cleanup)
- **Total MCP interactions:** ~7
- **Variables loaded:** 18 manually specified key tokens
- **Output:** Same 12 components as Experiment A — visually indistinguishable

---

## Key Finding: Direct Pencil prompting matches nib visually at 4× fewer calls

The component visual output of Experiments A and C is **identical**. Same Button variants,
same Toast/Alert with Lucide intent icons, same Switch with ellipse thumb, same Combobox
with `justifyContent:"space_between"`. An agent with knowledge of Pencil's layout API can
produce the same component kit without nib's recipe generator.

| Metric | Exp A (nib pipeline) | Exp C (direct Pencil) |
|---|---|---|
| Total design calls | ~25 | ~7 |
| Variables | 150+ DTCG tokens | 18 key vars |
| Foundations drawn | ✅ Color palette, type scale, spacing | ❌ |
| WCAG audit | ✅ 11/11 AA pre-verified | ❌ |
| CSS/Tailwind outputs | ✅ Developer-consumable | ❌ |
| brand.md context | ✅ Auto-injected into all agents | ❌ |
| Component visual quality | ✅ Identical to Exp C | ✅ Identical to Exp A |

**The component ops themselves are not where nib adds value.** nib's value is the
infrastructure surrounding them: the 150-token DTCG system, the algorithmic color scales,
the accessibility guarantee, the developer build outputs, and the brand context injection
into every AI agent in the project.

---

## Decision

### Three modes

#### Mode 1 — Design System Infrastructure (developer audience)

Use the full nib pipeline. This is the only mode that produces developer-consumable outputs.

```
nib_brand_init → nib_brand_audit → nib_brand_push
→ nib_kit_bootstrap
→ execute foundations ops (from .nib/kit-foundations.ops)   # always worth it
→ execute component ops from recipe.components[].batchDesignOps
```

**Use when:** The explicit goal is a design system reference — token documentation,
CSS/Tailwind integration, developer handoff specs, accessibility certification.

**Output:** 150+ DTCG tokens, CSS variables, Tailwind preset, 12 generic components,
color/type/spacing foundations, WCAG report, brand.md.

---

#### Mode 2 — Fast Component Kit (visual mockup, speed priority)

Skip nib's recipe entirely. Load minimal brand variables directly via `set_variables`,
then design all 12 components via `batch_design` in natural language.

```
nib_brand_init   # still run — generates brand.md and seeds CLAUDE.md context
set_variables({ "--primary": "#1B4FE4", "--secondary": "#16a34a", ... })  # ~18 vars
batch_design  # design all 12 components directly, 4–5 calls
```

**Use when:** Speed is the priority. You need to see the component kit in Pencil in
under 10 minutes and don't need developer outputs today.

**Trade-offs accepted:**
- No DTCG token depth (18 vars vs 150+) — hardcoded semantic colors for states
- No foundations (color palette/type scale not drawn)
- No CSS/Tailwind build outputs
- No WCAG pre-verification

**Visual output:** Indistinguishable from Mode 1 components.

---

#### Mode 3 — Product Flows / Stakeholder Review (PM/stakeholder audience)

Use nib for tokens only. Design directly in Pencil with product-specific copy, semantic
color variants, and real user flows.

```
nib_brand_init → nib_brand_audit → nib_brand_push → set_variables(ALL)
→ batch_design with product copy, multiple variants, real domain content
```

**Use when:** Output is for stakeholder review, user testing, or a discovery meeting.
A non-technical viewer must immediately understand the product.

**Requirements:** Agent or user must supply product domain knowledge:
- Target language (e.g. Portuguese for franko.pt)
- Semantic color roles (e.g. green = eco/sustainable, not just "secondary")
- Real copy (prices, field labels, error messages, category names)
- Domain-specific components (comparison cards, tariff chips, ERSE badges)

**Example output (Franko):** "Comparar Tarifas" primary CTA, "Energia Verde" green CTA
with leaf icon, EDP/Galp/Endesa comparison cards at real prices, NIF form fields,
Portuguese toast notifications.

---

### The sweet spot

For most agent sessions, combine Mode 1 foundations with Mode 3 components:

1. Run `nib_kit_bootstrap` for foundations only — draw the color/type/spacing reference
   from `.nib/kit-foundations.ops` (always worth the 13 calls)
2. Skip `components[].batchDesignOps`
3. Design components directly via `batch_design` with product copy and variant depth

This gives you: full token system loaded, palette documented, stakeholder-ready components.

---

## Known UX Problem: Component Ops Overhead

The 20-call overhead for Experiment A's component ops (vs 5 for Experiment C) is a real
friction point. Both produce the same visual. This gap exists because:

1. nib's recipe generates one op-set per component with explicit coordinates and
   position-fixing Update batches — necessary for a generic recipe that can't know
   the document state in advance
2. An agent designing directly knows the document state and can batch more efficiently

**Improvement target:** Reduce nib's component ops from ~20 calls to ≤8 by:
- Packing more components per `batch_design` call (currently capped at 25 ops; components
  average ~14 ops each, so 1–2 per batch)
- Eliminating separate position-fixing Update batches (pre-compute coordinates in the recipe)

This is not a blocker — Mode 2 is the workaround — but it makes Mode 1 slower than it
should be and erodes trust in the pipeline for agents optimising for speed.

---

## Critical Invariant: Always Load ALL Variables (Mode 1 + 3)

When calling Pencil's `set_variables` with nib's full token set (Modes 1 and 3), always
pass the **complete** `pencilVariables` flat map from `nib_brand_push`. Never pass a subset.

Unresolved `$varname` references default to `#000000` (black) silently at insertion time.
Loading variables after insert does NOT fix existing black fills — use `U()` to update them.

```typescript
// Correct — pass ALL variables (Mode 1 / Mode 3):
pencil.set_variables({ filePath, variables: allVarsFromNibBrandPush })

// Mode 2 only — minimal set is acceptable when no DTCG depth needed:
pencil.set_variables({ filePath, variables: { "--primary": "#1B4FE4", ... } })  // 18 vars

// Wrong in Modes 1/3 — subset causes silent black fills:
pencil.set_variables({ filePath, variables: { "--primary": "#1B4FE4" } })
```

---

## nib_kit_bootstrap Limitations (Accepted, By Design)

| Limitation | Reason | Workaround |
|---|---|---|
| 1 variant per component | Components are token-slot definitions, not product scenarios | Mode 3: design variants manually |
| Generic English content | nib has no product domain knowledge | Mode 3: provide copy directly |
| No secondary-color semantic variants | Token system is generic; semantic roles require product knowledge | Use `$color-secondary-600` explicitly |
| ~20 calls for component ops | Recipe generates ops for unknown document state; batching is conservative | Mode 2: design directly in 5 calls |

---

## Alternatives Considered

### A: Expand nib_kit_bootstrap with a `domain` parameter
Would require product-domain knowledge in nib — out of scope. Rejected.

### B: Generate N variants automatically from the token system
Variant semantics require product knowledge the token system doesn't have. Rejected.

### C: Remove nib_kit_bootstrap component ops entirely, keep foundations only
The component ops still have value as a starting scaffold for Mode 1
(developer handoff documentation). Rejected — but Mode 2 is now the recommended
default when foundations are not the goal.

### D: Make Mode 2 the documented primary path
Considered. Rejected because Mode 2 produces no developer-consumable outputs.
nib's primary value proposition is the DTCG token system + build outputs + WCAG, not
the Pencil frames. Frames are a consequence, not the product.

---

## Consequences

- **Agents default to Mode 3** when the goal is stakeholder review or product flows
- **Agents default to Mode 2** when the goal is a fast visual kit without developer outputs
- **Agents use Mode 1** only when developer handoff, WCAG certification, or CSS/Tailwind
  outputs are explicitly required
- **Foundations ops are always worth running** — the 13-call color/type/spacing reference
  is valid in all three modes
- The "always load ALL variables" rule applies to Modes 1 and 3 only
- nib_kit_bootstrap component ops overhead (~20 calls) is a known improvement target
- `who-is-nib-for.md` should be updated to surface the Mode 2 path for speed-priority users
