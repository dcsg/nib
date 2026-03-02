# INV-010: MCP Tool Response Size — Non-Negotiable Rules

**Status:** Active
**Date:** 2026-03-02
**Scope:** All MCP tool handlers in `src/mcp/tools/`.

---

## Purpose

MCP clients (Claude Code, Cursor, Windsurf, etc.) enforce a hard limit on the size of tool
result content. Exceeding it causes the error:

```
Error: result (N characters) exceeds maximum allowed tokens.
Output has been saved to /path/to/file.txt
```

When this happens the agent cannot read the result inline — it must parse a temp file using
`offset`/`limit`, which breaks the intended workflow and requires the agent to do extra work.

These rules prevent MCP tool responses from exceeding the limit.

---

## Rules

### Rule 1: Never use pretty-printed JSON (`null, 2`)

All MCP tool handlers MUST use compact `JSON.stringify(data)` — no `null, 2` argument.

Pretty-printing adds 20–50% whitespace overhead for deeply nested objects, with zero benefit
to the calling agent (which parses JSON programmatically, not visually).

```typescript
// Correct:
text: JSON.stringify({ penFile, variables })

// Wrong — adds ~30% overhead for no reason:
text: JSON.stringify({ penFile, variables }, null, 2)
```

---

### Rule 2: Strip internal fields before serializing

Only include fields that the calling agent needs to take its next action. Fields that are
purely informational or available on disk MUST be stripped from the response.

Canonical examples:

| Field | Tool | Why it's stripped |
|---|---|---|
| `pencilVariables` | `nib_kit`, `nib_kit_bootstrap` | Already loaded by `nib_brand_push`; not needed for `batch_design` |
| `tokenBindings` | `nib_kit`, `nib_kit_bootstrap` | Internal contract detail; lives in `.nib/components/*.contract.json` |
| `anatomy`, `states` | `nib_kit`, `nib_kit_bootstrap` | Available from contract files on disk |

Pattern to follow:

```typescript
// Don't: return the full computed object
return { content: [{ type: "text", text: JSON.stringify(fullResult) }] };

// Do: project only what the agent needs
const slim = {
  brandName: result.brandName,
  components: result.components.map(({ name, batchDesignOps, verification }) =>
    ({ name, batchDesignOps, verification })
  ),
};
return { content: [{ type: "text", text: JSON.stringify(slim) }] };
```

---

### Rule 3: Large artifacts MUST be saved to disk — never inlined

Any single string or blob larger than ~10 KB MUST be written to a file. The response returns
the file path and a one-line instruction telling the agent how to use it.

The threshold: if a field would make the total response exceed ~50 KB, save it to disk.

```typescript
// Correct — foundations ops are ~40 KB:
const foundationsOpsPath = join(nibDir, "kit-foundations.ops");
await writeFile(foundationsOpsPath, recipe.foundations.batchDesignOps);

return {
  content: [{
    type: "text",
    text: JSON.stringify({
      ...slim,
      foundations: {
        batchDesignOpsFile: foundationsOpsPath,
        note: `Read ${foundationsOpsPath} and pass contents to batch_design.`,
      },
    }),
  }],
};

// Wrong — inlining 40 KB pushes response over the limit:
return { content: [{ type: "text", text: JSON.stringify({ ...slim, foundations }) }] };
```

Canonical file paths for large artifacts (relative to `nibDir`):

| Artifact | File path |
|---|---|
| Foundations batch_design ops | `.nib/kit-foundations.ops` |
| Full kit recipe (if needed) | `.nib/kit-recipe.json` |

---

### Rule 4: Measure before releasing a new tool

Before merging a new MCP tool, measure its worst-case response size:

```bash
bun -e "
const result = await myTool(worstCaseInput);
console.log('Response size:', JSON.stringify(result).length, 'chars');
"
```

If it exceeds **50,000 characters**, apply Rules 2 and 3 until it is under the limit.

The 50 KB target gives a comfortable margin below the observed ~100 KB limit, accounting for
JSON overhead and larger-than-average brands.

---

## Tool Audit (current state)

| Tool | Worst-case size | Status |
|---|---|---|
| `nib_kit_bootstrap` | ~37 KB (was ~120 KB) | Fixed in commit `bf34993` |
| `nib_kit` | ~37 KB (was ~113 KB) | Fixed in commit `bf34993` |
| `nib_brand_push` | ~15 KB (variables map) | Safe — compact JSON |
| `nib_brand_audit` | ~5–10 KB (color pairs) | Safe — compact JSON |
| `nib_brand_validate` | ~2–5 KB (error list) | Safe — compact JSON |
| `nib_brand_init` | ~1 KB | Safe |
| `nib_brand_import` | ~0.5 KB | Safe |
| `nib_brand_build` | ~0.5 KB (plain text) | Safe |
| `nib_capture` | ~1 KB (summary only) | Safe — already returns summary |
| `nib_build_prototype` | ~0.5 KB (file paths) | Safe |
| `nib_component_init` | ~0.5 KB | Safe |
| `nib_component_list` | ~1 KB (12 components) | Safe |
| `nib_status` | ~0.5 KB | Safe |
| `nib_help` | ~2 KB (static text) | Safe |

Re-audit the table when adding new tools or when `KitRecipe` structure changes.

---

## Enforcement

1. **Code review**: Check all `JSON.stringify(...)` calls in `src/mcp/tools/` — no `null, 2`.
2. **New tool checklist**: Measure worst-case size before merging (Rule 4).
3. **Response shape review**: Verify no internal/redundant fields are included (Rule 2).
