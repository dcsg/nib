# PRD: Phase 6 — "Everyone Can Use It"

**Status:** Planned — implement after Phase 5 ships
**Phase:** 6
**Milestone:** Figma-first teams and other tool ecosystems can adopt nib without switching tools
**Target users:** Designer-led teams using Figma + Tokens Studio; organizations migrating from Figma to Pencil.dev
**References:** roadmap.md, gap-analysis.md
**Depends on:** Phase 2 — DTCG compliance; Phase 4 — DesignDocument schema

---

## Problem

Tokens Studio (formerly Figma Tokens) is the most widely used token management plugin for Figma teams. The majority of designer-led organizations already have a `tokens.json` file. Without format interop, these teams face a friction wall on day one of adopting nib:

- Their token file is in Tokens Studio legacy format — nib can't import it
- They can't export nib tokens back to Figma — Tokens Studio expects its own format
- Figma designs can't enter the nib prototype pipeline — there is no `nib figma capture`

The result: nib's adoption is gated to Pencil.dev-first teams, excluding the majority of designer-led organizations.

---

## Goals

1. A Figma-first team can import their Tokens Studio file and get a fully validated nib design system in one command
2. nib tokens can be pushed back to Figma via Tokens Studio export
3. Figma frames can enter the nib prototype pipeline via `nib figma capture`
4. Figma variables can be synced bidirectionally with nib tokens

### Non-goals for this phase

- Native mobile platform adapters (Phase 7)
- Penpot or other design tool interop (future scope)
- Real-time sync / watch mode (file-based import/export only)

---

## Success Metrics

| Metric | Target |
|--------|--------|
| `nib brand init --from tokens.json` succeeds on a Tokens Studio legacy file | 100% of files conforming to Tokens Studio v1 format |
| Round-trip: nib → Tokens Studio export → re-import → nib produces identical tokens | ≤ 2% token value drift (precision losses only) |
| `nib figma capture` produces a valid `DesignDocument` | Passes existing `nib build` pipeline without modification |
| Figma variable sync: all color + typography variables synced | 100% coverage for supported variable types |

---

## User Stories

### Tokens Studio Import

**As a designer** at a Figma-first team, I want to run `nib brand init --from tokens.json` with my existing Tokens Studio file so I can adopt nib without losing my existing token work.

**As a developer** migrating from a Figma-based workflow, I want the import to produce a fully validated nib system (DTCG, naming conventions, semantic tokens) so I know the imported system is clean.

### Tokens Studio Export

**As a design system maintainer**, I want `nib brand export --format tokens-studio` to produce a file I can load directly into the Tokens Studio Figma plugin so changes I make in nib flow back into Figma.

### Figma Capture

**As a developer** at a Figma-first team, I want `nib figma capture <figma-url>` to produce a `.design.json` from my Figma frames so I can run `nib build` and get an HTML prototype without switching to Pencil.dev.

### Variable Sync

**As a designer**, I want `nib figma pull` to import Figma variables as nib tokens so my Figma source of truth flows into the nib token system. I want `nib figma push` to do the reverse so nib changes appear in Figma.

---

## Functional Requirements

### FR-1: Tokens Studio Import

**Command:** `nib brand init --from <tokens.json> [--format tokens-studio|dtcg|auto]`

**Supported input formats:**
- Tokens Studio legacy (v1): `{ "global": { "color": { "brand": { "value": "#3B82F6", "type": "color" } } } }`
- Tokens Studio DTCG mode: `{ "color": { "brand": { "$value": "#3B82F6", "$type": "color" } } }`
- Auto-detect: infer format from file structure

**Conversion rules (legacy → DTCG):**

| Tokens Studio legacy | DTCG output |
|---------------------|-------------|
| `"value"` | `"$value"` |
| `"type"` | `"$type"` |
| `"description"` | `"$description"` |
| `{color.brand.500}` (curly brace ref) | `{color.brand.500}` (preserved as-is — DTCG compatible) |
| `"boxShadow"` type | `"shadow"` composite type |
| `"typography"` type | `"typography"` composite type |
| Token sets (multiple files) | Merged into single DTCG file, set name used as token group prefix |

**Post-import:** Runs `nib brand validate` and reports any naming or schema issues introduced by the import. Does not fail on warnings — produces a report and continues.

**Output:**
```
✓  nib brand init --from tokens.json

   Imported: 247 tokens from 3 token sets (global, dark, brand)
   Converted: Tokens Studio legacy → DTCG

   Validation:
   ├─ Schema: ✓ (247/247 tokens valid)
   ├─ Naming: ⚠  14 tokens use camelCase (auto-converted to kebab-case)
   └─ Required tokens: ⚠  color.interactive.default not found — add manually or run nib brand build

   Output: docs/design/system/tokens/
   Next: run nib brand build to generate CSS/Tailwind outputs
```

---

### FR-2: Tokens Studio Export

**Command:** `nib brand export --format tokens-studio [--output <path>]`

**Conversion rules (DTCG → Tokens Studio legacy):**

| DTCG | Tokens Studio legacy |
|------|---------------------|
| `"$value"` | `"value"` |
| `"$type"` | `"type"` |
| `"$description"` | `"description"` |
| `"shadow"` composite | `"boxShadow"` with Tokens Studio structure |
| `"typography"` composite | `"typography"` with Tokens Studio structure |
| `$extensions.nib.deprecated: true` | `"$extensions": { "studio.tokens": { "modify": null } }` (no Tokens Studio equivalent — included as-is with warning) |

