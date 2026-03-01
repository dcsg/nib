# Getting Started

## Which one are you?

::: info Solo product builder
Building a product alone — no dedicated designer. You want consistent UI without maintaining a sprawling CSS file. → [Your path](/guide/who-is-nib-for#the-solo-product-builder)
:::

::: info UX designer at a product team
You have an existing Pencil design system. You need DTCG tokens, component specs, clickable prototypes, and WCAG reports for dev handoff. → [Your path](/guide/who-is-nib-for#the-ux-designer-at-a-product-team)
:::

::: info Using an AI coding agent
You're using [Claude Code](https://claude.ai/code?utm_source=nib&utm_medium=docs), [Cursor](https://cursor.com?utm_source=nib&utm_medium=docs), or another MCP-compatible agent to generate UI. nib's MCP server gives it brand context, component specs, and validation tools. → [Your path](/guide/who-is-nib-for)
:::

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ or [Bun](https://bun.sh/) 1.0+
- [Pencil.app](https://pencil.dev?utm_source=nib&utm_medium=docs) — only needed for commands that read or write `.pen` files (`capture`, `brand push`, `brand import`). Token generation and prototype building from a snapshot are fully offline.

## Installation

::: code-group

```sh [npm]
npm install -g usenib
```

```sh [bun]
bun install -g usenib
```

```sh [pnpm]
pnpm add -g usenib
```

:::

## Two Workflows

nib has two main workflows. You can use them independently or together.

### 1. Brand System — from guidelines to design tokens

Generate a complete design token system from your brand guidelines:

```sh
# Interactive — guided prompts for colors, fonts, personality
nib brand init

# From a file — extract brand values from a markdown document
nib brand init --from brand-guidelines.md

# From a website — pull colors and fonts from a live URL
nib brand init --from https://your-company.com
```

::: tip No AI key? Use --no-ai
By default, `nib brand init` uses [Anthropic](https://www.anthropic.com?utm_source=nib&utm_medium=docs) (`ANTHROPIC_API_KEY`). nib also supports [OpenAI](https://openai.com?utm_source=nib&utm_medium=docs) and local [Ollama](https://ollama.ai?utm_source=nib&utm_medium=docs) — see the [AI Enhancement section](/guide/brand#ai-enhancement) for all providers. Or skip AI entirely and still get 77+ tokens from pure algorithmic derivation:

```sh
nib brand init --from brand.md --no-ai
```
:::


This generates:
- **Design tokens** (W3C DTCG format) — color primitives, semantic light/dark themes, typography, spacing, elevation, motion
- **CSS custom properties** + **Tailwind preset** — ready to drop into any project
- **`brand.md`** — a structured context file that AI coding agents read to generate on-brand UI
- **WCAG audit** — every color pair checked for AA contrast compliance

See the [Brand System guide](/guide/brand) for details.

### 2. Prototypes — from design to interactive HTML

Export Pencil.dev `.pen` files to clickable HTML prototypes:

```sh
nib prototype my-design.pen
```

This runs the full pipeline: captures the design via the Pencil MCP server, then builds the HTML output into `./prototype/`.

::: warning Pencil open required
`nib prototype` (and `nib capture`, `nib dev`) need Pencil.app running with the file open. `nib build` works fully offline from a `.design.json` snapshot.
:::

## Choose a Template

nib ships with two prototype templates:

```sh
# Minimal — great for handoff and review
nib prototype my-design.pen --template clean

# Slide-style — keyboard navigation and transitions
nib prototype my-design.pen --template presentation
```

See the [Templates guide](/templates/) for a visual comparison.

## Add a Device Frame

Wrap your prototype in a realistic device frame:

```sh
nib prototype my-design.pen --device "iPhone 16 Pro"
```

Run `nib devices` to see all available frames.

## Dev Mode

Start a local dev server that watches for `.pen` file changes and hot-reloads:

```sh
nib dev my-design.pen
```

The server starts at `http://localhost:3142` and opens your browser automatically.

## Connect the Pipelines

The brand system and prototype pipeline work together. After generating tokens, push them into your `.pen` file:

```sh
# Generate brand system
nib brand init --from brand.md

# Push tokens into your Pencil.dev file
nib brand push my-design.pen

# Export the prototype with brand-consistent variables
nib prototype my-design.pen
```
