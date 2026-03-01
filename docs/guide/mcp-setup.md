# MCP Setup

nib runs as an [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server, giving AI coding agents direct access to all nib tools — brand init, WCAG audit, prototype build, kit generation, and more — without typing commands in a terminal.

When an agent has the nib MCP configured, it can:
- Interview you about your brand and run `nib_brand_init` automatically
- Push tokens into Pencil with `nib_brand_push`
- Build a prototype with `nib_build_prototype` and wire up hotspot navigation
- Run `nib_brand_audit` and report WCAG failures before every handoff

This is the recommended way to use nib — see [Who Is nib For?](/guide/who-is-nib-for) for the full AI-agent workflow.

---

## Prerequisites

Install nib globally:

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

Confirm the install:

```sh
nib --version
```

---

## Claude Code

Add a `.mcp.json` file to your project root:

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

**Restart Claude Code** after saving the file — project MCP configs are only read on session start. Then type `/mcp` to confirm nib appears in the server list under **Project MCPs**.

---

## Cursor

Add to `.cursor/mcp.json` in your project root (create the file if it doesn't exist):

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

Restart [Cursor](https://cursor.com?utm_source=nib&utm_medium=docs) after saving the file.

---

## Windsurf

Add to `.windsurf/mcp.json` in your project root (create the file if it doesn't exist):

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

Restart [Windsurf](https://codeium.com/windsurf?utm_source=nib&utm_medium=docs) after saving the file.

---

## Verify it works

Ask your agent: *"What nib tools do you have available?"*

It should list the 12 nib MCP tools. If it doesn't, check that:

1. `nib` is on your system `PATH` — run `nib --version` in a terminal to confirm
2. The config file (`.mcp.json` or equivalent) is in your project root
3. Your agent was restarted after the config was saved

---

## Available tools

| Tool | What it does | Who uses it |
|---|---|---|
| `nib_brand_init` | Generate a brand system from a brief, URL, PDF, or interactive prompts | Both |
| `nib_brand_build` | Rebuild CSS variables, Tailwind preset, and Pencil variables from token files | Both |
| `nib_brand_push` | Push all nib tokens into a `.pen` file as Pencil variables | Both |
| `nib_brand_import` | Import existing Pencil variables into DTCG token files | UX designer |
| `nib_brand_audit` | WCAG contrast audit — reports every failing token pair with fix suggestions | Both |
| `nib_brand_validate` | Validate token files for broken references and schema errors | UX designer |
| `nib_brand_status` | Show current brand system state and output paths | Both |
| `nib_brand_style` | Fetch and apply a Pencil style guide pre-wired to your brand tokens | Solo builder |
| `nib_capture` | Capture a `.pen` file to a `.design.json` snapshot (Pencil must be open) | Both |
| `nib_build_prototype` | Build an HTML prototype from a `.design.json` snapshot with hotspot links | Both |
| `nib_component_init` | Create a component contract (token slots, interactive states, ARIA patterns) | UX designer |
| `nib_kit` | Return a recipe of branded component frames for drawing into Pencil | Both |

---

## Pencil MCP note

Tools that read or write `.pen` files directly — `nib_capture`, `nib_brand_push`, and `nib_brand_import` — also need [Pencil.dev](https://pencil.dev?utm_source=nib&utm_medium=docs)'s own MCP server running. Pencil's MCP gives nib live access to your open file.

Add the Pencil MCP alongside nib in your config:

```json
{
  "mcpServers": {
    "nib": {
      "command": "nib",
      "args": ["--mcp"]
    },
    "pencil": {
      "command": "pencil",
      "args": ["--mcp"]
    }
  }
}
```

Refer to the [Pencil.dev docs](https://pencil.dev?utm_source=nib&utm_medium=docs) for its MCP setup instructions.

::: tip Brand pipeline works without Pencil MCP
`nib_brand_init`, `nib_brand_build`, `nib_brand_audit`, `nib_brand_validate`, `nib_build_prototype`, and `nib_brand_status` all work without Pencil open — they only need the nib MCP server.
:::