**Output file:** Single `tokens.studio.json` or split by token group (configurable).

---

### FR-3: `nib figma capture`

**Command:** `nib figma capture <figma-url-or-file-key> [--node-id <id>] [--output <path>]`

**Authentication:** Reads `FIGMA_ACCESS_TOKEN` environment variable.

**Behavior:**
1. Fetches Figma file via Figma REST API
2. Traverses the frame tree starting at `--node-id` (or document root)
3. Resolves component references inline (same normalization as Pencil capture)
4. Produces a `DesignDocument` JSON identical in schema to `.pen` capture output
5. Writes to `<output>/<figma-file-name>.design.json`

**Supported Figma node types → DesignDocument mapping:**

| Figma type | DesignDocument type |
|------------|---------------------|
| FRAME / COMPONENT | `frame` |
| TEXT | `text` |
| RECTANGLE / ELLIPSE | `shape` |
| GROUP | `group` |
| VECTOR / BOOLEAN_OPERATION | `vector` |
| INSTANCE | Resolved inline to component definition |

**Variable resolution:** Figma variables (bound via `boundVariables`) are resolved to their current mode values and annotated with the variable name for token matching.

**Output:**
```
✓  nib figma capture

   File:    My App — v3 (figma.com/design/abc123)
   Frames:  14 captured (compact / expanded variants)
   Tokens:  83 variable bindings detected
   Output:  my-app-v3.design.json

   Next: run nib build my-app-v3.design.json to generate HTML prototype
```

---

### FR-4: `nib figma pull` / `nib figma push`

**Pull command:** `nib figma pull <figma-file-key> [--mode light|dark|all]`

Reads Figma local variables and converts to nib DTCG tokens.

- Color variables → `color.*` tokens
- Number variables → `spacing.*` or `radius.*` tokens (heuristic by name)
- String variables → `font.family.*` or `motion.*` tokens (heuristic by name)
- Variable modes → light/dark theme sets

**Push command:** `nib figma push <figma-file-key>`

Writes current nib token values back to Figma as local variables.

- Creates variables if they don't exist
- Updates values for existing variables matched by name
- Does not delete existing Figma variables not present in nib (non-destructive)
- Reports mismatches for manual review

**Authentication:** Both commands require `FIGMA_ACCESS_TOKEN`. Push requires a token with write scope.

---

## Technical Notes

### Source files to create / modify

| File | Action |
|------|--------|
| `src/brand/intake/tokens-studio.ts` | Create — Tokens Studio → DTCG converter |
| `src/brand/export/tokens-studio.ts` | Create — DTCG → Tokens Studio converter |
| `src/cli/commands/brand/export.ts` | Create |
| `src/capture/figma/` | Create — Figma API client, frame traversal, DesignDocument mapper |
| `src/cli/commands/figma/capture.ts` | Create |
| `src/cli/commands/figma/pull.ts` | Create |
| `src/cli/commands/figma/push.ts` | Create |
| `src/brand/intake/index.ts` | Modify — wire `--from` flag to tokens-studio importer |

### Figma API dependency

`nib figma capture`, `pull`, and `push` require the Figma REST API (`api.figma.com`). These commands fail gracefully with a clear message when `FIGMA_ACCESS_TOKEN` is not set. The Figma MCP server (when available in session) is preferred over direct REST API calls.

### Tokens Studio format reference

Tokens Studio v1 (legacy) format spec: https://docs.tokens.studio/tokens/token-types
DTCG spec: https://tr.designtokens.org/format/

---

## Open Questions

1. **Tokens Studio v2 (DTCG mode)** — Tokens Studio v2 uses native DTCG format. Should import auto-detect and pass DTCG files through without conversion? Recommendation: yes — if file is already DTCG, skip conversion and run validate only.

2. **Multi-file Tokens Studio projects** — Tokens Studio supports split token files per set (global.json, dark.json, brand.json). Should `--from` accept a directory of files, or require a single merged file? Recommendation: accept directory, merge sets automatically.

3. **Figma capture node resolution depth** — Deep Figma files can have hundreds of nested frames. Should capture have a `--depth` limit, or always traverse fully? Recommendation: full traversal with a `--max-nodes` safety limit (default 2000).

4. **Push safety** — `nib figma push` modifies a shared Figma file. Should it require a `--confirm` flag to prevent accidental overwrites? Recommendation: yes — require explicit `--confirm` on first push to a file; subsequent pushes can skip with `--yes`.

---

## Done Criteria

- [ ] `nib brand init --from tokens.json` imports a Tokens Studio legacy file and produces valid DTCG output
- [ ] Post-import `nib brand validate` runs automatically and reports findings
- [ ] `nib brand export --format tokens-studio` produces a file loadable by Tokens Studio plugin
- [ ] Round-trip import → export → re-import produces ≤ 2% value drift
- [ ] `nib figma capture <url>` produces a `DesignDocument` that passes `nib build`
- [ ] `nib figma pull` imports Figma color + typography variables as DTCG tokens
- [ ] `nib figma push` updates Figma variables non-destructively
- [ ] All Figma commands fail with a clear error when `FIGMA_ACCESS_TOKEN` is not set
- [ ] `bun run typecheck` passes with no new errors
- [ ] `bun run test` passes with fixture-based coverage for format converters

---

*Created: 2026-02-28*
*References: gap-analysis.md GAP 14*
