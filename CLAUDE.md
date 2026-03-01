# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Knowledge Base

Architecture docs live in `docs/architecture/`:

- `docs/architecture/decisions/` — Architecture Decision Records (ADRs)
- `docs/architecture/invariants/` — Business rules that must never be violated
- `docs/architecture/prd/` — Feature PRDs

Before implementing, read the relevant ADRs and invariants. `.dof/` is gitignored (private tooling).

## Commands

```bash
bun run build        # Build library (ESM+CJS) and CLI via tsup
bun run typecheck    # TypeScript strict validation (tsc --noEmit)
bun run test         # Run tests (bun test)
bun src/cli/index.ts # Run CLI directly in dev (no build needed)
bun run docs:dev     # Local VitePress docs server
```

## Architecture

nib is the design control plane — a CLI tool, library, and MCP server that orchestrates your brand, design tools, codebase, and AI agents. It doesn't replace design tools; it controls the flow between them and ensures every tool, teammate, and AI agent builds on-brand by default.

Two active pipelines:

**Brand pipeline** (upstream — ADR-001):
```
Brand Guidelines → AI Enhancement → DTCG Tokens → CSS/Tailwind/Pencil Outputs → brand.md
```

**Prototype pipeline** (downstream):
```
.pen file → Capture (MCP) → DesignDocument JSON → Build → HTML Prototype
```

### Key Concepts

- **DesignDocument** (`src/types/design.ts`) — the intermediate JSON format and central contract between capture and build. Contains resolved nodes (no component refs), variables, themes, and assets.
- **PenNode** (`src/types/pen.ts`) — raw MCP data. `ref` nodes are resolved inline during normalization into `ResolvedNode`.
- **MCP Client** (`src/mcp/client.ts`) — one-shot pattern: `withMcpClient(config, async (client) => { ... })`. Discovery logic in `src/mcp/discover.ts` searches multiple config locations.

### Source Layout

- `src/cli/` — Citty-based CLI. Each command uses `defineCommand()` with typed args and async `run()`. Commands lazy-import implementations.
- `src/capture/` — .pen → DesignDocument normalization (reader, normalizer, variables)
- `src/build/` — DesignDocument → HTML (CSS generation, HTML generation, variable resolution, asset collection)
- `src/templates/` — Pluggable HTML templates (clean, presentation). Implement the `Template` interface from `base/types.ts`.
- `src/brand/` — Brand system: `index.ts` exports `init()`, `brandBuild()`, `brandPush()`, `brandAudit()`
  - `tokens/` — Algorithmic token generators (color scales, type scale, spacing, etc.)
  - `ai/` — Provider-agnostic AI enhancement (`BrandAiProvider` interface)
  - `intake/` — Source parsers (interactive prompts, markdown, URL, PDF)
  - `wcag.ts` — WCAG 2.1 contrast ratio math and auditing
  - `build.ts` — DTCG tokens → CSS variables, Tailwind preset, Pencil variables
- `src/types/` — All shared TypeScript interfaces. `brand.ts` for brand system, `design.ts` for intermediate format, `pen.ts` for raw MCP types.

### Build Outputs

tsup produces two entry points:
- **Library**: `dist/index.js` (ESM), `dist/index.cjs` (CJS), `dist/index.d.ts`
- **CLI**: `dist/cli.js` (ESM with shebang)

### Brand System Token Architecture

Three-tier DTCG (W3C Design Tokens) format:
1. **Primitives** — raw color scales (11 steps), neutral gray, feedback colors
2. **Semantic** — light/dark theme aliases referencing primitives via `{color.brand.600}` syntax
3. **Component** — scoped overrides (Phase 2)

Output splits: `.nib/brand.config.json` (tool state) + `docs/design/system/` (tokens, docs, build artifacts).

### Conventions

- Target: ES2022, strict mode, `noUncheckedIndexedAccess: true`
- Use `picocolors` (as `pc`) for CLI output coloring
- Dynamic imports in CLI commands to keep startup fast
- AI providers are optional — brand system works without API keys via `--no-ai`
- `docs/architecture/decisions/` contains ADRs — read before making architectural changes
- `docs/architecture/invariants/` contains business rules — never violate these
