# PRD: Phase 2 — "Your Design System Has Meaning"

**Status:** Ready for implementation
**Phase:** 2
**Milestone:** Teams can validate their system passes quality gates and read foundation docs
**Target users:** Developer-led teams using Pencil.dev or React/Tailwind + CI pipelines
**References:** roadmap.md, gap-analysis.md

---

## Problem

nib Phase 1 generates correct DTCG tokens, but teams have no way to:

1. **Verify the system is valid** — there is no schema or naming convention check, no CI integration, no `nib brand validate`
2. **Understand how to use the tokens** — `brand.md` is an AI context file, not a foundation document; no color-system.md, no grid.md, no motion.md
3. **Know the system's health** — no `nib status`, no `nib doctor`; a developer joining a project has no way to know if the environment is wired correctly
4. **Emit fully compliant DTCG** — composite types (`shadow`, `typography`, `transition`) are emitted as flat strings; `$extensions` is unused

The result: teams can generate tokens, but can't put nib in CI with confidence, can't onboard new team members, and can't explain their system to anyone.

---

## Goals

1. `nib brand validate` runs in CI and exits with code 1 on any schema, naming, or required-token violation
2. Foundation docs are generated alongside tokens and serve as the human-readable layer of the design system
3. `nib status` and `nib doctor` give any team member a clear picture of system health and environment readiness in one command
4. DTCG output is fully spec-compliant: composite types as structured objects, `$extensions.nib` on every token

### Non-goals for this phase

- Component-level validation (Phase 3)
- Drift detection or prototype reporting (Phase 4)
- Cross-version diffing (Phase 4)

---

## Success Metrics

| Metric | Target |
|--------|--------|
| `nib brand validate` exits 0 on a clean system | 100% of generated token sets |
| `nib brand validate` exits 1 on a known violation | All 5 violation categories covered |
| Foundation docs generated on `nib brand build` | All 5 docs: color, typography, spacing, grid, motion |
| `nib doctor` detects MCP misconfiguration | Catches all 3 failure modes (no config, wrong path, unreachable) |
| DTCG composite types emitted as structured objects | shadow, typography, transition, cubicBezier |

---

## User Stories

### `nib brand validate`

**As a developer** on a team using nib, I want to add `nib brand validate` to my CI pipeline so that any token change that breaks the schema, naming conventions, or required semantic tokens fails the build before it ships.

**As a design system maintainer**, I want to know immediately when a generated token file doesn't conform to DTCG so I can fix it before it causes downstream adapter failures.

### Foundation Docs

**As a developer** new to a project using nib, I want a `color-system.md` that tells me when to use `bg/subtle` vs `bg/default` so I don't have to reverse-engineer intent from variable names.

**As a designer** handing off to a developer, I want a `grid.md` that defines the layout contract in window size class terms (compact / medium / expanded) so we're speaking the same language.

**As an AI agent** operating in this codebase, I want `motion.md` to explain when and why to animate so I don't add animations that violate the brand's motion principles.

### `nib status` / `nib doctor`

**As a developer** onboarding to a new project, I want `nib doctor` to check my environment (MCP, API keys, config) and tell me exactly what's missing so I can be productive in minutes, not hours.

**As a team lead**, I want `nib status` to give me a dashboard of system health — last build, last audit, registered files, any drift warnings — at a glance.

### DTCG Compliance

**As a platform adapter author**, I want `shadow` tokens to be emitted as structured `{ offsetX, offsetY, blur, spread, color }` objects so my adapter doesn't have to parse CSS strings.

**As a design system toolchain consumer**, I want `$extensions.nib` on every token so I can query audit status, ownership, and deprecation state programmatically.

---

## Functional Requirements

### FR-1: `nib brand validate`

**Command:** `nib brand validate [--tokens-dir <path>] [--format json|text] [--fail-on all|schema|naming|required|a11y]`

**Validation checks (must all pass for exit 0):**

| Check ID | Check | Failure example |
|----------|-------|-----------------|
| V-01 | DTCG schema compliance — every token has `$type` and `$value` | Token missing `$type` |
| V-02 | Required token categories present — color, typography, spacing, radius, elevation | `spacing` group missing entirely |
| V-03 | Required semantic tokens present — `color.interactive.default`, `color.background.default`, `color.text.default`, `color.text.muted`, `color.border.default` | Semantic alias missing |
| V-04 | Naming conventions — kebab-case, dot-separated groups, no camelCase, no spaces | `color.brandPrimary` violates convention |
| V-05 | Typography scale completeness — at minimum `xs`, `sm`, `base`, `lg`, `xl`, `2xl` steps | Scale has only 3 steps |
| V-06 | Hover-only information anti-pattern — component contracts that declare a state only reachable via hover | Component contract with hover-only tooltip state |
| V-07 | Composite type structure — shadow, typography, transition tokens are objects, not strings | `shadow.sm` = `"0 1px 2px #000"` instead of structured object |

