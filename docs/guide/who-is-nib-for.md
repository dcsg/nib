# Who Is nib For?

nib serves two types of people. Each has two ways to use it: hand the work to an AI coding agent (recommended), or run the CLI yourself.

- **The Solo Product Builder** — a software engineer, founder, or indie hacker building and designing without a dedicated designer
- **The UX Designer at a Product Team** — a designer who needs tokens, prototypes, and handoff specs that developers can actually use

---

## The Solo Product Builder

**You're building a product alone — no dedicated designer.** You're a software engineer, indie hacker, solo founder, or product person shipping UI yourself. You want consistent, professional-looking screens without hiring a designer or drowning in CSS.

::: info New to design?
Read the **[Design for Builders guide](/guide/design-for-builders)** first — it covers the concepts, vocabulary, and step-by-step process for creating UX flows and UI screens that work. No design background needed.
:::

**Without nib:**
- You guess at color scales and spacing values
- Every AI-generated component uses hardcoded hex values that don't match anything else
- Your "prototype" is a Loom video of you clicking through Pencil
- Accessibility is an afterthought — if it happens at all

::: warning Prerequisites
- **[Pencil.app](https://pencil.dev?utm_source=nib&utm_medium=docs) must be installed and running** before any command that reads or writes a `.pen` file. Run `nib pencil status` to confirm.
- No `.pen` file needed upfront — `nib brand push` creates `docs/design/system/design-system.pen` automatically on first run.
- An AI API key is optional — `--no-ai` gives you 77+ tokens with no key required.
:::

::::tabs
== AI agent (recommended)
Open any AI coding agent in your project — [Claude Code](https://claude.ai/code?utm_source=nib&utm_medium=docs), [Cursor](https://cursor.com?utm_source=nib&utm_medium=docs), [Windsurf](https://codeium.com/windsurf?utm_source=nib&utm_medium=docs), or any agent that supports MCP. The nib MCP server connects automatically when configured.

**Step 1 — Let the agent interview you and set up your brand system.**

> "Set up a nib brand system for my project. I don't have brand guidelines yet — interview me."

Claude asks one question at a time (name, primary color, font, personality, audience), writes `brand.md`, then runs `nib_brand_init` → `nib_brand_validate` → `nib_brand_audit` in sequence.

**Step 2 — Push tokens into Pencil.**

> "Push the brand tokens into my Pencil file."

Claude calls `nib_brand_push`. **If `design-system.pen` doesn't exist yet, nib creates it automatically and opens it in Pencil — just hit Cmd+S to save.**

**Step 3 — Draw components into Pencil.**

Tell the agent which mode you want:

> **"Scaffold the nib component kit in my Pencil file."** → full pipeline (developer handoff / design system docs)
>
> **"Design a component library for [your product] with real copy and multiple variants."** → hybrid mode (stakeholder review / product flows)

**Full pipeline** (`nib_kit_bootstrap`): Claude scaffolds all 12 components with token-wired ops in one call. Output is a generic, single-variant, English-placeholder library — great for developer handoff and design system documentation. Use this as a starting scaffold to copy-and-customise.

**Hybrid mode** (skip `nib_kit_bootstrap` components): Claude draws components directly in Pencil using `batch_design` with brand-specific copy, multiple variants (e.g. a green eco CTA alongside the primary blue one), and product-realistic content. Requires more calls but produces stakeholder-ready output.

**The sweet spot:** run `nib_kit_bootstrap` once for the foundations (color palette, type scale, spacing scale), then skip its component ops and design components manually. See [ADR-009](/guide/adr-009) for the full two-mode workflow decision.

**Step 4 — Design your screens.**

Open Pencil and create UX flow files under `docs/design/screens/`. Use the component kit frames and token variables (e.g. `{var.color-interactive-default}`) to build each screen. See the [Project Structure guide](/guide/project-structure) for how to organise your files.

**Step 5 — Export a clickable prototype.**

> "Build a prototype from my onboarding flow."

Claude calls `nib_capture` on your screen file, asks which elements link to which screens, then calls `nib_build_prototype` with hotspots wired.

**What you get:** a shareable `prototype/index.html` — no deploy, no server. Every AI-generated component reads `brand.md` and stays on-brand automatically.

== CLI
::: warning Pencil.app must be running
Open Pencil.app before running any command that reads or writes `.pen` files. Check the connection with `nib pencil status`.
:::

```sh
# 1. Write your brand brief, then generate tokens
#    See "Creating a Brand Brief" in the Brand System guide
nib brand init --from brand.md --no-ai   # drop --no-ai if you have an API key

# 2. Push tokens into Pencil
#    First time: automatically creates design-system.pen and opens it
#    → Save in Pencil (Cmd+S) before continuing
nib brand push

# 3. Scaffold the component kit in Pencil  ← CRITICAL
nib kit --recipe --json
# → Returns component frames with brand variables pre-wired
# → Ask Claude: "Draw the nib component kit in my Pencil file using this recipe"
# → You now have Button, TextInput, Dialog, etc. inside design-system.pen

# 4. Design your screens in Pencil
#    - Use component kit frames from design-system.pen
#    - Use token variables (e.g. {var.color-interactive-default}) for fills
#    - Organise flows under docs/design/screens/ — see Project Structure guide

# 5. Capture and build the prototype
nib capture docs/design/screens/01-onboarding/onboarding.pen \
  -o docs/design/screens/01-onboarding/onboarding.design.json
nib build docs/design/screens/01-onboarding/onboarding.design.json \
  --config nib.config.json --standalone -o prototype/
```

**What you get:** a shareable prototype at `prototype/index.html` — no deploy, no server. Commit `onboarding.design.json` so CI can rebuild without Pencil.

::: tip No AI key required
`nib brand init --no-ai` uses algorithmic derivation — 77+ tokens from your colors and font, no API key needed.
:::
::::

---

## The UX Designer at a Product Team

**You're a designer at a startup or scale-up.** You have an existing Pencil design system — tokens already in the file, components already designed. The problem isn't creating a system, it's connecting it to code and getting a prototype into stakeholders' hands without a deploy.

**Without nib:**
- Your tokens exist in Pencil but nowhere else — no single source of truth
- Developers implement components with the wrong values because there's no spec
- Sharing a prototype means recording a Loom or handing over a Figma link
- WCAG checks are manual, done in a separate tool, and usually skipped at deadline

::: warning Prerequisites
- **Pencil.app must be running with your `.pen` file open** before import or capture commands. Run `nib pencil status` to confirm the connection.
- Your existing Pencil file path — typically `docs/design/system/design-system.pen`.
:::

::::tabs
== AI agent (recommended)
Open any AI coding agent in your project — [Claude Code](https://claude.ai/code?utm_source=nib&utm_medium=docs), [Cursor](https://cursor.com?utm_source=nib&utm_medium=docs), [Windsurf](https://codeium.com/windsurf?utm_source=nib&utm_medium=docs), or any agent that supports MCP. The nib MCP server reads your Pencil file live.

**Step 1 — Import your existing Pencil tokens.**

> "Import my Pencil design system tokens from docs/design/system/design-system.pen"

Claude calls `nib_brand_import`. This reads all your live Pencil variables, creates [DTCG token files](/guide/brand#token-architecture) under `docs/design/system/tokens/`, and writes `.nib/brand.config.json`.

**Step 2 — Scaffold component contracts.**

> "Create component contracts for Button, Dialog, and TextInput."

Claude calls `nib_component_init` for each — wiring token slots, interactive states, and ARIA keyboard patterns into `.nib/components/*.contract.json`.

**Step 3 — Use the kit recipe as a reference.**

> "Show me the nib component kit recipe for my design system."

Claude calls `nib_kit`, returning component frame ops and placement coordinates for each component. Use this as a reference when designing new screens.

**Step 4 — Audit before every handoff.**

> "Run a WCAG contrast audit on my brand tokens."

Claude calls `nib_brand_audit` and reports every failing color pair with a concrete fix suggestion — AA ratio, which tokens are involved, suggested adjustments.

**Step 5 — Build a clickable prototype.**

> "Build a prototype from ux-flow.pen and wire up the navigation between screens."

Claude calls `nib_capture` (Pencil must be open with the file), lists all canvases, asks which elements link to which screens, then calls `nib_build_prototype` with all hotspots wired.

**What you get:** [DTCG token files](/guide/brand#token-architecture) developers consume directly, component specs with exact token slots and ARIA states, a WCAG report for every handoff, and a clickable prototype anyone opens in a browser.

== CLI
::: warning Pencil.app must be running
Open Pencil.app with your design file before import or capture commands.
:::

```sh
# 1. Import your existing Pencil variables into DTCG token files
#    Pencil must be open with the file active
nib brand import docs/design/system/design-system.pen

# 2. Define component contracts — token bindings, states, ARIA patterns
nib component init Button
nib component init Dialog
nib component init TextInput

# 3. Get the kit recipe — use as reference when designing screens
nib kit --recipe --json
# → Returns token bindings and placement hints per component

# 4. Audit WCAG contrast before every handoff
nib brand audit

# 5. Organise UX flow files under docs/design/screens/
#    See the Project Structure guide for conventions and README template

# 6. Capture and build the prototype
nib capture docs/design/screens/01-ux-flow/ux-flow.pen \
  -o docs/design/screens/01-ux-flow/ux-flow.design.json
nib build docs/design/screens/01-ux-flow/ux-flow.design.json \
  --config nib.config.json -o prototype/
```

**`nib.config.json`** wires up the hotspot navigation:

```json
{
  "links": [
    { "from": "Dashboard", "nodeId": "btn-settings", "to": "Settings", "transition": "slide-left" },
    { "from": "Settings",  "nodeId": "btn-back",     "to": "Dashboard", "transition": "slide-right" }
  ]
}
```

::: tip Rebuild without Pencil
Once you've captured a snapshot, `nib build` is fully offline. Iterate on templates, device frames, and hotspot links without re-opening Pencil.
:::
::::

---

## Which commands matter for you?

| Command | Solo builder | UX designer |
|---|---|---|
| `nib brand init` | ✅ Start here | — |
| `nib brand import` | — | ✅ Start here |
| `nib brand build` | ✅ | ✅ |
| `nib brand push` | ✅ | ✅ |
| `nib kit` | ✅ | ✅ reference |
| `nib brand audit` | ✅ | ✅ |
| `nib brand validate` | — | ✅ |
| `nib component init` | — | ✅ |
| `nib capture` | ✅ | ✅ |
| `nib build` | ✅ | ✅ |
| `nib pencil open` | ✅ first run | ✅ |
| `nib pencil status` | ✅ check connection | ✅ check connection |
| `nib doctor` | ✅ troubleshoot | ✅ |

**AI agent equivalents:** `nib_brand_init`, `nib_brand_import`, `nib_brand_push`, `nib_brand_audit`, `nib_brand_validate`, `nib_kit`, `nib_component_init`, `nib_capture`, `nib_build_prototype` — all available as MCP tools in any MCP-compatible agent ([Claude Code](https://claude.ai/code?utm_source=nib&utm_medium=docs), [Cursor](https://cursor.com?utm_source=nib&utm_medium=docs), [Windsurf](https://codeium.com/windsurf?utm_source=nib&utm_medium=docs), and more).
