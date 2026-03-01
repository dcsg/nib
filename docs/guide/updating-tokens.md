# Updating Design Tokens

Changing a design token sounds simple. In practice it touches your Pencil files, your CSS, your Tailwind config, your AI agent context, and potentially your entire codebase — in different ways depending on what kind of change you're making.

This guide walks through each scenario: what to edit, what regenerates automatically, and what requires manual intervention in code.

---

## The three types of token changes

Understanding the [DTCG token](/guide/brand#token-architecture) architecture first makes every scenario clearer.

```
Primitive tokens      →  raw values (color.brand.600 = #2563EB)
    ↓ referenced by
Semantic tokens       →  purpose-mapped aliases (color.interactive.default = {color.brand.600})
    ↓ compiled into
Platform outputs      →  CSS variables, Tailwind preset, Pencil variables
    ↓ consumed by
Your code             →  var(--color-interactive-default) in CSS / Tailwind classes
```

Changes flow **down** the stack automatically. Changes to the names of things require **manual updates** anywhere that name is used.

| Change type | Risk | Cascades automatically | Requires code search |
|---|---|---|---|
| **A. Change a primitive value** | Low | ✅ All semantic tokens that reference it | ❌ |
| **B. Change a semantic mapping** | Medium | ✅ All CSS/Tailwind output | ❌ |
| **C. Rename or remove a token** | High | ❌ | ✅ Find every usage |

---

## The universal update sequence

No matter which scenario you're in, always follow this sequence after editing any token file:

```sh
# 1. Validate — catch broken references before building
nib brand validate

# 2. Build — regenerate CSS, Tailwind preset, Pencil variables
nib brand build

# 3. Audit — verify WCAG contrast still passes
nib brand audit

# 4. Push — update every .pen file
nib brand push docs/design/system/design-system.pen
nib brand push docs/design/screens/01-onboarding/onboarding.pen
# ... repeat for each flow file

# 5. Check — confirm in your app that the visual change looks right
```

Steps 1–3 are always the same. Step 4 and 5 vary by scenario.

---

## Scenario A — Changing a primitive value

**Example:** Your brand blue shifts from `#2563EB` to `#1D4ED8`. You want everything that was that shade of blue to update.

**What to edit:** `docs/design/system/tokens/color/primitives.tokens.json`

```json
{
  "color": {
    "brand": {
      "600": { "$value": "#1D4ED8" }  // ← change this
    }
  }
}
```

**What cascades automatically:**
- Every semantic token referencing `{color.brand.600}` picks up the new hex
- CSS output: `--color-interactive-default` updates in `variables.css`
- Tailwind preset: `interactive.default` updates in `preset.js`
- Pencil variables: all `.pen` files update after `nib brand push`

**Code implications:**
- If your code uses CSS custom properties (`var(--color-interactive-default)`) → **zero code changes needed**. The variable resolves to the new value after you deploy the updated `variables.css`.
- If your code uses hardcoded hex values anywhere → those won't update. Search your codebase for the old hex and replace with the correct token variable.

**WCAG check:** primitive changes often affect contrast ratios. Always run `nib brand audit` and fix any newly failing pairs before deploying.

---

## Scenario B — Changing a semantic mapping

**Example:** You want `color.interactive.default` (your primary button color) to use `brand.500` instead of `brand.600` — a lighter shade.

**What to edit:** `docs/design/system/tokens/color/semantic-light.tokens.json` (and `semantic-dark.tokens.json` if you have a dark theme)

```json
{
  "color": {
    "interactive": {
      "default": { "$value": "{color.brand.500}", "$type": "color" }  // ← was brand.600
    }
  }
}
```

**What cascades automatically:**
- The CSS variable `--color-interactive-default` resolves to the new primitive value
- Every element in your UI using that semantic token updates — buttons, links, focus rings, checkboxes — anything using `color.interactive.default`
- Pencil files update after `nib brand push`

**Code implications:**
- No code changes needed IF the token name (`color.interactive.default`) stayed the same
- The visual change is automatic — your components already reference the semantic token, not the primitive

**WCAG check:** this is the most common source of new contrast failures. `brand.500` is lighter than `brand.600`, which may fail AA against white backgrounds. Always run `nib brand audit` after semantic mapping changes.

**Design check:** open your `.pen` files after pushing — components using `{var.color-interactive-default}` will show the updated color. Visually verify that buttons, links, and interactive states still look intentional.

---

## Scenario C — Renaming or removing a token

This is the highest-risk change. A renamed token creates a broken reference anywhere the old name is used — in your CSS, your Tailwind classes, your component code, and your Pencil files.

**Example:** You want to rename `color.interactive.default` to `color.action.primary`.

### Step 1 — Search your codebase first

Before touching any token file, find every place the old name is used:

```sh
# Search for CSS variable usage
grep -r "color-interactive-default" src/

# Search for DTCG path usage (in token files and contracts)
grep -r "color.interactive.default" docs/ .nib/
```

Make a list. You'll fix these after updating the token files.

### Step 2 — Add the new token, keep the old one temporarily

```json
{
  "color": {
    "interactive": {
      "default": { "$value": "{color.brand.600}", "$type": "color" }  // keep temporarily
    },
    "action": {
      "primary": { "$value": "{color.brand.600}", "$type": "color" }  // add new
    }
  }
}
```

Run `nib brand build` — now both CSS variables exist: `--color-interactive-default` and `--color-action-primary`.

### Step 3 — Update all usages in code

Replace old references with the new token name:

```css
/* Before */
background-color: var(--color-interactive-default);

/* After */
background-color: var(--color-action-primary);
```

```tsx
// Before (Tailwind)
<button className="bg-interactive-default">

// After
<button className="bg-action-primary">
```

Also update any nib component contracts that reference the old token path:

```sh
grep -r "color.interactive.default" .nib/components/
# Update each occurrence to color.action.primary
```

### Step 4 — Remove the old token

Once all usages are updated, remove the deprecated token from the token file and rebuild:

```sh
nib brand validate   # catches any remaining references to the old name
nib brand build
nib brand audit
```

::: warning Don't rename tokens casually
Renames create breaking changes. If you're working in a team or if your tokens are consumed by other systems (a design tool, an external app), coordinate the change before removing the old token. Consider keeping both names for a deprecation period.
:::

---

## What updates automatically vs what doesn't

| What | Auto-updates on `nib brand build` + `nib brand push` | Requires manual action |
|---|---|---|
| CSS custom properties | ✅ `variables.css` regenerated | Only if token renamed/removed |
| Tailwind preset | ✅ `preset.js` regenerated | Only if token renamed/removed |
| Pencil token variables | ✅ after `nib brand push` per file | Only if token renamed/removed |
| AI agent context (`brand.md`) | ✅ regenerated by `nib brand build` | — |
| Component contracts (`.nib/components/`) | ❌ | Update JSON if token paths changed |
| Your component code | ❌ | Update if token renamed/removed |
| Your CSS/SCSS | ❌ | Update `var(--old-name)` → `var(--new-name)` |
| Your Tailwind classes | ❌ | Update class names if token renamed |
| Hardcoded hex values in code | ❌ | Never use hex — use token variables |

---

## Dark mode tokens

If you have both light and dark semantic tokens, changes need to be applied to both:

```
docs/design/system/tokens/color/semantic-light.tokens.json  ← edit both
docs/design/system/tokens/color/semantic-dark.tokens.json   ← edit both
```

Run `nib brand audit` for each theme — a color that passes AA in light mode may fail in dark mode.

---

## After pushing to Pencil

Token changes in Pencil are immediate once pushed — all elements using a token variable show the new value. But verify:

1. **Open each `.pen` file** — does the updated token look intentional in context?
2. **Check component states** — hover and disabled states often use derived tokens (e.g. `color.interactive.hover`) that may also need adjustment
3. **Re-capture if needed** — if the token change visually affects a screen you've already prototyped, re-run `nib capture` to update the snapshot

```sh
# Re-capture a flow after token changes
nib capture docs/design/screens/01-onboarding/onboarding.pen \
  -o docs/design/screens/01-onboarding/onboarding.design.json
```

---

## Checklist

Copy this for any token update:

```
□ Identify change type (primitive value / semantic mapping / rename-remove)
□ If rename/remove: grep codebase for old name, list all usages
□ Edit token file(s)
□ nib brand validate — no broken references
□ nib brand build — CSS, Tailwind, Pencil outputs regenerated
□ nib brand audit — WCAG contrast still passes
□ nib brand push — for each .pen file
□ Visual check in Pencil — does it look right?
□ Deploy updated variables.css to app
□ If renamed/removed: update all code references
□ If renamed/removed: update component contracts (.nib/components/)
□ Re-capture any affected prototype snapshots
```
