# CLI Commands

## brand init <Badge type="tip" text="New" />

Generate a brand system from brand guidelines.

```sh
nib brand init [OPTIONS]
```

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| `--from` | `string` | | Source: path to `.md`/`.txt`/`.pdf` file, or a URL |
| `--ai` | `string` | `anthropic` | AI provider: `anthropic`, `openai`, `ollama` |
| `--output` | `string` | `docs/design/system` | Output directory |
| `--no-ai` | `boolean` | `false` | Skip AI enhancement |

**Examples:**

```sh
# Interactive guided flow
nib brand init

# From a markdown file
nib brand init --from brand-guidelines.md

# From a website
nib brand init --from https://acme.com

# From a PDF, no AI
nib brand init --from brand.pdf --no-ai

# Custom output directory
nib brand init --from brand.md -o src/design-system
```

## brand build <Badge type="tip" text="New" />

Build platform outputs (CSS, Tailwind, Pencil) from DTCG token files.

```sh
nib brand build [OPTIONS]
```

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| `--config` | `string` | `.nib/brand.config.json` | Path to brand config |

**Examples:**

```sh
# Rebuild all platform outputs
nib brand build

# Use a custom config
nib brand build --config path/to/brand.config.json
```

## brand push <Badge type="tip" text="New" />

Sync design tokens into a Pencil `.pen` file. Also includes Pencil `$--` standard variable mappings (`$--background`, `$--primary`, `$--foreground`, etc.) so Pencil style guides work with your brand out of the box.

If the target file doesn't exist yet, nib creates it and opens it in Pencil automatically — this is the recommended first-time setup path.

```sh
nib brand push [file] [OPTIONS]
```

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| `--config` | `string` | `.nib/brand.config.json` | Path to brand config |

::: warning Pencil open required
Pencil.app must be running. The file path is read from `brand.config.json → platforms.penFile` (default: `docs/design/system/design-system.pen`).
:::

**First-time setup:**

```sh
nib brand push
# → Creates docs/design/system/design-system.pen
# → Opens it in Pencil with tokens loaded
# → Save it in Pencil (Cmd+S) to persist
```

**Subsequent pushes:**

```sh
nib brand push               # uses penFile from brand.config.json
nib brand push my-design.pen # explicit path
```

## brand style <Badge type="tip" text="New" />

Fetch a Pencil style guide and push it (with `$--` standard variable mappings) to a `.pen` file.

```sh
nib brand style [OPTIONS]
```

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| `--tags` | `string` | | Comma-separated style guide tags (e.g., `minimal,webapp`) |
| `--name` | `string` | | Fetch a specific style guide by name |
| `--file` | `string` | from config | Path to `.pen` file |
| `--config` | `string` | `.nib/brand.config.json` | Path to brand config |

When called with no flags, lists the available style guide tags. When `--tags` or `--name` is provided, fetches the matching style guide and pushes all variables (including `$--` standard mappings) to the `.pen` file.

::: warning MCP Required
This command needs a running Pencil.dev instance with its MCP server accessible.
:::

**Examples:**

```sh
# List available style guide tags
nib brand style

# Fetch a style guide by tags
nib brand style --tags minimal,webapp,developer

# Fetch a specific style guide by name
nib brand style --name "Modern Dashboard"

# Target a specific .pen file
nib brand style --tags minimal --file my-design.pen
```

## brand audit <Badge type="tip" text="New" />

Check WCAG contrast compliance of all semantic color token pairs.

```sh
nib brand audit [OPTIONS]
```

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| `--config` | `string` | `.nib/brand.config.json` | Path to brand config |
| `--level` | `string` | `AA` | Minimum level: `AA` or `AAA` |

Exits with code 1 if any pair fails — suitable for CI pipelines.

**Examples:**

```sh
# Run audit
nib brand audit

# Require AAA compliance
nib brand audit --level AAA
```

