# PRD: Phase 5 — "Patterns and Templates"

**Status:** Ready for design — implement after Phase 4 ships
**Phase:** 5
**Milestone:** Teams can scaffold complete screens from pre-built patterns
**Target users:** Developer-led and designer-led teams building product UIs; teams moving from "we have a component library" to "we can ship screens"
**References:** [../roadmap.md](../roadmap.md#phase-5--patterns-and-templates), [../gap-analysis.md](../gap-analysis.md)
**Depends on:** Phase 3 — component contracts and registry; Phase 2 — window size class grid primitives

---

## Problem

Teams completing Phase 3 have a validated token system and component contracts. The next question is always: "how do I assemble these into a real screen?"

Currently:
1. **No layout primitives** — breakpoints are device-type pixel widths, not capability-based window size classes. An iPad in Split View behaves like a compact phone — the current model breaks.
2. **No patterns** — auth flows, forms, list-detail layouts, settings screens must be built from scratch every time. Every team reinvents the same 6 screens.
3. **No templates** — there is no `nib template auth` that produces a `.pen` starter + code scaffold for a complete flow.
4. **Reflow is untested** — WCAG 2.2 requires content to reflow at 320px without 2D scrolling. There is no enforcement mechanism.

The result: nib delivers a component library but teams still spend weeks assembling standard screens.

---

## Goals

1. Window size class layout system replaces device-type breakpoints as the canonical layout primitive
2. `nib template <name>` scaffolds a complete screen or flow — `.pen` starter + code scaffold — in one command
3. All templates pass WCAG reflow at 320px and have correct responsive behavior baked in
4. Canonical multi-pane layout patterns (list-detail, master-detail-supporting) are first-class

### Non-goals for this phase

- Custom pattern authoring (teams consume pre-built patterns — custom authoring is future scope)
- Animation or transition behavior in templates (motion contracts exist but are not wired to templates yet)
- Server-side rendering or framework-specific code generation beyond React + HTML

---

## Success Metrics

| Metric | Target |
|--------|--------|
| `nib template auth` completes and produces valid output | 100% |
| All templates pass WCAG reflow at 320px (no 2D scroll) | 100% of built-in templates |
| Window size class tokens are emitted by `nib brand build` | `compact`, `medium`, `expanded` breakpoints in all token outputs |
| `nib brand validate --template` detects reflow violations | Catches all 3 violation patterns in test fixtures |
| Templates reference component registry — no phantom components | 100% of template components exist in registry |

---

## User Stories

### Window Size Classes

**As a developer** building a responsive layout, I want `compact`, `medium`, and `expanded` as first-class Tailwind/CSS tokens so I write breakpoints against capability, not device assumptions.

**As a designer** using Pencil.dev, I want window size class artboards in my `.pen` starter so I design to the right layout constraints from the first frame.

### Templates

**As a developer** starting an auth flow, I want `nib template auth` to scaffold a complete sign-in, sign-up, and forgot-password flow — `.pen` file and HTML/React code — so I don't spend a day building boilerplate screens.

**As a designer**, I want the scaffolded `.pen` file to already use my brand tokens and the right window size class artboards so I can start designing immediately without setup.

**As an accessibility engineer**, I want template forms to have correct label associations, error announcements, and no CAPTCHA-only authentication by default so a11y is never an afterthought.

### Patterns

**As a developer** building a list-detail view, I want the canonical `list-detail` pattern to handle the compact (stacked) and expanded (side-by-side) cases correctly so I don't have to figure out the responsive behavior from scratch.

### Reflow Validation

**As a CI pipeline**, I want `nib brand validate --template` to fail if a template doesn't reflow at 320px so WCAG 2.2 reflow compliance is enforced automatically.

---

## Functional Requirements

### FR-1: Window Size Class Layout System

**Replaces:** device-type breakpoints (`phone`, `tablet`, `desktop`)
**New primitive:** `compact | medium | expanded`

**Token additions to `nib brand build` output:**

```json
{
  "layout": {
    "breakpoint": {
      "compact-max": { "$type": "dimension", "$value": "599px" },
      "medium-min": { "$type": "dimension", "$value": "600px" },
      "medium-max": { "$type": "dimension", "$value": "839px" },
      "expanded-min": { "$type": "dimension", "$value": "840px" }
    },
    "compact": {
      "columns": { "$type": "number", "$value": 4 },
      "gutter": { "$type": "dimension", "$value": "16px" },
      "margin": { "$type": "dimension", "$value": "16px" }
    },
    "medium": {
      "columns": { "$type": "number", "$value": 8 },
      "gutter": { "$type": "dimension", "$value": "24px" },
      "margin": { "$type": "dimension", "$value": "24px" }
    },
    "expanded": {
      "columns": { "$type": "number", "$value": 12 },
      "gutter": { "$type": "dimension", "$value": "24px" },
      "margin": { "$type": "dimension", "$value": "32px" }
    }
  }
}
```

**Tailwind config additions (in `nib brand build` Tailwind preset):**
```js
screens: {
  'medium': '600px',
  'expanded': '840px',
}
```

**Why these values:**
- `compact` < 600px: single pane, stacked layout. Applies to: phones in portrait, narrow floating windows, iPad in Split View at minimum size.
- `medium` 600–839px: transitional, two-column or emerging side-by-side. Applies to: phones in landscape, iPad in Split View at medium size, small tablets.
- `expanded` ≥ 840px: multi-pane, sidebar, split view. Applies to: full-width tablets, desktop, iPad full-screen.

---

### FR-2: Canonical Multi-Pane Layout Patterns

**Pattern: `list-detail`**
- `compact`: list fills screen. Tapping a row pushes detail view (full-screen).
- `medium`: list at ~40% width, detail at ~60%. Both visible simultaneously.
- `expanded`: list at fixed ~320px width, detail fills remaining space.
- Empty state in detail pane when no item selected (expanded only).

**Pattern: `master-detail-supporting`**
- Extends `list-detail` with a third pane (inspector, filters, metadata).
- Third pane only appears at `expanded`.
- On `medium`: third pane becomes a slide-over sheet.
- On `compact`: third pane is a separate screen or bottom sheet.

**Pattern: `feed`**
- `compact`: single column.
- `medium`: 2-column grid.
- `expanded`: 3-column grid or 2-column with wider cards.

These patterns are available as:
1. `.pen` artboard templates (multi-canvas, one per size class)
2. HTML/CSS code scaffolds
3. React component scaffolds (layout wrappers only — no data fetching)

---

### FR-3: `nib template <name>`

**Command:** `nib template <name> [--output <dir>] [--format pen|html|react|all]`

**Available templates:**

| Name | Description | Screens |
|------|-------------|---------|
| `auth` | Authentication flow | sign-in, sign-up, forgot-password, MFA |
| `form` | Form with validation | single-page form, multi-step form, inline errors |
| `list-detail` | List → detail navigation | list, detail, empty state |
| `settings` | Settings screen | grouped settings, section headers, toggles |
| `empty-states` | Empty/error/loading states | empty list, error page, loading skeleton |
| `onboarding` | New user onboarding | welcome, steps, completion |

**Output per template:**
```
nib template auth --output src/screens

✓  nib template auth

   Generated:
   ├─ src/screens/auth/
   │  ├─ auth.pen          (Pencil.dev starter — 3 canvases: compact / medium / expanded)
   │  ├─ SignIn.html
   │  ├─ SignUp.html
   │  ├─ ForgotPassword.html
   │  └─ README.md         (component usage notes + a11y checklist)

   Brand tokens applied: ✓
   Window size classes: compact / medium / expanded
   A11y: WCAG 2.2 reflow pass ✓ · accessible auth ✓ · label associations ✓

   Next: open auth.pen in Pencil.dev to customize
```

**Brand token application:** Templates read `brand.config.json` and apply current token values at generation time. Color, typography, spacing, and radius tokens are substituted into the output.

---

### FR-4: Template A11y Requirements

Every template must meet these requirements before shipping:

| Requirement | Standard | Verification |
|-------------|----------|-------------|
| WCAG reflow at 320px — no 2D scrolling | WCAG 2.2 SC 1.4.10 | Automated (see FR-5) |
| All form inputs have visible labels | WCAG 2.1 SC 1.3.1 | Template review |
| Error messages are associated with inputs (`aria-describedby`) | WCAG 2.1 SC 3.3.1 | Template review |
| No CAPTCHA-only authentication | WCAG 2.1 SC 1.1.1 / accessible auth | Template review |
| Focus is never obscured by sticky headers | WCAG 2.2 SC 2.4.12 | Template review |
| Touch targets meet minimum size | WCAG 2.2 SC 2.5.8 (24px min) | Template review |
| Reduced motion respected | WCAG 2.1 SC 2.3.3 | Template review |

---

### FR-5: WCAG Reflow Validation

**Added to `nib brand validate`:**

```
nib brand validate --template <html-file>
```

Checks whether the HTML file renders without 2D scrolling at 320px viewport width.

**Validation approach:** Headless browser (Playwright) renders the file at 320px width and checks for horizontal scrollbar presence or overflow beyond viewport bounds.

**Check ID:** V-12 — `reflow-320px`

**Failure message:**
```
✖  V-12  SignIn.html: horizontal overflow at 320px viewport
         Element .auth-card overflows by 48px
         Fix: ensure max-width is 100% and no fixed widths below expanded breakpoint
```

**Exit behavior:** Same as other validate checks — exits 1 on error.

---

### FR-6: `nib templates` (list command update)

The existing `nib templates` command is updated to list built-in templates with descriptions and available formats:

```
nib templates

Available templates:

  auth           Authentication flow (sign-in, sign-up, forgot-password, MFA)
  form           Form with validation (single-page, multi-step)
  list-detail    List → detail navigation with empty state
  settings       Settings screen with grouped sections
  empty-states   Empty, error, and loading state screens
  onboarding     New user onboarding flow

Usage: nib template <name> [--output <dir>] [--format pen|html|react|all]
```

---

## Technical Notes

### Source files to create / modify

| File | Action |
|------|--------|
| `src/brand/tokens/layout.ts` | Create — window size class token generator |
| `src/templates/patterns/` | Create — layout pattern code (list-detail, master-detail-supporting, feed) |
| `src/templates/screens/` | Create — one directory per template (auth, form, list-detail, settings, empty-states, onboarding) |
| `src/cli/commands/template.ts` | Modify — wire `nib template <name>` to new screen templates |
| `src/brand/validate/reflow.ts` | Create — V-12 reflow check via Playwright |
| `src/brand/build.ts` | Modify — include layout tokens in build output |

### Playwright dependency

The reflow check (FR-5) requires Playwright as a dev/optional dependency. It should not be required for `nib brand build` or `nib brand validate` without `--template`. Add as an optional peer dependency with a clear install prompt if not found.

### `.pen` starter generation

Template `.pen` files are generated using the Pencil MCP `batch_design` operations, not shipped as binary blobs. This means templates are brand-aware at generation time and don't require manual token substitution.

---

## Open Questions

1. **React scaffold scope** — Should React scaffolds include state management (form state, navigation state) or be layout/markup only? Recommendation: layout/markup only; logic is out of scope.

2. **Custom templates** — Should Phase 5 support `nib template add` for team-authored templates? Recommendation: no — built-ins only; custom template authoring is future scope.

3. **`.pen` generation vs static files** — Generating `.pen` files via MCP requires an active Pencil connection. Should templates fall back to static `.pen` binary blobs when MCP is unavailable? Recommendation: yes — ship static fallback `.pen` files as build assets; MCP generation applies brand tokens on top.

4. **Reflow check performance** — Playwright adds cold-start overhead. Should reflow validation be a separate `nib validate:templates` subcommand, or integrated into `nib brand validate --template`? Recommendation: flag-gated on `nib brand validate` — `--template` opt-in.

---

## Done Criteria

- [ ] `nib brand build` emits `layout` window size class tokens (compact/medium/expanded) in DTCG, CSS, and Tailwind formats
- [ ] `nib template auth` generates `.pen`, HTML, and README outputs
- [ ] All 6 built-in templates are implemented and pass a11y checklist
- [ ] All 6 templates pass WCAG reflow at 320px
- [ ] `nib brand validate --template <file>` runs V-12 reflow check
- [ ] `nib templates` lists all 6 built-in templates with descriptions
- [ ] Templates read and apply `brand.config.json` tokens at generation time
- [ ] `bun run typecheck` passes with no new errors
- [ ] `bun run test` passes with fixture-based coverage for layout tokens + reflow check

---

*Created: 2026-02-28*
*References: gap-analysis.md GAP 7 (complete), GAP 8, GAP 10 (complete)*
