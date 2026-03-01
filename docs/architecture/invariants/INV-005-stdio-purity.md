# INV-005: stdio Purity in MCP Server Mode

**Status:** Active
**Created:** 2026-03-01

---

## Rule

When nib runs as an MCP server (`nib --mcp`), stdout is exclusively reserved for JSON-RPC messages. All diagnostics, progress indicators, and debug output must go to stderr. Any write to stdout outside the MCP protocol corrupts the message stream and breaks the connection.

## Enforcement

- MCP server code in `src/mcp/server.ts` and `src/mcp/tools/` must use the SDK's `ctx.mcpReq.log()` for structured logging or `console.error()` for stderr output
- `console.log()` is forbidden in any code path reachable from MCP tool handlers
- Core library functions (`src/brand/`, `src/capture/`, `src/build/`) must not write to stdout directly — they return data, and the calling layer (CLI or MCP) handles formatting
- The CLI layer (`src/cli/`) owns all stdout writes — it is never imported by MCP code

## Violations

- Using `console.log()` in any file under `src/mcp/`
- Using `console.log()` in any core library function that is called by both CLI and MCP layers
- Writing progress spinners or colored output to stdout in a code path reachable from MCP
- Importing CLI formatting utilities in MCP tool handlers
