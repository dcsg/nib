# INV-008: Feature Documentation from the Persona's Point of View

**Status:** Active
**Created:** 2026-03-01

---

## Rule

Every new feature or meaningful feature change must be documented from the perspective of the personas who use it — not from the perspective of the implementation. Documentation is not optional and is not written after the fact. It ships with the feature.

---

## The Documentation Standard

Every feature doc (new guide page, updated guide section, or updated CLI reference entry) must include:

### 1. Who it affects and how

State which persona(s) benefit and what problem it solves for them, in plain language:

> **Who:** Solo Builder setting up their first brand
> **Problem:** Had to manually write a CSS mapping block for shadcn/ui
> **Solution:** `nib brand build --framework shadcn` writes it automatically

### 2. The outcome, not the mechanism

Lead with what the user gets, not how the code works. The reader is a builder or designer, not an engineer.

| ❌ Mechanism-first | ✅ Outcome-first |
|---|---|
| "The PlatformAdapter interface is invoked with the resolved token set..." | "Run one command and get a ready-to-use theme file for your framework" |
| "The DTCG reference resolver traverses the token graph..." | "Change one token value and every framework file updates automatically" |

### 3. A concrete example showing the outcome

Every feature must include at least one minimal, runnable example that shows the end result — not a made-up abstract snippet, but something a user could copy and actually run:

```sh
# Run this — get this output
nib brand build --framework shadcn

# Output written to: docs/design/system/build/frameworks/shadcn/globals.css
```

And the output should be shown or described:

```css
/* Written to globals.css */
@layer base {
  :root {
    --primary: var(--color-interactive-default);
    --background: var(--color-background-primary);
    /* ... */
  }
}
```

### 4. The before/after contrast

Show what the user had to do before and what they do now. This makes the benefit concrete and gives returning users context when they upgrade:

| Before | After |
|---|---|
| Manually write CSS variable mappings for each framework | `nib brand build --framework <name>` generates it |
| Update mapping file by hand when tokens change | Regenerated automatically on next `nib brand build` |

---

## Where Documentation Lives

| Type | Location |
|---|---|
| New user-facing guide | `docs/guide/<feature-name>.md` + add to sidebar in `docs/.vitepress/config.ts` |
| Updated guide section | Edit existing `docs/guide/*.md` |
| CLI command reference | `docs/reference/cli.md` — add command entry with all flags and examples |
| MCP tool reference | Update tool's `description` field in `src/mcp/tools/*.ts` (Claude reads this) |
| Roadmap item | Add to the relevant guide page's "Roadmap" section |

---

## Persona Context

The two personas who read nib docs:

**Solo Builder** — a founder, indie hacker, or product person with no design background. Shipping a product alone. Comfortable with code but not with design systems vocabulary. Reads docs to learn what to do next. Wants to be told exactly what to run and see exactly what comes out.

**UX Designer at a Product Team** — has design background but isn't always a developer. Works with engineers. Needs to show others how to use the system. Cares about process and correctness. Reads docs to make sure the workflow is right, then points others to them.

---

## Invariant Violations

The following are violations of this invariant:

- Shipping a new MCP tool without updating `docs/guide/` or `docs/reference/cli.md`
- Writing documentation that explains the implementation ("the resolver traverses...") without explaining the outcome ("your theme file is updated automatically")
- Omitting a concrete example — "see the API docs" is not a concrete example
- Documenting a feature only in code comments
- Updating the CLI `--help` text but not the docs site

---

## Enforcement

- PR review checklist: if code adds or changes a user-facing feature, the PR must include a docs change
- New MCP tools appear in `docs/reference/cli.md` and, if they introduce a new workflow, in `docs/guide/`
- New CLI commands appear in `docs/reference/cli.md` with at minimum: description, flags table, and one example
