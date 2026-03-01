# PRD: Phase 4 — "The Loop Is Closed"

**Status:** Ready for design — implement after Phase 3 ships
**Phase:** 4
**Milestone:** Teams can detect design drift and get actionable CI reports
**Target users:** Developer-led teams with CI pipelines; design system maintainers tracking divergence between design and code
**References:** roadmap.md, gap-analysis.md
**Depends on:** Phase 3 — component contracts, component registry, component token tier

---

## Problem

The nib pipeline currently flows one way:

```
Brand → Tokens → Pencil → Prototype → ???
```

After a prototype is reviewed and iterated, there is no path back. Teams cannot answer:
- Did this `.pen` file drift from the token system?
- What % of elements in this design use real tokens vs hardcoded values?
- Which components are out of version?
- What changed between last week's token set and today's?
- Does this design have any a11y failures before it reaches code review?

The result: governance is manual, drift is invisible, and CI has no design system signal.

---

## Goals

1. `nib prototype report` produces a structured, categorized report that CI can fail on
2. `nib diff` shows token and component changes between versions in machine-readable + human form
3. `DesignDocument` carries enough metadata for CI-level a11y and drift analysis without MCP
4. A GitHub Action makes CI integration a one-file addition to any repo
5. Token deprecation is a first-class concept with migration paths

### Non-goals for this phase

- UI for browsing reports (reports are Markdown + JSON — no dashboard)
- Automatic token migration (migration paths are documented, not executed)
- Pattern or screen-level analysis (Phase 5)

---

## Success Metrics

| Metric | Target |
|--------|--------|
| `nib prototype report` exits 1 when `--fail-on` threshold is breached | 100% of configured thresholds |
| Report correctly identifies hardcoded color values (not token references) | ≥ 95% detection rate on test fixtures |
| `nib diff` produces valid JSON output for any two token set versions | 100% |
| GitHub Action runs full pipeline on PR in < 30 seconds | p95 |
| `DesignDocument` enrichment is backwards-compatible | All existing `.design.json` files parse without error |

---

## User Stories

### Prototype Report

**As a developer** on a CI pipeline, I want `nib prototype report my-design.json` to exit with code 1 when token drift is detected so the build fails before drifted designs reach code review.

**As a design system maintainer**, I want the report to categorize findings by type (token, component, a11y) so I can triage which team owns the fix.

**As an accessibility engineer**, I want the report to flag nodes missing `aria-label` or `role` so a11y issues are caught at the design stage, not post-implementation.

### Diff

**As a developer** merging a token update, I want `nib diff v1.json v2.json` to show exactly which token values changed so I can assess the blast radius before shipping.

**As a design system maintainer**, I want a human-readable Markdown diff I can paste into a PR description so reviewers understand what changed.

### DesignDocument Enrichment

**As a CI pipeline**, I want the `.design.json` to include `meta.designSystem` at capture time so I can detect version mismatches between the prototype and the current design system without running MCP.

**As a report consumer**, I want each node to carry `a11y.role` and `a11y.name` so the report can surface missing labels without access to the original `.pen` file.

### Deprecation

**As a developer** consuming a deprecated token, I want `nib brand build` to warn me about deprecated tokens and tell me what to migrate to so I'm not caught off guard when they're removed.

---

## Functional Requirements

### FR-1: `DesignDocument` Enrichment

New fields added to the `DesignDocument` schema. All fields are optional for backwards compatibility — existing `.design.json` files continue to parse.

**`meta` additions:**
```json
{
  "meta": {
    "capturedAt": "2026-02-28T00:00:00Z",
    "designSystem": {
      "tokenSet": "tokens@0.3.1",
      "componentLib": "ui@0.2.0",
      "nibVersion": "1.4.0"
    }
  }
}
```

**Per-node `a11y` field:**
```json
{
  "id": "node-abc",
  "type": "frame",
  "a11y": {
    "role": "dialog",
    "name": "Confirm deletion",
    "inputPurpose": null
  }
}
```

**Per-node `component` field:**
```json
{
  "id": "node-abc",
  "component": {
    "name": "Button",
    "variant": "primary",
    "version": "0.2.0"
  }
}
```

