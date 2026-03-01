# ADR-004: Port/Adapter Architecture — Incremental Formalization

**Status:** Accepted
**Date:** 2026-03-01
**Deciders:** Daniel Gomes

---

## Context

nib has multiple integration points with external systems: AI providers, design tools, brand input sources, CSS frameworks, HTML template engines, and MCP transports. As the number of integrations grows, the question is whether to adopt formal hexagonal architecture (ports and adapters) upfront or let ports emerge naturally from usage.

### Current state (as of 2026-03-01)

Two ports are already explicitly defined with TypeScript interfaces:

**`BrandAiProvider`** (`src/types/brand.ts`) — AI enhancement adapters:
- `AnthropicBrandProvider`
- `OpenAiBrandProvider` (also covers Ollama, any OpenAI-compatible endpoint)
- `ClaudeCodeBrandProvider`
- Null adapter (algorithmic-only, `--no-ai`)

**`Template`** (`src/templates/base/types.ts`) — HTML prototype renderers:
- `cleanTemplate`
- `presentationTemplate`

Three more are implicit (no interface, but pluggable by convention):

**Brand intake sources** — routed in CLI via file extension / URL scheme detection. Four adapters exist (`interactive`, `markdown`, `url`, `pdf`) but share no common interface.

**Platform build outputs** — CSS, Tailwind, Pencil, Docs. Called directly as named functions in `src/brand/build.ts`. No registry or interface abstraction.

**Node renderers** — `switch(node.type)` in `src/build/html-generator.ts`. Renderer functions exist per type but are not registered.

### The trigger for this decision

The framework integration guide documents manual steps for shadcn/ui, Chakra, Mantine, and MUI. A planned `nib brand build --framework <name>` command would automate this — making the platform build output a natural third formal port. That's the moment a `PlatformAdapter` interface becomes worth extracting.

---

## Decision

### 1. Extract ports only when a second distinct adapter exists

A port interface is extracted when there are (or will imminently be) two different adapters implementing it. Speculative interfaces are not written ahead of use.

Current status:
- `BrandAiProvider` — ✅ already formal (4 adapters)
- `Template` — ✅ already formal (2 adapters)
- `IntakeAdapter` — extract when a 5th source is added (e.g., Figma URL, Notion page)
- `PlatformAdapter` — extract when `--framework shadcn` is implemented alongside the existing CSS/Tailwind targets
- Node renderers — extract when a custom node type is added (out of scope for now)

### 2. Port interfaces live in `src/types/`

All port interfaces are co-located with domain types in `src/types/brand.ts`, `src/types/design.ts`, etc. — not scattered across implementation files.

### 3. Adapters live next to their port

```
src/brand/ai/          ← BrandAiProvider adapters
src/brand/intake/      ← IntakeAdapter adapters (when formalized)
src/brand/platforms/   ← PlatformAdapter adapters (when formalized, currently build.ts)
src/templates/         ← Template adapters
```

### 4. Discovery via factory, not constructor

Each port has a factory function that resolves the correct adapter from config, env vars, or explicit argument. Callers never instantiate adapters directly.

```typescript
// BrandAiProvider — already follows this pattern
getProvider(opts): BrandAiProvider | null  // src/brand/ai/index.ts

// Template — already follows this pattern
getTemplate(name: string): Template        // src/templates/index.ts

// PlatformAdapter — target pattern when extracted
getPlatformAdapters(config): PlatformAdapter[]  // src/brand/platforms/index.ts
```

### 5. `PlatformAdapter` port shape (planned)

When `--framework` is implemented, the interface will be:

```typescript
// src/types/brand.ts (addition)
export interface PlatformAdapter {
  name: string;
  description: string;
  build(tokens: ResolvedTokenSet, config: BrandConfig): Promise<PlatformOutput>;
}

export interface PlatformOutput {
  path: string;    // relative to output dir
  content: string; // file contents
  format: "css" | "js" | "ts" | "json";
}
```

Built-in adapters: `css`, `tailwind`, `pencil`, `docs`, `shadcn`, `chakra`, `mantine`, `mui`.

### 6. DesignDocument is a contract, not a port

The `DesignDocument` JSON format (`src/types/design.ts`) is the boundary between the capture pipeline and the build pipeline. It is versioned and backwards-compatible but is not a port — it does not have multiple implementations on either side. It is a data contract.

---

## Consequences

### Benefits

- Ports emerge from real need, not speculation — no dead interfaces
- New AI providers, intake sources, templates, and framework targets are frictionless to add
- The existing `BrandAiProvider` and `Template` patterns already validate the approach
- `PlatformAdapter` formalization unlocks the `--framework` roadmap item naturally
- Each port has a single discoverable factory function — easy to mock in tests

### Trade-offs

- The two informal ports (`IntakeAdapter`, node renderers) remain implicit until triggered. Contributers adding a 5th intake source need to know to also extract the interface — this is documented here as the rule.
- `PlatformAdapter` does not exist yet. Until it is extracted, `src/brand/build.ts` grows a new function per framework target. This is acceptable because the functions are short and the refactor to `PlatformAdapter` is a contained operation.

### What this is NOT

- This is not a plugin system. Adapters are compiled into nib, not loaded at runtime from npm packages. If a runtime plugin system is ever needed, that is a separate ADR.
- This is not a strict dependency inversion mandate for every module. Core algorithms (WCAG math, DTCG token resolution, HTML generation) are not wrapped in ports — they have no external variability.

---

## Integration Point Map (current)

| Port | Interface | Status | Adapters |
|---|---|---|---|
| AI provider | `BrandAiProvider` | ✅ Formal | Anthropic, OpenAI, Claude Code, null |
| HTML template | `Template` | ✅ Formal | clean, presentation |
| Brand intake source | *(none yet)* | ⚠️ Implicit | interactive, markdown, url, pdf |
| Platform build output | *(none yet)* | ⚠️ Implicit | css, tailwind, pencil, docs |
| Node renderer | *(none yet)* | ⚠️ switch | frame, text, path, icon, image, group |
| MCP transport | MCP SDK | ✅ External | stdio (StdioServerTransport) |
| Design capture | N/A — pipeline | ✅ Contract | DesignDocument JSON boundary |
