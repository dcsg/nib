# PRD: Phase 3 — "You Have a Component System"

**Status:** Ready for design — implement after Phase 2 ships
**Phase:** 3
**Milestone:** Teams can define components with contracts that encode tokens, states, variants, and a11y rules
**Target users:** Developer-led teams who have completed Phase 2; teams building accessible UI component libraries
**References:** [roadmap.md](../roadmap.md#phase-3--you-have-a-component-system), [gap-analysis.md](../gap-analysis.md)
**Depends on:** Phase 2 — `$extensions.nib` token infrastructure, `brand.config.json` structure

---

## Problem

nib Phase 2 gives teams validated tokens with meaning. But:

1. **Tokens disappear into a void** — there is no bridge from "here are my tokens" to "here is my Button component that uses them." Every team has to invent this mapping themselves.
2. **No component registry** — nib has no inventory of what components exist. AI agents reading `brand.md` see colors and typography but can invent a `ButtonGroup`, a `Chip`, or a `NavigationRail` that don't exist in the system. There is no "approved component list."
3. **Accessibility is advisory, not encoded** — WCAG contrast is checked at the token level, but keyboard interaction models, focus rules, and touch target requirements are left to individual developers to implement correctly. They are not part of the system.
4. **Component tokens are missing** — the third tier of DTCG (scoped component overrides like `button.bg.primary → semantic.action.primary.bg`) is planned but does not exist, so tokens have no clear component-level binding.

The result: teams that complete Phase 2 have a token palette and no component system. The design system exists only as a promise.

---

## Goals

1. `nib component init <name>` scaffolds a complete, a11y-correct component contract in seconds
2. Every component contract is machine-readable (JSON schema), human-readable (Markdown), and AI-consumable (`brand.md` inventory)
3. Accessibility behavior is encoded in contracts — WAI-ARIA keyboard patterns, focus rules, touch targets — not left to implementation
4. Component token tier is defined in DTCG format and wired to the semantic layer
5. `brand.md` includes a component inventory that prevents AI agents from inventing phantom components

### Non-goals for this phase

- Component code generation (no React/Vue/Angular output — Phase 3 is contracts, not code)
- Component drift detection or version tracking (Phase 4)
- Pattern assembly from components (Phase 5)
- Figma component sync (Phase 6)

---

## Success Metrics

| Metric | Target |
|--------|--------|
| `nib component init Button` completes in < 5 seconds | 100% of runs |
| Generated contract passes JSON schema validation | 100% |
| Contract includes WAI-ARIA keyboard spec for all widget types | All 10 first-class widget types covered |
| `brand.md` component inventory section present after any `nib component init` | 100% |
| `nib brand validate` reports missing required component fields | All 5 required fields checked |
| Component token tier wired to semantic layer | `button.*`, `input.*`, `badge.*` tier-3 tokens generated |

---

## User Stories

### Component Scaffolding

**As a developer** starting a new component, I want `nib component init Dialog` to give me a complete contract skeleton — anatomy, states, variants, token bindings, WAI-ARIA keyboard spec — so I don't have to look up WAI-ARIA APG docs and invent the structure myself.

**As a design system maintainer**, I want every component contract to follow a consistent schema so contributors can add new components without bikeshedding structure.

### A11y Contracts

**As an accessibility engineer**, I want the Dialog component contract to specify that Tab/Shift+Tab cycle within a focus trap, Escape closes the dialog, and focus returns to the trigger on close — encoded as structured data, not prose — so I can write tests against the contract.

**As a developer** building for mobile, I want the Button component contract to specify the minimum touch target size (44pt iOS / 48dp Android) as a first-class field so I don't have to remember the WCAG 2.2 requirement.

### Component Registry

**As an AI agent** working in this codebase, I want `brand.md` to include a section listing all approved components so I don't invent a `Chip` component that isn't in the system.

**As a team lead**, I want `nib brand validate` to report if a component contract is missing required fields so I can enforce completeness before a component ships.

### Component Tokens

**As a developer** implementing Button, I want `button.bg.primary` to be a real token that references `semantic.action.primary.bg` so the binding between component and token is explicit and traceable, not tribal knowledge.

---

## Functional Requirements

### FR-1: Component Contract JSON Schema

Every component contract is a JSON file at `.nib/components/<name>.contract.json`. The schema is versioned and validated.

**Top-level structure:**
```json
{
  "$schema": "https://nibjs.dev/schemas/component-contract.v1.json",
  "name": "Button",
  "description": "Triggers an action or event",
  "widgetType": "button",
  "anatomy": { ... },
  "variants": { ... },
  "sizes": { ... },
  "states": { ... },
  "interaction": { ... },
  "a11y": { ... },
  "responsive": { ... },
  "tokens": { ... }
}
```

**Required fields:** `name`, `widgetType`, `anatomy`, `states`, `a11y`, `tokens`
**Optional fields:** `variants`, `sizes`, `interaction`, `responsive`

---

### FR-2: Component Contract Fields

#### `anatomy`
Named parts of the component:
```json
{
  "anatomy": {
    "root": "The outer interactive element",
    "label": "The visible text content",
    "leadingIcon": "Optional icon before label",
    "trailingIcon": "Optional icon after label",
    "loadingSpinner": "Shown during loading state"
  }
}
```

#### `variants`
Named visual variants:
```json
{
  "variants": {
    "primary": "High-emphasis action, one per view",
    "secondary": "Medium-emphasis, supporting action",
    "ghost": "Low-emphasis, destructive or tertiary",
    "danger": "Destructive actions only"
  }
}
```

#### `sizes`
Named size steps:
```json
{
  "sizes": {
    "sm": { "height": "32px", "paddingX": "12px", "fontSize": "{type.sm}" },
    "md": { "height": "40px", "paddingX": "16px", "fontSize": "{type.base}" },
    "lg": { "height": "48px", "paddingX": "20px", "fontSize": "{type.lg}" }
  }
}
```

#### `states`
All interactive states with visual and semantic rules:
```json
{
  "states": {
    "default": { "description": "Resting state" },
    "hover": { "description": "Pointer device over element" },
    "focused": { "description": "Keyboard or programmatic focus", "focusRing": true },
    "active": { "description": "Being pressed" },
    "disabled": { "description": "Not interactive", "ariaDisabled": true },
    "loading": { "description": "Async action in progress", "ariaLabel": "Loading…", "ariaDisabled": true },
    "success": { "description": "Action completed" }
  }
}
```

**Note:** `hover` state must not be the only way to reveal information (V-06 in Phase 2 validate). If a state is `hoverOnly: true`, validate fails.

#### `interaction`
Declares how the component responds to input:
```json
{
  "interaction": {
    "activationKeys": ["Enter", "Space"],
    "role": "button",
    "submitsForm": false
  }
}
```

#### `a11y`
Full accessibility contract:
```json
{
  "a11y": {
    "role": "button",
    "keyboard": {
      "Enter": "Activates the button",
      "Space": "Activates the button"
    },
    "focusBehavior": "receives-focus",
    "focusTrap": false,
    "focusReturnTarget": null,
    "minimumTouchTarget": {
      "ios": "44pt",
      "android": "48dp",
      "web": "24px"
    },
    "ariaAttributes": ["aria-label", "aria-disabled", "aria-pressed"],
    "requiredLabel": true,
    "labelStrategy": "visible-text-or-aria-label"
  }
}
```

#### `responsive`
Behavior rules per window size class:
```json
{
  "responsive": {
    "compact": { "fullWidth": true },
    "medium": { "fullWidth": false },
    "expanded": { "fullWidth": false }
  }
}
```

#### `tokens`
Token bindings per anatomy part and state:
```json
{
  "tokens": {
    "root": {
      "default": {
        "background": "button.bg.primary",
        "color": "button.text.primary",
        "borderRadius": "button.radius",
        "borderColor": "transparent"
      },
      "hover": {
        "background": "button.bg.primary.hover"
      },
      "focused": {
        "outlineColor": "color.focus.ring",
        "outlineWidth": "2px"
      },
      "disabled": {
        "background": "color.surface.disabled",
        "color": "color.text.disabled"
      }
    }
  }
}
```

---

### FR-3: `nib component init <name>`

**Command:** `nib component init <name> [--widget-type <type>] [--variants primary,secondary] [--sizes sm,md,lg]`

**Behavior:**
1. Determines widget type from name (heuristic) or `--widget-type` flag
2. Loads the WAI-ARIA template for that widget type
3. Scaffolds a complete contract JSON with correct keyboard patterns, focus behavior, and a11y rules pre-filled
4. Writes to `.nib/components/<name>.contract.json`
5. Generates `docs/design/system/components/<name>.md` — human-readable Markdown
6. Updates component registry in `brand.config.json`
7. Regenerates `brand.md` component inventory section

**Widget type heuristics:**
- Name contains `button`, `btn` → `button`
- Name contains `input`, `field`, `textfield` → `textinput`
- Name contains `dialog`, `modal` → `dialog`
- Name contains `tab` → `tabs`
- Name contains `select`, `dropdown`, `combobox` → `combobox`
- Name contains `checkbox` → `checkbox`
- Name contains `radio` → `radio`
- Name contains `switch`, `toggle` → `switch`
- Name contains `tooltip` → `tooltip`
- Default → `generic` (no WAI-ARIA template, user fills in)

**Output:**
```
✓  nib component init Button

   Created:
   ├─ .nib/components/Button.contract.json
   ├─ docs/design/system/components/Button.md
   └─ brand.md  (component inventory updated)

   Widget type: button (WAI-ARIA APG — https://www.w3.org/WAI/ARIA/apg/patterns/button/)
   States: default, hover, focused, active, disabled, loading
   Keyboard: Enter → activate, Space → activate

   Next: review token bindings in Button.contract.json
```

---

### FR-4: WAI-ARIA Templates (First-Class Widget Types)

Pre-built keyboard and focus templates for the 10 most common widget types:

| Widget type | Key patterns | Focus behavior |
|-------------|-------------|----------------|
| `button` | Enter/Space: activate | receives-focus |
| `textinput` | Standard text input | receives-focus |
| `checkbox` | Space: toggle | receives-focus |
| `radio` | Arrow keys: move between options, Space: select | receives-focus; roving tabindex within group |
| `switch` | Space/Enter: toggle | receives-focus |
| `tabs` | ArrowLeft/Right: navigate tabs; Home/End: first/last tab; Tab: move to tabpanel | roving tabindex on tablist |
| `dialog` | Tab/Shift+Tab: cycle within trap; Escape: close; focus returns to trigger on close | focus-trap; initial focus on first focusable element or close button |
| `combobox` | ArrowDown: open/next; ArrowUp: previous; Enter: select; Escape: close; Home/End in list | manages focus between input and listbox |
| `tooltip` | Displayed on focus (not hover-only); Escape: dismiss | not independently focusable |
| `generic` | No template — user-defined | user-defined |

---

### FR-5: Component Token Tier

Component tokens are a third tier in the DTCG hierarchy: Primitives → Semantic → Component.

**Naming pattern:** `{component}.{anatomy}.{variant}.{state}` → references semantic token

**Generated automatically from contract + semantic tokens:**
```json
{
  "button": {
    "bg": {
      "primary": {
        "$type": "color",
        "$value": "{color.interactive.default}",
        "$extensions": { "nib": { "tier": "component", "component": "Button" } }
      },
      "primary-hover": {
        "$type": "color",
        "$value": "{color.interactive.hover}"
      }
    },
    "text": {
      "primary": {
        "$type": "color",
        "$value": "{color.text.on-interactive}"
      }
    },
    "radius": {
      "$type": "dimension",
      "$value": "{radius.md}"
    }
  }
}
```

**Generation rule:** `nib brand build` generates component tokens for all contracts in the registry. Component tokens are written to `docs/design/system/tokens/components/`.

---

### FR-6: Component Registry

`brand.config.json` gains a `components` field:

```json
{
  "components": {
    "Button": {
      "contractPath": ".nib/components/Button.contract.json",
      "widgetType": "button",
      "status": "stable",
      "addedAt": "2026-02-28"
    },
    "Dialog": {
      "contractPath": ".nib/components/Dialog.contract.json",
      "widgetType": "dialog",
      "status": "draft",
      "addedAt": "2026-02-28"
    }
  }
}
```

**Status values:** `draft | stable | deprecated`

---

### FR-7: `components.md` Generation

Generated at `docs/design/system/components.md` by `nib brand build`:

```markdown
# Component System

## Registry

| Component | Widget Type | Status | States | Variants |
|-----------|-------------|--------|--------|----------|
| Button | button | stable | 7 | 4 |
| Dialog | dialog | draft | 3 | 1 |

## Components

### Button
> Triggers an action or event

**Anatomy:** root, label, leadingIcon, trailingIcon, loadingSpinner
**States:** default, hover, focused, active, disabled, loading, success
**Keyboard:** Enter → activate, Space → activate
**Touch target:** 44pt iOS / 48dp Android / 24px web minimum
...
```

---

### FR-8: `brand.md` Component Inventory Section

`brand.md` gains a `## Component Inventory` section regenerated on each `nib brand build`:

```markdown
## Component Inventory

The following components are defined in this design system.
Do not invent or use components not listed here.

| Component | Status | Description |
|-----------|--------|-------------|
| Button | stable | Triggers an action or event |
| Dialog | draft | Modal overlay requiring user interaction |

For full contracts, see docs/design/system/components/.
```

**AI-contract purpose:** This section is explicitly written for AI agent consumption. The phrasing "Do not invent or use components not listed here" is intentional and machine-directed.

---

### FR-9: `nib brand validate` additions (Phase 3)

New checks added to `nib brand validate` in Phase 3:

| Check ID | Check | Failure example |
|----------|-------|-----------------|
| V-08 | All contracts in registry have required fields | `Button.contract.json` missing `a11y` |
| V-09 | No hover-only states in any contract | Dialog has `hover` state with `hoverOnly: true` |
| V-10 | Component tokens reference valid semantic tokens | `button.bg.primary` → `{color.interactive.default}` resolves |
| V-11 | All widget types use valid WAI-ARIA template | `widgetType: "button"` has `keyboard.Enter` and `keyboard.Space` |

---

## Technical Notes

### File locations

| Artifact | Path |
|----------|------|
| Component contracts | `.nib/components/<Name>.contract.json` |
| Component tokens | `docs/design/system/tokens/components/` |
| Component Markdown docs | `docs/design/system/components/<Name>.md` |
| Component index | `docs/design/system/components.md` |
| Registry | `brand.config.json` → `components` field |

### Source files to create / modify

| File | Action |
|------|--------|
| `src/cli/commands/component/init.ts` | Create |
| `src/brand/components/` | Create — contract scaffolder, token generator, doc generator |
| `src/brand/components/templates/` | Create — one WAI-ARIA template per widget type (10 files) |
| `src/brand/components/schema.ts` | Create — JSON schema for contract validation |
| `src/brand/foundations/components.ts` | Create — `components.md` generator |
| `src/brand/build.ts` | Modify — run component token generation + registry update |
| `src/types/brand.ts` | Modify — `ComponentContract`, `ComponentRegistry`, `WidgetType` interfaces |
| `src/brand/validate/` | Modify — add V-08 through V-11 checks |

### Component contract schema versioning

The `$schema` field in contracts points to a versioned JSON schema. Breaking changes to the contract format require a new schema version. Phase 3 ships `v1`. Migrations are handled automatically on `nib brand build` when schema version is behind.

---

## Open Questions

1. **Code generation scope** — Phase 3 is contracts only (no React/Vue output). Should `nib component init` have an optional `--generate-code react|vue|html` flag as a preview feature, even if the output is a stub? Recommendation: no — keep scope clean; code generation is Phase 3+ scope to define separately.

2. **Token binding resolution** — When a component contract references `button.bg.primary → {color.interactive.default}`, who resolves the reference? Does `nib brand build` resolve all references at build time (static), or does the contract reference the semantic token by name and let downstream tools resolve? Recommendation: static resolution at build time, with the alias preserved in `$value` for DTCG consumers.

3. **Contract for design tools** — Should `.contract.json` be readable by Pencil.dev or used as a source for generating Pencil component properties? If yes, this creates a Phase 3↔Pencil integration dependency. Recommendation: design contract as tool-agnostic; Pencil sync is a Phase 6 concern.

4. **Required variants** — Should `nib brand validate` require a minimum set of variants (e.g., Button must have `primary` + at least one secondary variant)? Or is variant definition entirely up to the team? Recommendation: no required variants in Phase 3; validate only structural completeness.

5. **`nib component list`** — Should Phase 3 include a read-only listing command, or is `nib status` sufficient? Recommendation: add `nib component list` as a trivial read command alongside `init`.

---

## Done Criteria

- [ ] `nib component init Button` completes without errors and produces a valid contract
- [ ] Generated `Button.contract.json` passes JSON schema validation
- [ ] Contract includes a WAI-ARIA keyboard spec with correct patterns for `button` widget type
- [ ] `brand.md` includes a `## Component Inventory` section after `nib component init`
- [ ] `components.md` is generated at `docs/design/system/components.md`
- [ ] Component token tier is generated for all contracts in registry on `nib brand build`
- [ ] `nib brand validate` runs V-08 through V-11 checks
- [ ] All 10 WAI-ARIA templates are implemented and tested
- [ ] `bun run typecheck` passes with no new errors
- [ ] `bun run test` passes with coverage for contract scaffolding + validate checks

---

*Created: 2026-02-28*
*References: gap-analysis.md GAP 2, GAP 6, GAP 9 (complete — component a11y contracts)*