**Per-node `interactions` field:**
```json
{
  "id": "node-abc",
  "interactions": [
    { "trigger": { "event": "click" }, "action": { "type": "navigate", "toNodeId": "node-xyz" } }
  ]
}
```

**Source:** These fields are populated during `nib capture` from Pencil.dev MCP data when available. Nodes without MCP metadata omit the fields — they do not default to null.

---

### FR-2: `nib prototype report`

**Command:** `nib prototype report <design-json> [--format json|md] [--fail-on drift|a11y|contrast] [--threshold <n>]`

**Report structure (JSON):**
```json
{
  "summary": {
    "totalNodes": 142,
    "tokenCoverage": 0.87,
    "componentCoverage": 0.74,
    "a11yScore": 0.91,
    "passed": false
  },
  "tokenFindings": [
    {
      "nodeId": "node-abc",
      "nodeName": "Primary CTA",
      "type": "hardcoded-color",
      "value": "#3B82F6",
      "suggestion": "color.interactive.default",
      "severity": "error"
    }
  ],
  "componentFindings": [
    {
      "nodeId": "node-def",
      "nodeName": "Submit Button",
      "type": "version-mismatch",
      "capturedVersion": "0.2.0",
      "currentVersion": "0.3.1",
      "severity": "warning"
    }
  ],
  "a11yFindings": [
    {
      "nodeId": "node-ghi",
      "nodeName": "Close icon",
      "type": "missing-label",
      "message": "Interactive node has no accessible name",
      "severity": "error"
    }
  ]
}
```

**Severity levels:** `error` (fails with `--fail-on`) | `warning` (reported, no fail) | `info`

**Finding types:**

| Category | Type | Description |
|----------|------|-------------|
| token | `hardcoded-color` | Color value not referencing a token |
| token | `hardcoded-spacing` | Spacing value not referencing a token |
| token | `deprecated-token` | Node uses a token marked `$extensions.nib.deprecated: true` |
| token | `unknown-token` | Token reference not found in current token set |
| component | `version-mismatch` | Component version at capture differs from registry version |
| component | `unregistered-component` | Component name not in registry |
| a11y | `missing-label` | Interactive node has no `a11y.name` |
| a11y | `missing-role` | Interactive node has no `a11y.role` |
| a11y | `focus-trap-missing` | Dialog/modal node has no focus trap declared |

**Markdown output** (for PR comments / human reading):
```markdown
## nib prototype report

**Token coverage:** 87% · **Component coverage:** 74% · **A11y score:** 91%
**Status:** ❌ Failed (3 errors, 2 warnings)

### Token Findings (2 errors)
| Node | Issue | Suggestion |
|------|-------|-----------|
| Primary CTA | Hardcoded color `#3B82F6` | Use `color.interactive.default` |
| Card surface | Hardcoded color `#F9FAFB` | Use `color.background.subtle` |

### A11y Findings (1 error)
| Node | Issue |
|------|-------|
| Close icon | Missing accessible name |
```

**Exit codes:**
- `0` — no errors (or `--fail-on` threshold not breached)
- `1` — errors found above threshold
- `2` — command failed (file not found, parse error)

---

### FR-3: `nib diff`

**Command:** `nib diff <tokens-v1.json> <tokens-v2.json> [--format json|md]`

**JSON output:**
```json
{
  "summary": { "added": 3, "removed": 1, "changed": 7, "deprecated": 2 },
  "added": [
    { "path": "color.brand.950", "$type": "color", "$value": "#0A0F1E" }
  ],
  "removed": [
    { "path": "color.brand.50", "lastValue": "#EFF6FF" }
  ],
  "changed": [
    { "path": "color.interactive.default", "from": "#3B82F6", "to": "#2563EB" }
  ],
  "deprecated": [
    { "path": "color.brand.primary", "migrateTo": "color.interactive.default" }
  ]
}
```

**Markdown output:**
```markdown
## Token Diff

**3 added · 1 removed · 7 changed · 2 deprecated**

### Changed
| Token | Before | After |
|-------|--------|-------|
| `color.interactive.default` | `#3B82F6` | `#2563EB` |