## brand import <Badge type="tip" text="New" />

Import variables from an existing Pencil `.pen` file into DTCG token files and `brand.config.json`. Use this when your design system already lives in Pencil and you want to bring it under nib control.

```sh
nib brand import <file> [OPTIONS]
```

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| `--output` | `string` | `docs/design/system/tokens` | Tokens output directory |
| `--config` | `string` | `.nib/brand.config.json` | Path to write brand config |

If `brand.config.json` already exists, nib shows a diff and asks before overwriting.

::: warning Pencil open required
Pencil.app must be running with the target `.pen` file open.
:::

**Examples:**

```sh
# Import from an existing design file
nib brand import docs/design/system/design-system.pen

# Custom output locations
nib brand import design.pen --output src/tokens --config src/.brand.json
```

---

## kit <Badge type="tip" text="New" />

Bootstrap a complete design system (tokens + base component kit + Pencil-ready outputs), or return a scaffolding recipe for Claude to draw component frames in Pencil.

```sh
# Full bootstrap (interactive)
nib kit

# Bootstrap from a brand brief file
nib kit --from brand.md --no-ai

# Get a Pencil scaffolding recipe
nib kit --recipe [--component Button,Dialog] [--json]
```

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| `--from` | `string` | | Brand brief: `.md`/`.txt`/`.pdf` file or URL |
| `--no-ai` | `boolean` | `false` | Skip AI enhancement |
| `--skip-init` | `boolean` | `false` | Use existing `brand.config.json` |
| `--recipe` | `boolean` | `false` | Return a Pencil scaffolding recipe instead of bootstrapping |
| `--component` | `string` | all | With `--recipe`: comma-separated component names |
| `--json` | `boolean` | `false` | With `--recipe`: output as JSON envelope |

---

## pencil open <Badge type="tip" text="New" />

Open a `.pen` file in Pencil from the terminal. Pass `new` to create a blank canvas.

```sh
nib pencil open <file|new>
```

::: warning Pencil must already be running
This command tells the running Pencil.app to open a file — it does **not** launch Pencil. Open Pencil.app first, then run this command.
:::

**Examples:**

```sh
# Open an existing file
nib pencil open docs/design/system/design-system.pen

# Create a blank canvas
nib pencil open new
```

After `nib pencil open new`, save the file in Pencil (Cmd+S) to a path of your choice, then run `nib brand push --file <that-path>` to push your tokens into it.

## pencil status <Badge type="tip" text="New" />

Check whether Pencil.app is running and the MCP server is responding.

```sh
nib pencil status
```

Returns one of three states:
- **Pencil running** — binary found, `get_editor_state` responded
- **Pencil found but not running** — binary exists, no response (open Pencil.app)
- **Pencil not installed** — binary not found at any known path

---

## prototype <Badge type="info" text="Prototypes" />

Full pipeline: `.pen` → HTML prototype (MCP → capture → build).

```sh
nib prototype <files...>
```

| Flag | Alias | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `--output` | `-o` | `string` | `./prototype` | Output directory |
| `--template` | `-t` | `string` | `clean` | Template: `clean`, `presentation` |
| `--standalone` | | `boolean` | `false` | Embed all assets for offline use |
| `--device` | `-d` | `string` | | Device frame name |
| `--config` | | `string` | | Path to `nib.config.json` |

::: warning MCP Required
This command needs a running Pencil.dev instance with its MCP server accessible.
:::

**Examples:**

```sh
# Build a prototype from a single file
nib prototype my-design.pen

# Build with a device frame and presentation template
nib prototype app.pen -t presentation -d "iPhone 16 Pro"

# Standalone single-file output
nib prototype app.pen --standalone -o dist/
```

## capture <Badge type="info" text="Prototypes" />

Extract a `.pen` file into intermediate JSON.

```sh
nib capture <file>
```

