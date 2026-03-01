<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo/logo-stacked-light.svg">
    <img src="logo/logo-stacked-dark.svg" alt="nib" width="280">
  </picture>
</p>

<h3 align="center">Your Design Control Plane</h3>

<p align="center">
  One source of truth for your brand — design tokens, AI-agent context, and clickable prototypes in a single workflow.<br>
  Every AI that touches your UI builds on-brand by default.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/usenib"><img src="https://img.shields.io/npm/v/usenib?color=1B1F3B&labelColor=F69E0A&label=npm" alt="npm"></a>
  <a href="https://usenib.dev"><img src="https://img.shields.io/badge/docs-usenib.dev-1B1F3B" alt="Docs"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-1B1F3B" alt="License"></a>
</p>

---

## What is nib?

AI coding agents are great at writing UI — but they don't know your brand. They pick their own colors, invent spacing values, and ignore your design system. Every component needs fixing.

nib is the design control plane that closes that gap. It generates `brand.md` — a structured context file that Claude, Cursor, and any MCP-compatible agent reads before writing a single line of UI. It also turns brand guidelines into a complete DTCG token system and exports Pencil.dev designs into shareable HTML prototypes.

Two connected pipelines:

**Brand pipeline** — from guidelines to tokens, CSS, Tailwind, Pencil variables, and AI context:
```
Brand Guidelines → DTCG Tokens → CSS / Tailwind / Pencil Variables → brand.md
```

**Prototype pipeline** — from design files to shareable HTML:
```
Pencil.dev .pen → DesignDocument JSON → Clickable HTML Prototype
```

One source of truth. Every tool, teammate, and AI agent builds from the same system.

## Who Is This For?

**Software engineers and founders** building UI without a dedicated designer, and **UX designers** at small product teams who need tokens, prototypes, and handoff specs without ceremony.

→ [Full workflow guide](https://usenib.dev/guide/who-is-nib-for)

## Quick Start

```sh
npm install -g usenib
```

```sh
# Generate a brand system from your guidelines
nib brand init --from brand.md

# Or skip AI and derive tokens algorithmically
nib brand init --from brand.md --no-ai

# Check WCAG AA contrast compliance
nib brand audit

# Export a Pencil.dev file to a clickable prototype
nib prototype design.pen
```

## AI Agent Setup (MCP)

nib runs as an MCP server, giving Claude, Cursor, Windsurf, and any MCP-compatible agent direct access to all nib tools.

Add to your `.mcp.json` (Claude Code) or `.cursor/mcp.json` (Cursor):

```json
{
  "mcpServers": {
    "nib": {
      "command": "nib",
      "args": ["--mcp"]
    }
  }
}
```

Then ask your agent: *"Set up a nib brand system for my project. I don't have brand guidelines yet — interview me."*

See the [MCP Setup guide](https://usenib.dev/guide/mcp-setup) for full instructions.

## Features

- **AI Agents Build On-Brand** — generates `brand.md`, a structured context file any AI reads before writing UI
- **Brand System in Minutes** — 77+ DTCG tokens from a URL, PDF, or brief — color scales, dark mode, typography, spacing
- **WCAG Built In** — every color token pair checked against WCAG AA, with CI exit codes
- **Clickable Prototypes** — `.pen` → shareable HTML with hotspot navigation and device frames, no deploy needed
- **W3C Design Tokens** — DTCG format, compatible with Tokens Studio, Figma, Penpot, and any token-aware tool
- **Works With Your Stack** — CSS variables, Tailwind preset, shadcn/ui, Radix, Chakra, Mantine, MUI

## Documentation

Full guides, references, and walkthroughs at **[usenib.dev](https://usenib.dev)**.

| Guide | What it covers |
|---|---|
| [Getting Started](https://usenib.dev/guide/getting-started) | Installation, first brand system, first prototype |
| [Who Is nib For?](https://usenib.dev/guide/who-is-nib-for) | Solo builder vs UX designer workflows |
| [MCP Setup](https://usenib.dev/guide/mcp-setup) | Claude Code, Cursor, Windsurf configuration |
| [Brand System](https://usenib.dev/guide/brand) | Tokens, WCAG audit, AI enhancement, Pencil push |
| [Prototypes](https://usenib.dev/guide/prototypes) | Capture, build, device frames, hotspot navigation |
| [Framework Integration](https://usenib.dev/guide/framework-integration) | shadcn/ui, Tailwind, Radix, Chakra, Mantine, MUI |

## Contributing

Contributions are welcome. nib uses [Bun](https://bun.sh) as its runtime and test runner.

```sh
# Clone and install
git clone https://github.com/dcsg/nib.git
cd nib
bun install

# Run tests
bun test

# Type check
bun run typecheck

# Run the CLI directly (no build step needed)
bun src/cli/index.ts --help
```

Before making architectural changes, read the ADRs in `docs/architecture/decisions/` and invariants in `docs/architecture/invariants/`. Open an issue first for significant changes so we can align on approach before you invest time in a PR.

PRs should:
- Pass `bun run typecheck` and `bun test`
- Include tests for new behaviour (see `INV-007` in `docs/architecture/invariants/`)
- Not break the `DesignDocument` contract or the DTCG token format

## License

[AGPL-3.0](LICENSE) — free to use, modify, and distribute under the same license.