**Output format (text):**
```
✖  nib brand validate
   V-01 color.brand.500: missing $type
   V-04 color.brandPrimary: naming violation (use color.brand.primary)
   2 errors, 0 warnings

   Run with --format json for machine-readable output.
```

**Output format (JSON):**
```json
{
  "valid": false,
  "errors": [
    { "check": "V-01", "token": "color.brand.500", "message": "missing $type" }
  ],
  "warnings": []
}
```

**Exit codes:**
- `0` — all checks pass
- `1` — one or more errors
- `2` — validate command itself failed (config not found, file not parseable)

---

### FR-2: Foundation Doc Generation

Foundation docs are generated by `nib brand build` and written to `docs/design/system/foundations/`. Each doc is Markdown, written from the token data + brand context.

**FR-2.1: `color-system.md`**

Content:
- Brand color scale overview (primary, secondary, neutrals, feedback)
- Semantic token map: what each alias means (`bg/default` = page background, `bg/subtle` = slightly elevated surface, etc.)
- Usage rules table: token → when to use / when not to use
- Light/dark theme comparison for each semantic group
- WCAG contrast matrix for text/background pairings

**FR-2.2: `typography-system.md`**

Content:
- Font families and their roles (display, body, mono)
- Type scale with step values, rationale for the scale ratio
- Text style catalog: `display-lg`, `heading-md`, `body-sm`, etc. with usage
- Line height and letter spacing rules
- Do/don't usage examples (text-only, no images required)

**FR-2.3: `spacing-system.md`**

Content:
- Base unit (4px) and rationale
- Scale steps with pixel values
- Layout spacing vs component spacing distinction
- When to use `spacing.4` vs `spacing.6` for padding vs margin
- Density mode note (compact/comfortable/spacious — Phase 5)

**FR-2.4: `grid.md`**

Content:
- Window size class definitions: `compact` (<600px), `medium` (600–840px), `expanded` (>840px)
- Column count, gutter width, margin per size class
- Why window size class, not device type (Split View, floating windows, foldables)
- Layout primitives available at each size class
- Breakpoint token values and usage in CSS/Tailwind

**FR-2.5: `motion.md`**

Content:
- Motion principles for this brand (derived from brand intake + motion tokens)
- Duration scale: when to use each step (micro-interactions vs page transitions)
- Easing catalog: `ease-in`, `ease-out`, `ease-in-out`, `spring` — when each applies
- Entrance semantics: how elements enter the screen
- Feedback semantics: how the UI responds to user actions
- Reduced motion: system preference handling

**Implementation note:** Foundation docs use the generated token values + brand context from `brand.config.json`. Where brand context is sparse, docs fall back to generic best-practice guidance. AI enhancement is optional (`--no-ai` skips AI-written prose, generates structured data only).

---

### FR-3: `nib status`

**Command:** `nib status`

**Output:**
```
nib status

  Brand
  ├─ Config:     .nib/brand.config.json ✓
  ├─ Tokens:     docs/design/system/tokens/ ✓  (last built: 2026-02-28)
  ├─ Last audit: 2026-02-28  12 passed, 0 failed
  └─ Pen file:   docs/design/system/design-system.pen ✓

  Environment
  ├─ MCP:        connected (pencil@1.2.0)
  └─ API key:    set (ANTHROPIC_API_KEY)

  Warnings
  └─ none
```

**Status checks:**
- Brand config exists and is parseable
- Token output directory exists and is non-empty
- Last build timestamp (from a status file written by `nib brand build`)
- Last audit timestamp + pass/fail counts (from audit output)
- Registered .pen file exists on disk
- MCP connectivity (attempts a lightweight ping)
- Required environment variables present (not their values)

---

### FR-4: `nib doctor`

**Command:** `nib doctor`

**Checks and remediation guidance:**

| Check | Pass | Fail message + fix |
|-------|------|--------------------|
| nib version | current | "nib x.y.z — update with `npm i -g nib@latest`" |
| Brand config | found | "No .nib/brand.config.json — run `nib brand init`" |
| Token output | exists | "No tokens found — run `nib brand build`" |
| MCP config | found | "No MCP config — check .claude/settings.json or mcp.json" |
| MCP connectivity | reachable | "MCP server unreachable — is Pencil.dev running?" |
| ANTHROPIC_API_KEY | set | "Not set — AI features unavailable; use `--no-ai` to skip" |
| Node/Bun version | compatible | "Requires Node 20+ or Bun 1.0+" |

**Exit codes:**
- `0` — all checks pass
- `1` — one or more failures

---

### FR-5: DTCG Composite Types

**FR-5.1: Shadow tokens**

Before (flat string):
```json
{ "$type": "shadow", "$value": "0 1px 2px rgba(0,0,0,0.1)" }
```

