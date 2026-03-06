# Brand System

nib's brand system turns raw brand guidelines into a production-ready design token system — complete with dark mode, WCAG-compliant contrast, platform outputs, and AI-agent context files.

## How It Works

```
Brand Input → Algorithmic Derivation → DTCG Tokens → Platform Outputs
     ↓                                                       ↓
  (colors,                                            CSS variables
   fonts,                                          Tailwind preset
   personality)                                  Pencil.dev variables
     ↓                                                       ↓
 AI Enhancement (optional)                           brand.md
                                                  components.md
                                                         ↓
                                              Style Guide Bridge
                                            (-- standard variables)
                                                         ↓
                                              Pencil style guides
                                              "just work" on-brand
```

From 1-3 hex colors and a font name, nib algorithmically generates:

- **77+ color tokens** — 11-step scales for brand, neutral, success, warning, error, info (+ optional secondary/accent)
- **Semantic themes** — light and dark mode with proper contrast
- **Typography scale** — 9 roles from caption to display, 4px line-height grid
- **Spacing, radius, elevation, motion** — complete token sets
- **Sizing** — icon, component, container, and touch-target dimensions
- **Border width, opacity, z-index** — interaction and layout primitives
- **Breakpoints** — responsive design from `xs` (0px) to `2xl` (1536px)

## Quick Start

