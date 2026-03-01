# INV-006: MCP Tool Contract Stability

**Status:** Active
**Created:** 2026-03-01

## Rule

The MCP tool surface (tool names, required parameters, response shapes, and resource URIs) is a public API contract consumed by AI agents. Breaking changes silently corrupt agent workflows because agents cache tool knowledge across sessions.

Any change to the MCP surface must be **additive only** unless an explicit ADR is filed documenting the breaking change, its justification, and a migration path.

## What Is Additive (Safe)

- Adding a new tool
- Adding an optional parameter to an existing tool
- Adding new fields to a tool's response JSON
- Adding new resources or resource templates
- Changing tool descriptions or annotations
- Improving error messages

## What Is Breaking (Requires ADR)

- Renaming a tool (`nib_brand_audit` → `nib_audit_brand`)
- Removing a tool
- Renaming or removing a required parameter
- Changing a parameter from optional to required
- Changing the structure of existing response fields (e.g. `{ passed: 11 }` → `{ passCount: 11 }`)
- Changing a resource URI scheme (`nib://brand/config` → `nib://config/brand`)
- Removing a resource

## Enforcement

Before modifying any file in `src/mcp/tools/` or `src/mcp/resources/`:

1. Check if the change is additive — if yes, proceed
2. If the change is breaking:
   a. File an ADR under `.dof/architecture/decisions/` documenting:
      - What is changing and why
      - Which agents/consumers are affected
      - Migration path (deprecation period, old name kept as alias, etc.)
   b. The ADR must be approved before the code change lands
3. When in doubt, treat it as breaking

## Violations

- Renaming or removing a tool without an ADR
- Changing required parameter names without an ADR
- Restructuring response JSON for existing fields without an ADR
- Removing a resource URI without an ADR
