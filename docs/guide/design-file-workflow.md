# Design File Workflow

This guide explains how to use your design system file as a foundation for new UX flows — what the process looks like, what Pencil's current limitations mean for you, and how to work around them effectively.

---

## The two-file model

nib uses a deliberate separation between two types of design files:

| File | Purpose | Lives at |
|---|---|---|
| `design-system.pen` | Tokens + component kit — your shared foundation | `docs/design/system/` |
| `<flow>.pen` | Screens for one UX flow | `docs/design/screens/<n>-<flow>/` |

You never design product screens inside `design-system.pen`. It exists purely as a reference and source of copy-pasteable components. Your actual screens live in flow files.

---

## The core limitation you need to understand

::: warning Pencil has no cross-file component linking
Unlike Figma, Pencil has no concept of a published component library. When you copy a component frame from `design-system.pen` into a flow file, **it becomes an independent copy** — there is no live link back to the original.

This means: if you update a Button in `design-system.pen`, that change does **not** propagate to your flow files automatically.
:::

This sounds like a big problem. In practice, it's manageable — because **tokens are the real shared layer**.

When you push tokens to a file with `nib brand push`, every element in that file that uses a token variable (`{var.color-interactive-default}`) gets the updated value instantly — across every `.pen` file. Color changes, spacing adjustments, font swaps — all propagate automatically.

What doesn't propagate: structural changes to a component (new states, layout changes, added elements). Those require re-copying the frame manually.

**The rule:** use token variables for everything visual. The components are the structure; the tokens are the skin. Token changes are free. Component structure changes are a manual copy-paste.

---

## Setting up a new flow file

### Step 1 — Create the file

Open a blank canvas in Pencil:

```sh
nib pencil open new
```

Pencil opens a blank file. Save it immediately (Cmd+S) to:

```
docs/design/screens/01-onboarding/onboarding.pen
```

### Step 2 — Push tokens into it

```sh
nib brand push docs/design/screens/01-onboarding/onboarding.pen
```

This sets all your brand variables in the new file — the same token values as `design-system.pen`. Now both files speak the same visual language.

### Step 3 — Copy components from the design system

With both `design-system.pen` and `onboarding.pen` open in Pencil:

1. Switch to `design-system.pen`
2. Select the component frames you need (Button, TextInput, etc.)
3. Copy (Cmd+C)
4. Switch to `onboarding.pen`
5. Paste (Cmd+V)

These pasted frames are your starting points. They already reference your brand token variables — you don't need to set any colors manually.

### Step 4 — Build your screens

One canvas per screen. One screen per state (don't put "Home - Empty" and "Home - Loaded" on the same canvas — they're different screens).

Use the component frames as building blocks:
- Arrange them on the canvas to form a screen layout
- Don't modify the internal structure of the component frames — use them as-is
- Use token variables for any additional elements you add (`{var.color-background-primary}` for backgrounds, `{var.spacing-md}` for gaps, etc.)

---

## Best practices

### Never use raw hex values

If you type a color value by hand, you've broken the token contract. Always reference a variable:

| ❌ Don't | ✅ Do |
|---|---|
| Fill: `#2563EB` | Fill: `{var.color-interactive-default}` |
| Text: `#111827` | Text: `{var.color-text-primary}` |
| Border: `#E5E7EB` | Border: `{var.color-border-primary}` |

Pencil's variable panel shows all available token variables. If you're unsure of the name, check `docs/design/system/build/pencil/variables.json` or ask Claude: *"What token should I use for a card background?"*

### Name canvases precisely

Vague canvas names make prototype navigation, handoff, and AI context worse.

| ❌ Vague | ✅ Precise |
|---|---|
| `Home` | `Home - Default` |
| `Login` | `Sign In - Error State` |
| `Screen 3` | `Verify Email - Sent` |

Pattern: `<Screen Name> - <State>`. States include: Default, Empty, Loading, Error, Success, Disabled.

### Match canvas size to target device

Set your canvas dimensions to match the device your flow targets. Use the standard sizes from `nib devices`:

| Target | Canvas size |
|---|---|
| iPhone 16 Pro | 393 × 852 |
| iPad Pro 11" | 834 × 1194 |
| Desktop | 1440 × 900 |

Consistent canvas sizes mean the prototype renders correctly in device frames without cropping or letterboxing.

### One flow per file, one screen per canvas

- `onboarding.pen` → Welcome, Sign Up, Verify Email, Done (4 canvases)
- `dashboard.pen` → Dashboard, Empty State, Loading, Notification Panel (4 canvases)

Don't put every screen in one file. It becomes slow, hard to navigate, and the prototype captures more than you want.

### Lock the component frames

After pasting component frames into your flow file, lock them in the layers panel (right-click → Lock). This prevents accidentally selecting and moving the base component when you're arranging screen content.

---

## When things change

### When your brand changes (tokens update)

Token changes have a cascade of consequences across design files, CSS, Tailwind, and code. See the **[Updating Tokens guide](/guide/updating-tokens)** for the full breakdown — change types, what auto-propagates, what requires manual code updates, and a step-by-step checklist.

The short version:

```sh
nib brand validate   # catch broken references first
nib brand build      # regenerate CSS, Tailwind, Pencil outputs
nib brand audit      # verify WCAG contrast still passes
nib brand push docs/design/system/design-system.pen
nib brand push docs/design/screens/01-onboarding/onboarding.pen
# ... repeat for each flow file
```

### When a component changes structurally

1. Update the component frame in `design-system.pen`
2. Identify which flow files use that component
3. In each flow file: delete the old copy, re-copy the updated frame from `design-system.pen`

This is the manual step that cross-file linking would eliminate. For now, keep component changes infrequent and deliberate — the component contract (in `.nib/components/*.contract.json`) is the authoritative spec, so even if copies drift slightly, the code implementation follows the contract, not the visual.

::: tip Minimize structural component changes
The more your components rely on token variables (not hardcoded values), the less often a "structural" change is truly necessary. Most design updates are token changes — and those propagate automatically.
:::

---

## Figma (roadmap)

Figma solves the cross-file linking limitation natively. Published component libraries let every flow file reference the live master component — update once, propagate everywhere.

nib's pipeline extends to Figma in two ways:

**Token pipeline — works today:**
nib already outputs DTCG tokens, which [Tokens Studio](https://tokens.studio) imports directly into Figma as variables. Run `nib brand build`, sync with Tokens Studio, and your Figma file has the same token values as your Pencil file.

**Capture pipeline — roadmap:**
The `nib capture` command currently reads from Pencil via MCP. A Figma adapter would use the Figma REST API instead — reading frames, components, and variables — and output the same `DesignDocument` JSON format. The `nib build` command would remain unchanged.

| Capability | Pencil today | Figma (roadmap) |
|---|---|---|
| Token push | ✅ `nib brand push` | ✅ via Tokens Studio |
| Component kit | ✅ `nib kit` | 🔜 `nib kit --figma` |
| Capture flow | ✅ `nib capture` | 🔜 `nib capture --figma` |
| Cross-file linking | ❌ manual copy | ✅ published libraries |
| Offline build | ✅ `nib build` | ✅ same pipeline |