### Deprecated
| Token | Migrate to |
|-------|-----------|
| `color.brand.primary` | `color.interactive.default` |
```

---

### FR-4: Token Deprecation

Tokens are deprecated via `$extensions.nib.deprecated` in the token source. `nib brand build` enforces:

1. Deprecated tokens are still emitted (removal is a separate explicit action)
2. `nib brand build` prints a warning listing all deprecated tokens and their `migrateTo` paths
3. `nib prototype report` surfaces `deprecated-token` findings as warnings
4. `nib diff` includes a `deprecated` section

**Setting a token as deprecated** (in token source or override config):
```json
{
  "color": {
    "brand": {
      "primary": {
        "$type": "color",
        "$value": "{color.interactive.default}",
        "$extensions": {
          "nib": {
            "deprecated": true,
            "migrateTo": "color.interactive.default",
            "deprecatedSince": "0.4.0"
          }
        }
      }
    }
  }
}
```

---

### FR-5: GitHub Action

**Usage (`.github/workflows/design-system.yml`):**
```yaml
- uses: nibjs/nib-action@v1
  with:
    command: prototype-report
    design-json: path/to/design.json
    fail-on: drift,a11y
    format: md
    post-comment: true   # posts Markdown report as PR comment
```

**Action behavior:**
- Runs `nib prototype report` with configured flags
- On failure: exits non-zero (fails the check)
- When `post-comment: true`: posts Markdown report as a PR comment using `GITHUB_TOKEN`
- Caches nib install between runs

**Supported commands in action:** `prototype-report`, `diff`, `brand-validate`

---

## Technical Notes

### Source files to create / modify

| File | Action |
|------|--------|
| `src/types/design.ts` | Modify — add `a11y`, `component`, `interactions` node fields; `meta.designSystem` |
| `src/capture/normalizer.ts` | Modify — populate new fields from MCP data during capture |
| `src/cli/commands/prototype/report.ts` | Create |
| `src/cli/commands/diff.ts` | Create |
| `src/report/` | Create — finding detectors, report formatter, MD renderer |
| `src/brand/tokens/` | Modify — emit deprecation warnings during build |
| `.github/action/` | Create — GitHub Action entrypoint + action.yml |
| `src/types/report.ts` | Create — `PrototypeReport`, `Finding`, `DiffResult` interfaces |

### Backwards compatibility

`DesignDocument` enrichment fields are all optional. The `capture` command populates them when MCP data is available; `report` skips findings that require fields not present in the file.

---

## Open Questions

1. **Token coverage calculation** — What counts as "covered"? Options: (a) any token reference = covered, (b) only tokens in the current token set = covered, (c) only non-deprecated tokens = covered. Recommendation: (b).

2. **Hardcoded value detection** — How do we distinguish a hardcoded `#3B82F6` that happens to equal `color.interactive.default` from an actual token reference? Should we suggest the matching token even for hardcoded values? Recommendation: yes — include suggestion when an exact match exists.

3. **Action authentication** — The `post-comment` feature requires `GITHUB_TOKEN`. Should this be opt-in (default: false) or opt-out? Recommendation: opt-in, default false.

4. **`nib diff` input format** — Should `diff` accept two token JSON files, or two nib version tags (e.g., `nib diff 0.3.0 0.4.0`) that resolve from a local version history? Recommendation: file paths only in Phase 4; version tags are a Phase 4+ extension.

---

## Done Criteria

- [ ] `nib prototype report design.json --fail-on drift` exits 1 when hardcoded values are found
- [ ] Report output includes `tokenFindings`, `componentFindings`, `a11yFindings` sections
- [ ] `nib diff v1.json v2.json` produces valid JSON and Markdown output
- [ ] `DesignDocument` schema additions are backwards-compatible (all existing fixtures parse)
- [ ] `nib capture` populates `meta.designSystem`, `a11y`, `component` fields when MCP data available
- [ ] Deprecated tokens trigger warning on `nib brand build`
- [ ] GitHub Action runs `nib prototype report` and posts a PR comment
- [ ] `bun run typecheck` passes with no new errors
- [ ] `bun run test` passes with fixture-based coverage for report + diff

---

*Created: 2026-02-28*
*References: gap-analysis.md GAP 4, GAP 11, GAP 3 (complete), GAP 13 (complete)*