After (structured composite):
```json
{
  "$type": "shadow",
  "$value": {
    "offsetX": "0px",
    "offsetY": "1px",
    "blur": "2px",
    "spread": "0px",
    "color": "rgba(0,0,0,0.1)"
  }
}
```

**FR-5.2: Typography composite tokens**
```json
{
  "$type": "typography",
  "$value": {
    "fontFamily": "{font.family.sans}",
    "fontWeight": "400",
    "fontSize": "1rem",
    "lineHeight": "1.5",
    "letterSpacing": "0"
  }
}
```

**FR-5.3: Transition composite tokens**
```json
{
  "$type": "transition",
  "$value": {
    "duration": "{motion.duration.fast}",
    "delay": "0ms",
    "timingFunction": "{motion.easing.ease-out}"
  }
}
```

**FR-5.4: cubicBezier tokens**
```json
{
  "$type": "cubicBezier",
  "$value": [0.4, 0, 0.2, 1]
}
```

---

### FR-6: `$extensions.nib` on Tokens

Every generated token gets an `$extensions.nib` block:

```json
{
  "color": {
    "interactive": {
      "default": {
        "$type": "color",
        "$value": "#3B82F6",
        "$extensions": {
          "nib": {
            "auditStatus": "pass",
            "owner": "design-systems",
            "deprecated": false,
            "migrateTo": null,
            "generatedAt": "2026-02-28T00:00:00Z"
          }
        }
      }
    }
  }
}
```

**Fields:**
- `auditStatus` — `"pass" | "fail" | "warn" | "unaudited"` — set by `nib brand audit`
- `owner` — string, set from `brand.config.json` or defaults to `"design-systems"`
- `deprecated` — boolean
- `migrateTo` — token path to migrate to, or `null`
- `generatedAt` — ISO 8601 timestamp of last `nib brand build`

---

## Technical Notes

### File locations

| Artifact | Path |
|----------|------|
| Token output | `docs/design/system/tokens/` |
| Foundation docs | `docs/design/system/foundations/` |
| Status file | `.nib/.status.json` (written by build/audit, read by status) |
| Validate config | `.nib/validate.config.json` (optional overrides) |

### `.nib/.status.json` schema

```json
{
  "lastBuild": "2026-02-28T00:00:00Z",
  "lastAudit": { "timestamp": "2026-02-28T00:00:00Z", "passed": 12, "failed": 0 },
  "lastValidate": { "timestamp": "2026-02-28T00:00:00Z", "valid": true },
  "penFile": "docs/design/system/design-system.pen",
  "tokenVersion": "0.3.1"
}
```

### Source files to create / modify

| File | Action |
|------|--------|
| `src/cli/commands/brand/validate.ts` | Create |
| `src/cli/commands/status.ts` | Create |
| `src/cli/commands/doctor.ts` | Create |
| `src/brand/validate/` | Create (schema checks, naming checks, required token checks) |
| `src/brand/foundations/` | Create (one generator per doc: color, typography, spacing, grid, motion) |
| `src/brand/tokens/` | Modify — emit composite types correctly + `$extensions.nib` |
| `src/types/brand.ts` | Modify — add `ExtensionsNib` interface, composite token value types |

---

## Open Questions

1. **Validate on build?** — Should `nib brand build` run validate automatically and warn (not fail) on violations? Or should validate always be a separate, explicit step? Recommendation: separate step; warn in build output if last validate failed.

2. **Foundation doc AI dependency** — If `ANTHROPIC_API_KEY` is not set, foundation docs fall back to structured data only (tables, token values, no prose). Is this acceptable for Phase 2, or do we require prose for the docs to be useful?

3. **`$extensions.nib.owner`** — Where does ownership come from? Options: (a) per-token in a config file, (b) per-group from `brand.config.json`, (c) always default to `"design-systems"` until Phase 3. Recommendation: (c) for Phase 2.

4. **Status file location** — `.nib/.status.json` is gitignored. Should there be a committed `nib.lock` equivalent for reproducible CI state, or is per-machine status sufficient?

---

## Done Criteria

- [ ] `nib brand validate` exits 0 on a freshly generated token set
- [ ] `nib brand validate` exits 1 on each of the 7 violation types (unit tested)
- [ ] `nib brand build` writes all 5 foundation docs to `docs/design/system/foundations/`
- [ ] `nib status` runs without error on a configured project
- [ ] `nib doctor` detects and reports all 7 environment failure modes
- [ ] Shadow, typography, transition tokens emitted as structured composite objects
- [ ] `$extensions.nib` present on all generated tokens
- [ ] `bun run typecheck` passes with no new errors
- [ ] `bun run test` passes with coverage for validate checks

---

*Created: 2026-02-28*
*References: gap-analysis.md GAP 1, GAP 3 (partial), GAP 5, GAP 9 (hover-only), GAP 10 (grid), GAP 13 (partial)*
