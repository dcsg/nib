# INV-004: Vendor Agnostic

**Status:** Active
**Created:** 2026-03-01

---

## Rule

nib must never hard-couple to a single AI vendor, design tool, or CSS framework. Every integration point must be behind an interface or adapter that allows alternatives.

## Enforcement

- AI providers implement `BrandAiProvider` interface (`src/types/brand.ts`) — adding a new provider requires only a new file in `src/brand/ai/`
- Design tool interactions go through `withMcpClient()` pattern (`src/mcp/client.ts`) — the MCP protocol is tool-agnostic
- Platform outputs are pluggable build targets in `src/brand/build.ts` — CSS, Tailwind, Pencil are parallel outputs, not sequential dependencies
- `--no-ai` flag ensures every command works without any AI provider
- Token format is W3C DTCG — an open standard, not a vendor format

## Violations

- Importing a vendor SDK directly in core logic (e.g., `import Anthropic from "@anthropic-ai/sdk"` in `src/brand/index.ts` instead of going through the provider interface)
- Adding a feature that only works with one AI provider and has no interface for alternatives
- Making Pencil.dev a hard requirement for any brand system operation (push is optional, init/build/audit must work without MCP)
- Generating output in a proprietary format without also supporting an open standard
- Adding a CSS framework dependency to token generation (tokens are framework-agnostic; adapters are framework-specific)
