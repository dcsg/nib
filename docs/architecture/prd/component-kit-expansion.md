# PRD: Phase 3.2 — "A Complete Starting Kit"

**Status:** Shipped
**Phase:** 3.2
**Milestone:** Teams get a real component kit on day one — 12 components with design API slots
**Target users:** All teams running `nib kit` for the first time; design system maintainers defining component contracts
**References:** roadmap.md, gap-analysis.md
**Depends on:** Phase 3.1 (`nib kit` command), Phase 3 (`nib component init`, contract schema)

---

## Problem

After gap analysis against industry best-practice component kits, two critical gaps emerged:

### 1. Kit coverage — the feedback category was entirely missing

The original 6-component kit (Button, TextInput, Dialog, Checkbox, Tabs, Switch) skipped:
- **Badge/Tag** — used on every list item, table row, nav item, and status display
- **Toast/Snackbar** — every async action in every app produces one
- **Alert/Banner** — every form, every error state, every system message

And three implemented templates (Radio, Combobox, Tooltip) were not included in the kit despite being day-one requirements.

### 2. Contract schema — no design API (`slots`)

The contract defined _what a component looks like_ (anatomy, states, tokens) but not _what it accepts_ (its design API). This is the field that prevents "component explosion":

> "Write down a component's API in design terms: Inputs — label, helper, error text, icon slots, actions. Constraints — min/max width, alignment, wrapping. Composition — what can nest inside what."

Without `slots`, a team can't answer "what does this Button accept?" from the contract alone. They have to read the implementation.

### 3. State model gap — `selected` missing from Combobox

The Combobox template had states for `closed`, `open`, `focused`, `disabled`, `invalid` — but no `selected` state to represent when a value has been chosen and is displayed in the input. This is a distinct, meaningful state.

---

## Goals

1. Expand `nib kit` from 6 → 12 components covering all critical day-one categories
2. Add `slots` to the contract schema — a typed design API for every component
3. Fill the three new template gaps: Badge, Toast, Alert
4. Add `selected` state to Combobox
5. Add slots to all 12 existing templates

### Non-goals

- Content rules (`content` field) — Phase 4+
- Constraints (`constraints` field) — Phase 4+
- Composition rules (`composition` field) — Phase 4+
- Platform field — Phase 4+
- Density modes — Phase 5+

---

## Success Metrics

| Metric | Target |
|--------|--------|
| `nib kit` scaffolds all 12 components without errors | 100% |
| All 12 contracts pass `nib brand validate` | 100% |
| Every contract has a `slots` field | 12/12 templates |
| Combobox has `selected` state | Yes |
| `bun run typecheck` passes | Yes |

---

## User Stories

### Slots

**As a developer** picking up a component, I want to open `Button.contract.json` and see exactly what the Button accepts (label, leadingIcon, trailingIcon — what's required, what's optional, max lengths) without reading the React source code.

**As a design system maintainer**, I want the contract to enforce `label.required: true` on Button so contributors know they must always provide a label — preventing icon-only buttons without `aria-label`.

**As an AI agent**, I want to read `slots` and know I can pass `title`, `body`, and optionally `footer` and `closeButton` to Dialog — and that `title.maxLength: 60` means I shouldn't write a 200-character title.

### Kit completeness

**As a new user** running `nib kit`, I want Badge, Toast, and Alert included so I don't have to manually scaffold the components I'll use within the first hour of building.

**As a developer** handling async operations, I want a Toast contract with `message.required: true` and `action` optional — so I know Toast always needs a message and can optionally have an Undo button.

---

## Functional Requirements

### FR-1: `ComponentSlot` schema

```typescript
interface ComponentSlot {
  description: string;           // What this slot contains
  required: boolean;             // Must be provided
  accepts: "text" | "icon" | "component" | "action";
  maxLength?: number;            // For text slots
  truncatable?: boolean;         // Whether overflow can be clipped
}

type ComponentSlots = Record<string, ComponentSlot>;
```

Added to `ComponentContract` as `slots?: ComponentSlots`.

---

### FR-2: New widget types

`badge | toast | alert` added to `WidgetType`.

| Widget type | ARIA role | Live region | Auto-dismiss |
|-------------|-----------|-------------|--------------|
| `badge` | `img` (decorative) or none | No | No |
| `toast` | `status` (info/success) or `alert` (warning/error) | Yes | Yes — auto-dismiss after timeout |
| `alert` | `alert` or `status` | Yes | No — stays until resolved or dismissed |

---

### FR-3: Badge template