::: tip No AI key? Use --no-ai
By default, `nib brand init` calls [Anthropic](https://www.anthropic.com?utm_source=nib&utm_medium=docs) (`ANTHROPIC_API_KEY`). nib also supports [OpenAI](https://openai.com?utm_source=nib&utm_medium=docs) and local [Ollama](https://ollama.ai?utm_source=nib&utm_medium=docs) — see [AI Enhancement](#ai-enhancement) below for all providers. Or skip AI entirely with `--no-ai` — pure algorithmic derivation, no API key required.
:::

```sh
# Interactive prompts (AI-enhanced by default — needs ANTHROPIC_API_KEY)
nib brand init

# From a markdown file — no API key needed
nib brand init --from brand-guidelines.md --no-ai

# From a live website — no API key needed
nib brand init --from https://your-company.com --no-ai

# From a PDF
nib brand init --from brand-guide.pdf --no-ai

# From a Tokens Studio JSON export (Figma-first teams)
nib brand init --from tokens.json --no-ai
```

## Creating a Brand Brief

`nib brand init --from` reads a plain Markdown file. You don't need to follow a strict schema — nib extracts whatever it finds — but this template gives it the best signal:

```markdown
# Brand Brief — Acme Corp

## Identity
Brand name: Acme Corp
Tagline: Build faster, ship smarter
Audience: Early-stage startup founders and indie developers

## Personality
Keywords: professional, minimal, technical
Tone: Direct and confident. No fluff. Speak to builders, not executives.

## Colors
Primary: #2563EB        (brand blue — interactive elements, CTAs)
Secondary: #7C3AED      (accent violet — highlights, badges)
Neutral base: #111827   (near-black for text and dark surfaces)

## Typography
Heading font: Inter
Body font: Inter
Code font: JetBrains Mono

## Notes
- Prefer cool tones over warm
- Keep UI density medium — not sparse, not cluttered
- Error states use red (#DC2626), success uses green (#16A34A)
```

Copy this, fill in your values, and save it as `brand.md` in your project root. Then:

```sh
nib brand init --from brand.md
```

::: tip Using an AI coding agent?
Ask your agent to interview you: *"Set up a nib brand system. I don't have brand guidelines yet — interview me."* The agent will ask about your colors, font, and personality one step at a time, then run `nib_brand_init` → `nib_brand_audit` → `nib_brand_push` automatically. Works with Claude Code, Cursor, Windsurf, and any MCP-compatible agent — see [MCP Setup](/guide/mcp-setup).
:::

## Input Sources

| Source | Command | What It Extracts |
|---|---|---|
| Interactive | `nib brand init` | Guided prompts for every value |
| Markdown / text | `--from file.md` | Hex colors, font names, brand name, personality keywords |
| Website URL | `--from https://...` | CSS colors, font families, Google Fonts, meta tags |
| PDF | `--from guide.pdf` | Text content, hex colors, font references |
| Tokens Studio | `--from tokens.json` | All color tokens (ranked by semantic signal), font families, brand name |

## Output Structure

```
.nib/
└── brand.config.json              ← tool config (paths, AI prefs)

docs/design/system/                ← configurable via --output
├── brand.md                       ← AI agent context file
├── components.md                  ← component styling rules
├── tokens/
│   ├── color/
│   │   ├── primitives.tokens.json
│   │   ├── semantic-light.tokens.json
│   │   └── semantic-dark.tokens.json
│   ├── typography.tokens.json
│   ├── spacing.tokens.json
│   ├── border-radius.tokens.json
│   ├── elevation.tokens.json
│   ├── motion.tokens.json
│   ├── sizing.tokens.json
│   ├── border-width.tokens.json
│   ├── opacity.tokens.json
│   ├── z-index.tokens.json
│   └── breakpoints.tokens.json
└── build/
    ├── css/variables.css
    ├── tailwind/preset.js
    └── pencil/variables.json
```

The `tokens/` directory is the source of truth — user-editable, version-controlled, compatible with [Tokens Studio](https://tokens.studio?utm_source=nib&utm_medium=docs), [Figma](https://figma.com?utm_source=nib&utm_medium=docs), and any DTCG-compliant tool.

The `build/` directory contains generated platform outputs — rebuild anytime with `nib brand build`.

## Token Architecture

nib follows the [W3C DTCG (Design Tokens Community Group) specification](https://design-tokens.github.io/community-group/format/?utm_source=nib&utm_medium=docs) with a three-tier system:

### Tier 1 — Primitives

Raw values. An 11-step scale (50, 100–900, 950) for each color:

```json
{
  "color": {
    "$type": "color",
    "brand": {
      "500": { "$value": "#3b82f6" },
      "600": { "$value": "#2563eb" }
    }
  }
}
```

### Tier 2 — Semantic

Purpose-mapped aliases that reference primitives:

```json
{
  "color": {
    "interactive": {
      "default": { "$value": "{color.brand.600}", "$type": "color" }
    },
    "text": {
      "primary": { "$value": "{color.neutral.900}", "$type": "color" }
    }
  }
}
```

Light and dark themes use different semantic mappings over the same primitives.

### Tier 3 — Component (Phase 2)

Scoped overrides per component (buttons, cards, inputs). Coming in a future release.

### Sizing, Layout & Interaction Tokens

Beyond color and typography, nib generates a full set of layout and interaction primitives:

#### Sizing

Icon, component, container, and touch-target dimensions:

```json
{
  "sizing": {
    "$type": "dimension",
    "icon": {
      "sm": { "$value": "16px" },
      "md": { "$value": "20px" },
      "lg": { "$value": "24px" },
      "xl": { "$value": "32px" },
      "2xl": { "$value": "40px" }
    },
    "component": {
      "xs": { "$value": "24px" },
      "sm": { "$value": "32px" },
      "md": { "$value": "40px" },
      "lg": { "$value": "48px" },
      "xl": { "$value": "56px" }
    },
    "container": {
      "sm": { "$value": "640px" },
      "md": { "$value": "768px" },
      "lg": { "$value": "1024px" },
      "xl": { "$value": "1280px" },
      "2xl": { "$value": "1536px" }
    },
    "touchTarget": { "$value": "44px" }
  }
}
```

#### Border Width

Stroke widths for borders and dividers:

```json
{
  "borderWidth": {
    "$type": "dimension",
    "none": { "$value": "0px" },
    "thin": { "$value": "1px" },
    "default": { "$value": "1px" },
    "thick": { "$value": "2px" },
    "thicker": { "$value": "4px" }
  }
}
```

#### Opacity

Interaction and state opacity values:

```json
{
  "opacity": {
    "$type": "number",
    "disabled": { "$value": 0.38 },
    "hover": { "$value": 0.08 },
    "pressed": { "$value": 0.12 },
    "overlay": { "$value": 0.5 },
    "loading": { "$value": 0.3 }
  }
}
```

#### Z-Index

Stacking order scale from hidden to overlay:

```json
{
  "zIndex": {
    "$type": "number",
    "hide": { "$value": -1 },
    "base": { "$value": 0 },
    "dropdown": { "$value": 1000 },
    "sticky": { "$value": 1100 },
    "fixed": { "$value": 1200 },
    "modalBackdrop": { "$value": 1300 },
    "modal": { "$value": 1400 },
    "popover": { "$value": 1500 },
    "tooltip": { "$value": 1600 },
    "overlay": { "$value": 1700 }
  }
}
```

#### Breakpoints

Responsive design breakpoints matching common device widths:

```json
{
  "breakpoint": {
    "$type": "dimension",
    "xs": { "$value": "0px" },
    "sm": { "$value": "480px" },
    "md": { "$value": "768px" },
    "lg": { "$value": "1024px" },
    "xl": { "$value": "1280px" },
    "2xl": { "$value": "1536px" }
  }
}
```

## Pencil Style Guide Bridge

When you push tokens to a `.pen` file, nib automatically creates **`--` standard variables** — a set of well-known variable names that Pencil style guides reference. This means any Pencil style guide you apply will use your brand tokens by default.

### How It Works

Pencil style guides reference standard `--` variables (e.g., `--background`, `--primary`, `--foreground`) in their component fills and strokes. When nib pushes tokens, it maps your semantic tokens to these standard names so designs "just work" with your brand.

::: tip Variable naming convention
Variable **key names** are plain strings without a `$` prefix: `--background`, `--primary`, etc. The `$` is only used in design property **values** as a reference sigil — e.g. a fill set to `"$--background"` looks up the variable named `--background`. See ADR-005 in `docs/architecture/decisions/` for the full convention.
:::

### Key Mappings

| Pencil Variable | nib Token | Category |
|---|---|---|
| `--background` | `color-background-primary` | Background |
| `--surface` | `color-surface-primary` | Background |
| `--foreground` | `color-text-primary` | Text |
| `--foreground-secondary` | `color-text-secondary` | Text |
| `--primary` | `color-interactive-default` | Brand |
| `--primary-hover` | `color-interactive-hover` | Brand |
| `--primary-foreground` | `color-text-inverse` | Brand |
| `--error` | `color-feedback-error` | Feedback |
| `--border` | `color-border-primary` | Border |
| `--font-primary` | `font-family-sans` | Typography |
| `--space-m` | `spacing-md` | Spacing |
| `--radius-m` | `border-radius-md` | Radius |

The full bridge maps 27 standard variables across backgrounds, text, interactive, feedback, border, typography, spacing, and radius categories.

Color variables that differ between light and dark mode are pushed as **themed arrays** — Pencil automatically creates a `mode` axis with `light` and `dark` values and resolves the correct value per frame. See [Theming & Dark Mode](/guide/theming) for full details.

### Using `brand style`

Fetch and apply a Pencil style guide that's pre-wired to your brand tokens:

```sh
# List available style guide tags
nib brand style

# Fetch a style guide by tags and push to your .pen file
nib brand style --tags minimal,webapp,developer

# Fetch a specific style guide by name
nib brand style --name "Modern Dashboard"
```

The fetched style guide components use `$--` reference syntax in their fill and stroke values (e.g. `fill: "$--background"`), which resolve to the `--background` variable you pushed — your brand colors, typography, and spacing, automatically.

## Try It Yourself

::: info Running from source vs installed
The steps below use `bun src/cli/index.ts` — this is the **in-repo dev path** for contributors running nib directly from source. If you installed nib globally (`npm install -g usenib`), replace `bun src/cli/index.ts` with `nib` in every command.
:::

Run this walkthrough inside the nib repo — no external setup needed.

### 1. Initialize a brand system

```sh
bun src/cli/index.ts brand init --from docs/design/system/brand-guidelines.md --no-ai
```

This reads the sample brand guidelines and generates all token files under `docs/design/system/`.

### 2. Inspect the new token files

```sh
cat docs/design/system/tokens/sizing.tokens.json
cat docs/design/system/tokens/opacity.tokens.json
cat docs/design/system/tokens/z-index.tokens.json
```

You'll see the DTCG-formatted JSON for each token type.

### 3. Build platform outputs

```sh
bun src/cli/index.ts brand build
```

Check the CSS output for new tokens:

```sh
grep "sizing\|opacity\|z-index\|border-width\|breakpoint" docs/design/system/build/css/variables.css
```

### 4. Run the WCAG audit

```sh
bun src/cli/index.ts brand audit
```

All semantic color pairs are checked for AA contrast compliance.

### 5. List style guide tags

```sh
bun src/cli/index.ts brand style
```

Prints available Pencil style guide tags you can use.

### 6. Fetch a style guide

```sh
bun src/cli/index.ts brand style --tags minimal,webapp,developer
```

Fetches a matching style guide and pushes it (with `--` standard variable mappings) to your `.pen` file.

::: warning MCP Required
Steps 5–6 require a running Pencil.dev instance with its MCP server accessible. Steps 1–4 work fully offline.
:::

### 7. Push tokens directly

```sh
bun src/cli/index.ts brand push my-design.pen
```

Pushes all nib tokens plus `--` standard variables to the `.pen` file.

### 8. Inspect the Tailwind preset

```sh
cat docs/design/system/build/tailwind/preset.js
```

The preset now includes `sizing`, `borderWidth`, `opacity`, `zIndex`, and `screens` (breakpoints) keys alongside colors, typography, and spacing.

## WCAG Audit

Check every text/background token pair for contrast compliance:

```sh
nib brand audit
```

```
WCAG Contrast Audit
────────────────────────────────────────────────────────────
  ✓ 12.48:1  color.text.primary / color.background.primary
  ✓ 11.66:1  color.text.primary / color.background.secondary
  ✓  5.00:1  color.text.secondary / color.background.primary
  ✗  2.45:1  color.text.tertiary / color.background.primary
────────────────────────────────────────────────────────────
  8 passed, 3 failed out of 11 pairs
```

The audit exits with code 1 if any pair fails [WCAG AA](https://www.w3.org/TR/WCAG21/?utm_source=nib&utm_medium=docs) — use it in CI to catch regressions.

## AI Enhancement

By default, `nib brand init` attempts to enhance the generated system with AI — richer brand descriptions, contextual color usage rules, and component patterns for `brand.md`.

AI is **optional**. Skip it with `--no-ai`:

```sh
nib brand init --from brand.md --no-ai
```

nib is AI-provider-agnostic. Choose any provider with `--ai`:

| Provider | Flag | Env var required |
|---|---|---|
| [Anthropic](https://www.anthropic.com?utm_source=nib&utm_medium=docs) (default) | `--ai anthropic` | `ANTHROPIC_API_KEY` |
| [OpenAI](https://openai.com?utm_source=nib&utm_medium=docs) | `--ai openai` | `OPENAI_API_KEY` |
| [Ollama](https://ollama.ai?utm_source=nib&utm_medium=docs) (local, no key) | `--ai ollama` | `NIB_AI_BASE_URL` (e.g. `http://localhost:11434`) |

```sh
# Use OpenAI instead of Anthropic
OPENAI_API_KEY=sk-... nib brand init --from brand.md --ai openai

# Use a local Ollama instance — no API key needed
NIB_AI_BASE_URL=http://localhost:11434 nib brand init --from brand.md --ai ollama
```

## Push to [Pencil.dev](https://pencil.dev?utm_source=nib&utm_medium=docs)

Sync generated tokens into a `.pen` file's variables:

```sh
nib brand push my-design.pen
```

This opens the `.pen` file via MCP and sets all nib tokens (color, typography, spacing, sizing, border-width, opacity, z-index, breakpoints) as Pencil.dev variables — plus `--` standard variable mappings so any Pencil style guide works with your brand out of the box.

## Rebuild Platform Outputs

After editing token files manually, rebuild the platform outputs:

```sh
nib brand build
```

This regenerates `css/variables.css`, [`tailwind/preset.js`](/guide/framework-integration), and `pencil/variables.json` from the token source files.

## `brand.md` — The AI Context File

The primary artifact for AI coding agents. It's a structured markdown file that any LLM can read before generating UI:

```markdown
# Brand System — Acme Corp
<!-- nib-brand: v1 | generated: 2026-02-28 | do not edit manually -->

## Identity
...personality, visual direction...

## Color
...semantic token usage rules...

## Typography
...scale, hierarchy, line-height rules...

## Spacing
...base unit, when to use which step...

## Components
...button, card, form, badge patterns...
```

After `nib brand init`, nib automatically injects a `## nib Brand System` section into every AI agent config file it finds in your project — `CLAUDE.md`, `.cursorrules`, `.windsurfrules`, `.github/copilot-instructions.md`, and `.cursor/rules/nib.md` — and always creates `AI_CONTEXT.md` as a universal fallback.

Every future agent session — Claude, Cursor, Windsurf, Copilot, or any tool that reads project context — builds on-brand by default, without you prompting it every time.

## Next Steps

- [Theming & Dark Mode](/guide/theming) — how light/dark mode works in CSS and Pencil.dev, and how to apply themes to frames
- [Framework Integration](/guide/framework-integration) — using the Tailwind preset and CSS variables with shadcn/ui, Radix, Chakra, and more
- [Updating Tokens](/guide/updating-tokens) — editing token files and rebuilding platform outputs
