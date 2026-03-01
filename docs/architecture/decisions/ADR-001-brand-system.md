# ADR-001: nib brand — AI-Native Brand System Generator

**Status:** Proposed
**Date:** 2026-02-28
**Deciders:** Daniel Gomes

---

## Context

nib currently handles the *downstream* half of the design workflow:
`.pen file → captured JSON → interactive HTML prototype`.

Teams starting a new product face a harder problem *upstream*: taking raw brand guidelines (a PDF, a website, a markdown doc, or tribal knowledge in someone's head) and translating them into a consistent, WCAG-compliant, multi-platform design system. This work is tedious, error-prone, and currently requires either an expensive design system consultant or weeks of manual work.

There is no existing CLI tool that goes from "here are my brand colors and font" to "here is a complete design token system with dark mode, accessible contrast, semantic aliases, Tailwind config, and AI-agent context files ready to drop into any project."

The opportunity is to extend nib to own this upstream step, making it the full pipeline:

```
Brand Guidelines → Design Tokens → Pencil.dev Variables → .pen → HTML Prototype
```

Additionally, the rise of AI coding agents (Claude, Cursor, Copilot) creates a new artifact requirement: **brand context files** — structured markdown files that AI agents read before generating UI code, ensuring every generated component is on-brand. This is the analog of `CLAUDE.md` for design.

### Design Token Background

- The W3C Design Tokens Community Group (DTCG) specification reached stable status in October 2025. It defines a JSON format with `$value`, `$type`, `$description` keys.
- Style Dictionary v4 (Amazon, now community) is the standard build tool for transforming DTCG tokens into platform outputs (CSS, Tailwind, Swift, Kotlin, etc.).
- A complete token system requires three tiers: **primitive** (raw values), **semantic** (purpose-mapped aliases), **component** (scoped overrides). Brand guidelines typically provide only ~20% of what's needed — the rest must be algorithmically derived.

---

## Decision

Introduce `nib brand` as a new top-level command suite. Phase 1 implements:

1. **`nib brand init`** — AI-assisted intake of brand guidelines → generates a complete brand system
2. **`nib brand build`** — transforms DTCG token files into platform outputs (Phase 1: CSS + Tailwind)
3. **`nib brand push`** — syncs generated tokens as variables into a Pencil.dev `.pen` file via MCP
4. **`nib brand audit`** — checks all color token pairs against WCAG AA contrast requirements

### Input Sources (Phase 1)

| Source | How |
|---|---|
| Interactive prompts | `nib brand init` with no args → `@clack/prompts` guided Q&A |
| Markdown / text file | `nib brand init --from brand.md` |
| Website URL | `nib brand init --from https://acme.com` |
| PDF | `nib brand init --from brand.pdf` |

### AI Integration Architecture

nib is AI-provider-agnostic by design. Two modes:

**Standalone mode** — nib calls the LLM API directly.
- Provider selected via `--ai` flag or `NIB_AI_PROVIDER` env var: `anthropic` (default), `openai`, `ollama`
- API key via `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `NIB_AI_BASE_URL` (for Ollama/local)
- Defined via a `BrandAiProvider` interface — new providers implement the interface

**MCP server mode** — nib exposes brand tools as MCP endpoints.
- The calling AI agent (Claude Code, Cursor, etc.) drives the reasoning
- nib handles deterministic operations: color math, WCAG checking, file I/O, Style Dictionary builds
- Registered in the existing MCP server infrastructure

Both modes share the same `src/brand/` core logic. The CLI commands use standalone mode; MCP tools delegate to the same functions.

### Output Structure

```
.nib/
└── brand.config.json          ← structured brand config (machine-readable, tool state)

docs/design/system/            ← everything design-system (default, configurable via --output)
├── brand.md                   ← AI agent context file (THE primary artifact)
├── components.md              ← component styling rules
├── tokens/                    ← DTCG source token files (user-editable, version-controlled)
│   ├── color/
│   │   ├── primitives.tokens.json
│   │   ├── semantic-light.tokens.json
│   │   └── semantic-dark.tokens.json
│   ├── typography.tokens.json
│   ├── spacing.tokens.json
│   ├── border-radius.tokens.json
│   ├── elevation.tokens.json
│   └── motion.tokens.json
└── build/                     ← platform-specific built outputs (gitignore-able)
    ├── css/variables.css
    ├── tailwind/preset.js
    └── pencil/variables.json
```

### Token Architecture (DTCG format)

Three-tier system following the W3C DTCG specification:

**Tier 1 — Primitives** (`color/primitives.tokens.json`)
```json
{
  "color": {
    "blue": {
      "$type": "color",
      "50":  { "$value": "#eff6ff" },
      "500": { "$value": "#3b82f6" },
      "900": { "$value": "#1e3a8a" }
    }
  }
}
```

**Tier 2 — Semantic** (`color/semantic-light.tokens.json` + `semantic-dark.tokens.json`)
```json
{
  "color": {
    "background": { "primary": { "$value": "{color.white}", "$type": "color" } },
    "text": { "primary": { "$value": "{color.gray.900}", "$type": "color" } },
    "interactive": { "default": { "$value": "{color.blue.600}", "$type": "color" } }
  }
}
```

**Tier 3 — Component** — out of scope for Phase 1.

### Algorithmic Derivation Rules

**Color scale generation** (from 1-3 brand hex values):
1. Parse to HSL
2. Generate 11 steps (50, 100–900, 950): adjust lightness linearly, slightly reduce saturation at extremes
3. Generate neutral gray by desaturating the primary hue by 90%
4. Add feedback palette (success/green, warning/amber, error/red, info/blue)

**Semantic color mapping**:
- Light: backgrounds → gray.50/white, text → gray.900/600/400, interactive → brand.600
- Dark: flip scale positions, surfaces instead of shadows

**WCAG enforcement**:
- Compute contrast ratio for every text/background semantic pair
- Flag AA failures (< 4.5:1 normal text, < 3:1 large text/icons)
- Auto-adjust: shift failing token one step darker/lighter until it passes

**Type scale**: base 16px, ratio 1.25 (Major Third) for apps, 1.333 (Perfect Fourth) for marketing

**Spacing scale**: 4px base → `0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96`

### `brand.md` — AI Agent Context File

The primary artifact. Structured for LLM consumption with `<!-- nib-brand: v1 -->` tag for detection/regeneration.

### Style Dictionary Integration

Style Dictionary v4 for the `nib brand build` step. Pre-configured for CSS custom properties and Tailwind v3/v4 theme preset.

### Pencil.dev Integration (`nib brand push`)

Syncs semantic color tokens, typography tokens, and spacing tokens into a `.pen` file's variables via `withMcpClient` + MCP `set_variables` tool.

---

## Consequences

### Benefits

- **Closes the upstream gap**: nib becomes the full pipeline
- **Platform-agnostic output**: DTCG tokens + CSS + Tailwind work with any framework
- **AI agent multiplier**: `brand.md` means any LLM generates on-brand UI without bespoke prompting
- **WCAG by default**: contrast checking is algorithmic, not optional
- **Standard-compliant**: DTCG format ensures interop with Tokens Studio, Figma, Penpot, Specify

### Trade-offs

- **New runtime dependencies**: `style-dictionary`, `@anthropic-ai/sdk`, `openai`
- **AI API key required** for `init` in standalone mode (mitigated by MCP mode + interactive fallback)
- **Opinionated defaults**: 4px grid, Major Third type scale, specific semantic token names

### Out of Scope (Phase 1)

- iOS Swift/SwiftUI, Android Compose, React Native, Flutter outputs
- Component-level token tier (Phase 2)
- `screens.md` generation (Phase 2)
- Figma / Penpot import/export (Phase 3)
- CI/CD brand drift detection (Phase 6)

---

## Implementation Plan

### New Files

```
src/types/brand.ts
src/brand/index.ts
src/brand/intake/{interactive,markdown,url,pdf}.ts
src/brand/ai/{index,anthropic,openai}.ts
src/brand/tokens/{color,typography,spacing,elevation,motion,radius}.ts
src/brand/wcag.ts
src/brand/writer.ts
src/brand/build.ts
src/cli/commands/brand.ts
```

### Modified Files

```
src/cli/index.ts     ← register brandCommand
src/index.ts         ← re-export brand types + functions
package.json         ← add style-dictionary, @anthropic-ai/sdk, openai
```
