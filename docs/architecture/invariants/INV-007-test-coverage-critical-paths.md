# INV-007: Test Coverage for Critical Paths

**Status:** Active
**Created:** 2026-03-01

---

## Rule

Every critical code path must have tests before it ships. "Critical" means: business logic with no obvious recovery if it's wrong, public MCP tool contracts, and the capture/build pipeline that users depend on for their output.

---

## What Must Be Tested

### 1. MCP tools — every tool must have a test that calls it end-to-end

Tests live in `src/mcp/server.test.ts` and use `InMemoryTransport` to connect a real MCP client to the real server. Every tool must have at minimum:
- A test that invokes it and verifies the response shape
- A test that verifies graceful failure when called with missing or invalid inputs

Tests that require Pencil MCP (e.g. `nib_capture`, `nib_brand_push`) must be guarded with `test.skipIf(!isIntegration)` and the `NIB_INTEGRATION=1` env flag.

### 2. Brand pipeline business logic — pure function coverage

The following modules contain no I/O and must have comprehensive unit tests:

| Module | Test file | What to cover |
|---|---|---|
| `src/brand/wcag.ts` | `src/brand/wcag.test.ts` | `relativeLuminance`, `contrastRatio`, `checkContrast`, `auditTokens` with known pairs |
| `src/brand/tokens/color.ts` | `src/brand/tokens/color.test.ts` | Scale generation (11 steps, lightness ordering, hue preservation), neutral, feedback, primitives/semantic builders |
| `src/brand/tokens/*.ts` | Sibling `*.test.ts` files | At least one test per exported function |
| `src/brand/validate/checks.ts` | `src/brand/validate/checks.test.ts` | All V-0x checks (already covered) |

### 3. Capture pipeline — normalizer

`src/capture/normalizer.ts` must have unit tests covering:
- Filtering of invisible and note nodes
- Node type mapping (especially `component → frame`, `ref → resolved`)
- Ref resolution: clone, override application, missing component handling
- Ref overrides must not mutate the original component tree
- Layout normalization (direction, padding uniform/object, gap)

### 4. Build pipeline — HTML and CSS generators

`src/build/css-generator.ts` and `src/build/html-generator.ts` must have unit tests covering:
- Canvas container output (id, dimensions, background)
- Absolute vs flex positioning
- All fill types (solid, linear, radial)
- Strokes (inside/outside), shadows, border radius, text styles
- Text → heading heuristic (h1/h2/h3/p by font size)
- Icon rendering (Material vs Lucide vs fallback)
- HTML escaping of user content (text, node names, path data)

### 5. Brand build integration — DTCG → CSS/Tailwind

`src/brand/build.ts` must have integration tests (using fixture token files in a temp dir) covering:
- `:root` block with `--` prefixed variables
- DTCG reference resolution (`{color.brand.600}` → `var(--color-brand-600)`)
- Dark mode `@media` and `[data-theme=dark]` blocks
- Tailwind preset exports CSS var references (not resolved hex values)

---

## When to Add Tests

Tests are written **at the same time as the feature**, not after. The rule:

- New MCP tool → add at least two tests to `server.test.ts` before the PR merges
- New business logic module → add a sibling `*.test.ts` before the PR merges
- Bug fix → add a test that would have caught the bug before the fix

A PR that adds a new tool or changes business logic without tests will not be merged.

---

## What Does NOT Require Unit Tests

- `src/brand/intake/` — parsers that call external services (web scraping, PDF extraction, AI APIs). These are tested through MCP tool invocation tests with mocks or integration guards.
- `src/cli/` output formatting — CLI color/formatting is visual and verified manually.
- `src/templates/` — template HTML output is tested through `html-generator.test.ts`.

---

## Enforcement

- `bun test` must pass with 0 failures before any commit reaches main
- Pre-push hook runs `bun run typecheck && bun test` — pushes that break tests are rejected
- The test count in `server.test.ts` (`"lists all N tools"`) must be updated whenever tools are added or removed
