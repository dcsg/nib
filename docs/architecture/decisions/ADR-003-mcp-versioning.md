# ADR-003: MCP Tool Versioning and Breaking Change Policy

**Status:** Accepted
**Date:** 2026-03-01

## Context

nib exposes 10 MCP tools and 6 resources that AI agents (Claude Code, Cursor, Copilot) consume programmatically. Unlike human-facing CLIs where you can print deprecation warnings, MCP consumers are agents that cache tool schemas and call them by name. A renamed or removed tool causes silent failures in agent workflows.

The MCP protocol itself has no built-in tool versioning mechanism — `listTools()` returns the current truth. This is a "living API" model, meaning the tool list at any moment is the contract.

## Decision

### 1. Additive-Only by Default

All MCP surface changes must be additive. New tools, optional parameters, new response fields, and new resources are always safe.

### 2. Breaking Changes Require an ADR

Any breaking change (tool rename, removal, required param change, response restructure, resource URI change) requires:

- A new ADR documenting the change, justification, and migration path
- Invariant INV-006 enforces this rule

### 3. Deprecation Over Removal

When a tool must be replaced:

1. Add the new tool alongside the old one
2. Mark the old tool's description with `[DEPRECATED — use nib_new_name instead]`
3. Keep both alive for at least one minor version cycle
4. Remove the old tool in the next minor/major bump with an ADR

### 4. Server Version is Informational

The `version` field in `McpServer({ name: "nib", version: X })` tracks the nib package version. It is informational — agents may read it but must not rely on it for compatibility. The tool list is the contract.

### 5. Agent Config Pinning

The npm package is `usenib` and the CLI binary is `nib`. Default agent configs use the globally installed binary:
```json
"command": "nib",
"args": ["--mcp"]
```

This requires `npm install -g usenib` (or bun/pnpm equivalent). Projects that need a specific version can install it pinned: `npm install -g usenib@0.2.0`.

The npx form is also supported. Both binary names work since `usenib` is a registered alias:
```json
"command": "npx",
"args": ["-y", "usenib@latest", "--mcp"]
```

## Consequences

- Adding tools is frictionless — just register and ship
- Removing or renaming tools has a speed bump (ADR + deprecation cycle)
- Agents always get the latest tools via `listTools()` discovery
- The invariant (INV-006) acts as a guardrail during code review
