# ADR-002: MCP Server Architecture

**Status:** Proposed
**Date:** 2026-03-01
**Deciders:** Daniel Gomes

---

## Context

nib's soul.md describes it as "a CLI tool, library, and MCP server." The MCP server does not exist. nib is currently an MCP *client* only — it connects to Pencil.dev's MCP server to read/write `.pen` files.

The [strategic audit](../../product/strategic-audit.md) identified this as the single most important gap: AI coding agents (Claude Code, Cursor, GitHub Copilot, Windsurf, Continue.dev, Cline, Zed) cannot discover or call nib's tools natively. They can only use nib through fragile subprocess calls with no discoverability, no structured output, and no tool contracts.

MCP has become the universal integration surface for AI coding tools. One MCP server implementation gives nib native integration with 7+ tools without per-agent adaptation.

### Research Inputs

- [MCP Server Best Practices research](../../../30%20-%20Resources/MCP%20Server%20Best%20Practices.md) — tool design, transport modes, real-world examples
- [CLI Best Practices research](../../../30%20-%20Resources/CLI%20Best%20Practices%20for%20Developer%20Tools.md) — `--json`, exit codes, CI patterns
- ESLint MCP server (`@eslint/mcp`) — the most relevant CLI-to-MCP precedent

---

## Decision

### Entry point: `--mcp` flag, not a subcommand

Follow the ESLint pattern. `nib --mcp` starts an MCP server over stdio. This is intercepted before citty's command routing:

```typescript
// src/cli/index.ts
if (process.argv.includes("--mcp")) {
  const { startMcpServer } = await import("../mcp/server.js");
  await startMcpServer();
} else {
  runMain(main);
}
```

**Why not `nib mcp` subcommand:** The `--mcp` flag mirrors ESLint's convention, which AI tool config files already expect. It also avoids polluting the subcommand namespace — `nib mcp` would imply MCP client commands too, creating ambiguity.

### Transport: stdio only (Phase 3.4)

Start with stdio transport. This covers all local AI agents (Claude Code, Cursor, Copilot, Windsurf). HTTP/Streamable HTTP transport is deferred — it adds complexity (auth, sessions, CORS) with no immediate user need.

The server factory is transport-agnostic:

```typescript
// src/mcp/server.ts
export function createNibMcpServer(): McpServer { ... }

// src/mcp/stdio.ts — used by nib --mcp
const server = createNibMcpServer();
await server.connect(new StdioServerTransport());
```

This allows adding HTTP transport later without touching tool/resource/prompt registration.

### SDK: raw `@modelcontextprotocol/sdk`, not FastMCP

nib already depends on `@modelcontextprotocol/sdk` (v1.12.1) for the MCP client. Use the same package's `McpServer` class for the server. FastMCP adds a dependency for features nib doesn't need (session management, auth, dev CLI).

### Three-layer architecture

```
┌───────────────────────────────────────┐
│            CLI Layer (citty)          │  ← colored terminal output
│  src/cli/commands/brand.ts            │
├───────────────────────────────────────┤
│            Core Library               │  ← returns typed data, no I/O
│  src/brand/index.ts                   │
│  src/capture/index.ts                 │
│  src/build/index.ts                   │
├───────────────────────────────────────┤
│            MCP Layer                  │  ← JSON-RPC structured output
│  src/mcp/server.ts                    │
│  src/mcp/tools/brand.ts              │
│  src/mcp/resources/brand.ts          │
│  src/mcp/prompts/review.ts           │
└───────────────────────────────────────┘
```

The core library is the shared truth. CLI and MCP are thin formatting wrappers. Core functions must never write to stdout or use `console.log()` — they return data, and the calling layer formats it. See [INV-005](../invariants/INV-005-stdio-purity.md).

### Tool design: outcome-oriented, 8-10 tools

Follow the [Philipp Schmid best practices](https://www.philschmid.de/mcp-best-practices): expose outcome-oriented tools that map to user workflows, not internal functions.

**Naming convention:** `nib_{domain}_{action}` to prevent conflicts with other MCP servers.

**Annotations:** Every tool declares `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` per the MCP spec.

**Error handling:** Application errors return `isError: true` with actionable agent instructions. Protocol errors throw `McpError`. Tools never crash — all handlers wrapped in try/catch.

**Stateless tools:** Each tool call re-reads config from disk. No cached state between calls. This prevents stale data bugs and ensures idempotent behavior.

### Resource design: URI scheme `nib://`

Static resources for config/status, `ResourceTemplate` for parameterized access to tokens and components.

### Prompt design: 3-4 workflow prompts

Prompts are user-triggered templates (via slash commands in Cursor/Claude). They guide the agent through common workflows like token review or accessibility audit.

### File structure

```
src/mcp/
  server.ts              # createNibMcpServer() factory + startMcpServer()
  tools/
    brand.ts             # nib_brand_init, _build, _audit, _validate, _push
    component.ts         # nib_component_init, _list
    prototype.ts         # nib_capture, nib_build_prototype
    status.ts            # nib_status
  resources/
    brand.ts             # nib://brand/config, nib://brand/status, nib://brand/docs/*
    tokens.ts            # nib://tokens/{category}/{name}
    components.ts        # nib://components/{name}
  prompts/
    review.ts            # review-tokens, audit-accessibility, design-critique
  client.ts              # (existing — MCP client for Pencil.dev)
  discover.ts            # (existing — MCP server discovery)
```

---

## Consequences

### Benefits

- **Universal AI integration**: one implementation, 7+ agent tools gain native access
- **Structured contracts**: typed parameters and responses, no terminal parsing
- **Discoverable**: agents auto-discover nib's capabilities via MCP tool listing
- **Standards-compliant**: follows MCP specification, works with any MCP-compatible client
- **No new dependencies**: uses existing `@modelcontextprotocol/sdk`

### Trade-offs

- **New code surface**: ~500-800 lines of MCP registration code
- **Testing complexity**: MCP server needs integration tests with `InMemoryTransport`
- **stdout discipline**: all core library code must avoid `console.log()` — see INV-005
- **Two formatting paths**: human output (CLI) and agent output (MCP) for the same operations

### Risks

- **MCP spec evolution**: the protocol is still evolving (SSE deprecated June 2025, Streamable HTTP added). Mitigation: use the official SDK which tracks spec changes.
- **Tool count growth**: as nib adds features, tool count could exceed the 12-15 recommended maximum. Mitigation: keep tools outcome-oriented, split into multiple servers if needed.

---

## Alternatives Considered

### Alternative 1: `nib mcp` subcommand

Rejected. Creates ambiguity between MCP server mode and potential future MCP client commands. The `--mcp` flag is cleaner and matches the ESLint precedent that AI tool configs already reference.

### Alternative 2: Separate `@nib/mcp` package

Rejected for Phase 3.4. ESLint initially embedded `--mcp` in the main binary, then extracted to `@eslint/mcp` when complexity warranted it. nib should follow the same path: start embedded, extract later if needed.

### Alternative 3: FastMCP framework

Rejected. Adds a dependency for features nib doesn't need. The raw SDK provides enough convenience via `McpServer.registerTool()`. FastMCP's value (session management, auth, dev CLI) isn't needed for a local stdio server.

### Alternative 4: HTTP-first transport

Rejected for Phase 3.4. All target AI agents (Claude Code, Cursor, Copilot, Windsurf) connect via stdio for local tools. HTTP adds auth, session management, and CORS complexity with no current user need. The transport-agnostic `createNibMcpServer()` factory allows adding HTTP later.