| Flag | Alias | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `--output` | `-o` | `string` | `<filename>.design.json` | Output path for the JSON file |
| `--canvases` | `-c` | `string` | all | Comma-separated canvas names to capture |

::: warning MCP Required
This command needs a running Pencil.dev instance with its MCP server accessible.
:::

**Examples:**

```sh
# Capture all canvases
nib capture my-design.pen

# Capture specific canvases
nib capture my-design.pen -c "Home,Settings"

# Custom output path
nib capture my-design.pen -o snapshots/design.json
```

## build <Badge type="info" text="Prototypes" />

Build an HTML prototype from a `.design.json` snapshot. **Fully offline — no Pencil, no MCP, no network required.**

```sh
nib build <input>
```

| Flag | Alias | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `--output` | `-o` | `string` | `./prototype` | Output directory |
| `--template` | `-t` | `string` | `clean` | Template: `clean`, `presentation` |
| `--standalone` | | `boolean` | `false` | Embed all assets for a single self-contained HTML file |
| `--device` | `-d` | `string` | | Device frame name (see `nib devices`) |
| `--config` | | `string` | | Path to `nib.config.json` for hotspot navigation links |

::: tip Offline-first
`nib build` only reads the `.design.json` file and writes HTML. It never connects to Pencil or any external service. Run it in CI, on a plane, or anywhere.
:::

**Hotspot links via `nib.config.json`:**

```json
{
  "links": [
    { "from": "Home", "nodeId": "btn-login", "to": "Login", "transition": "slide-left" },
    { "from": "Login", "nodeId": "btn-back",  "to": "Home",  "transition": "slide-right" }
  ]
}
```

Transition values: `slide-left`, `slide-right`, `fade`, `none` (default).

**Examples:**

```sh
# Build from captured JSON
nib build my-design.design.json

# Build with presentation template
nib build my-design.design.json -t presentation

# Build standalone for sharing
nib build my-design.design.json --standalone
```

## dev <Badge type="info" text="Prototypes" />

Start a local dev server with hot-reload on `.pen` changes.

```sh
nib dev <file>
```

::: warning Pencil open required
Pencil.app must be running with the file open. `nib dev` re-captures the `.pen` file on every save — it needs the MCP server to read the live node tree.
:::

| Flag | Alias | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `--port` | `-p` | `string` | `3142` | Port for the dev server |
| `--template` | `-t` | `string` | `clean` | Template: `clean`, `presentation` |
| `--open` | | `boolean` | `true` | Open browser automatically |

**Examples:**

```sh
# Start dev server
nib dev my-design.pen

# Use a custom port
nib dev my-design.pen -p 8080

# Start without opening the browser
nib dev my-design.pen --no-open
```

## devices

List all available device frames.

```sh
nib devices
```

**Available devices:**

| Name | Width | Height | Category |
| --- | --- | --- | --- |
| iPhone 16 Pro | 393 | 852 | phone |
| iPhone 16 Pro Max | 430 | 932 | phone |
| iPhone SE | 375 | 667 | phone |
| Pixel 9 | 412 | 924 | phone |
| Samsung Galaxy S24 | 360 | 780 | phone |
| iPad Pro 13" | 1032 | 1376 | tablet |
| iPad Pro 11" | 834 | 1194 | tablet |
| iPad Mini | 744 | 1133 | tablet |
| MacBook Pro 16" | 1728 | 1117 | desktop |
| MacBook Pro 14" | 1512 | 982 | desktop |
| MacBook Air 13" | 1470 | 956 | desktop |
| Desktop 1920 | 1920 | 1080 | desktop |
| Desktop 1440 | 1440 | 900 | desktop |
| Desktop 1280 | 1280 | 800 | desktop |

## templates

List available prototype templates.

```sh
nib templates
```

| Name | Description |
| --- | --- |
| `clean` | Minimal prototype viewer — ideal for handoff and review |
| `presentation` | Slide-style prototype with keyboard navigation and transitions |