- **Anatomy:** root, label, icon, dismissButton
- **Variants:** neutral, success, warning, error, info
- **States:** default, dismissible
- **A11y:** `role="img"` when decorative; `aria-label` required for icon-only badges
- **Slots:** label (required, text, maxLength: 30), icon (optional), dismissAction (optional)
- **Rule:** Badge label must always be short and scannable — never wrap to two lines

---

### FR-4: Toast template

- **Anatomy:** root, icon, title, message, action, dismissButton
- **Variants:** info, success, warning, error
- **States:** entering, visible, dismissing, dismissed
- **A11y:** `role="status"` for info/success (polite), `role="alert"` for warning/error (assertive)
- **Slots:** message (required, maxLength: 120), title (optional, maxLength: 50), action (optional), icon (optional)
- **Rule:** Single inline action only (Undo, View, Retry) — never two competing actions in a toast

---

### FR-5: Alert template

- **Anatomy:** root, icon, title, description, actions, dismissButton
- **Variants:** info, success, warning, error
- **States:** default, dismissed
- **A11y:** `role="alert"` for warning/error, `role="status"` for info/success
- **Slots:** description (required, maxLength: 300), title (optional, maxLength: 60), actions (optional), icon (optional)
- **Rule:** Maximum two actions (primary + secondary); omit dismissButton for critical/unresolvable alerts

---

### FR-6: Combobox `selected` state

New state added: `selected — A value has been chosen and is displayed in the input`. Distinct from `open` (popup visible) and `closed` (popup hidden). Represents the resting state after selection.

---

### FR-7: Kit component list (final)

| Component | Category | Template origin |
|-----------|----------|----------------|
| Button | Inputs | Phase 3 (existing) |
| TextInput | Inputs | Phase 3 (existing) |
| Checkbox | Inputs | Phase 3 (existing) |
| Radio | Inputs | Phase 3 (existing — added to kit) |
| Switch | Inputs | Phase 3 (existing) |
| Dialog | Overlays | Phase 3 (existing) |
| Tooltip | Overlays | Phase 3 (existing — added to kit) |
| Tabs | Navigation | Phase 3 (existing) |
| Combobox | Selection | Phase 3 (existing — added to kit) |
| Badge | Feedback | Phase 3.2 (new) |
| Toast | Feedback | Phase 3.2 (new) |
| Alert | Feedback | Phase 3.2 (new) |

---

## Phase 4+ Contract Schema Backlog

These are documented in roadmap.md and are **not** in scope for Phase 3.2:

| Field | Purpose | Blocked on |
|-------|---------|-----------|
| `content` | Global content policy rules | Design across 3+ component types first |
| `constraints` | Min/max dimensions, alignment | Phase 5 layout system |
| `composition` | Allowed children/parents | Full registry adoption |
| `platforms` | Platform-exclusive targeting | Phase 7 native adapters planning |
| `density` | Compact/comfortable/spacious modes | Phase 5 density tokens |

---

## Technical Notes

### Files changed

| File | Change |
|------|--------|
| `src/types/brand.ts` | Add `ComponentSlot`, `ComponentSlots`; add `badge \| toast \| alert` to `WidgetType`; add `slots?` to `ComponentContract` |
| `src/brand/components/templates/badge.ts` | New |
| `src/brand/components/templates/toast.ts` | New |
| `src/brand/components/templates/alert.ts` | New |
| `src/brand/components/templates/button.ts` | Add `slots` |
| `src/brand/components/templates/textinput.ts` | Add `slots` |
| `src/brand/components/templates/dialog.ts` | Add `slots` |
| `src/brand/components/templates/checkbox.ts` | Add `slots` |
| `src/brand/components/templates/radio.ts` | Add `slots` |
| `src/brand/components/templates/switch.ts` | Add `slots` |
| `src/brand/components/templates/tabs.ts` | Add `slots` |
| `src/brand/components/templates/combobox.ts` | Add `slots` + `selected` state |
| `src/brand/components/templates/tooltip.ts` | Add `slots` |
| `src/brand/components/scaffold.ts` | Add badge/toast/alert heuristics + template loading + pass `slots` |
| `src/cli/commands/kit.ts` | Expand `KIT_COMPONENTS` 6 → 12 |

---

## Done Criteria

- [x] `nib kit` scaffolds all 12 components without errors
- [x] All 12 contracts pass `nib brand validate`
- [x] Every contract has a `slots` field with typed entries
- [x] Combobox has `selected` state
- [x] Badge, Toast, Alert templates include correct ARIA live region guidance
- [x] `bun run typecheck` passes with no new errors

---

*Created: 2026-03-01*
*References: gap-analysis.md GAP 2 (component layer), component kit best-practice research*
