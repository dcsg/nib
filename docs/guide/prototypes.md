# Prototypes

nib's prototype pipeline turns `.pen` design files into shareable HTML prototypes — complete with [hotspot navigation](#hotspot-navigation-screen-links), device frames, and offline-ready bundles.

## How It Works

```
.pen file  →  MCP (Pencil.dev)  →  DesignDocument JSON  →  HTML Prototype
    ↓                ↓                       ↓                     ↓
 your design    reads nodes,           intermediate           styled pages,
                variables &            contract               canvas nav,
                assets inline          (resolved,             device frame
                                       no refs)               (optional)
```

The pipeline has two stages:

- **Capture** — reads the `.pen` file via the [Pencil.dev](https://pencil.dev?utm_source=nib&utm_medium=docs) MCP server, resolves all component references inline, and outputs a self-contained `DesignDocument` JSON.
- **Build** — transforms the `DesignDocument` into HTML using the chosen template. Works fully offline from the JSON snapshot.

## What Requires Pencil Open

This is the most important thing to understand about the pipeline:

| Command | Pencil open? | Why |
|---|---|---|
| `nib capture` | **Yes** | Reads live node tree, variables, and assets from the running editor |
| `nib prototype` | **Yes** | Runs capture internally |
| `nib dev` | **Yes** | Re-captures on every file save |
| `nib brand push` | **Yes** | Writes variables into the open file |
| `nib brand import` | **Yes** | Reads variables from the open file |
| `nib pencil open` | **Yes** | Tells Pencil to open a file |
| `nib build` | **No** | Reads a `.design.json` snapshot — pure file I/O |
| `nib brand init/build/audit` | **No** | Token generation — no design tool involved |

**Rule of thumb:** If the command touches a `.pen` file directly, Pencil must be open. Everything that operates on a `.design.json` snapshot is fully offline.

## Quick Start

```sh
# Full pipeline: .pen → HTML in one command
nib prototype my-design.pen

# With a device frame and presentation template
nib prototype app.pen -t presentation -d "iPhone 16 Pro"

# Standalone output — embed all assets for sharing
nib prototype app.pen --standalone -o dist/
```

::: warning MCP Required
`nib prototype` (and `nib capture`) need a running [Pencil.dev](https://pencil.dev?utm_source=nib&utm_medium=docs) instance with its MCP server accessible. `nib build` works fully offline from a `.design.json` snapshot.
:::

## Three Modes

### `prototype` — Full pipeline

The default. Runs capture + build in sequence. Use this when you have Pencil.dev open and want to go from `.pen` to HTML in one step.

```sh
nib prototype my-design.pen
```

### `capture` + `build` — Split pipeline

Run the stages separately. Useful for CI/CD: capture once, then rebuild the HTML as many times as you need without re-reading the `.pen` file.

```sh
# Stage 1: capture from Pencil.dev (requires MCP)
nib capture my-design.pen -o snapshots/my-design.design.json

# Stage 2: build HTML from snapshot (offline, no MCP)
nib build snapshots/my-design.design.json -t presentation
```

The `.design.json` snapshot is version-controllable — commit it to run `nib build` in CI without Pencil.dev.

### `dev` — Live reload

Start a local dev server that watches your `.pen` file and rebuilds on changes. Ideal for rapid iteration.

```sh
nib dev my-design.pen
```

Opens a browser automatically at `http://localhost:3142`. Change your design in Pencil.dev, save, and the browser refreshes.

## Templates

### `clean` (default)

Minimal prototype viewer. Canvas thumbnails on the left, full-size canvas on the right. Best for:

- Design handoff and review
- Developer reference
- Quick sharing

```sh
nib prototype my-design.pen -t clean
```

### `presentation`

Slide-style viewer with keyboard navigation (`←` / `→`) and smooth transitions. Best for:

- Stakeholder presentations
- Walkthroughs and demos
- Pitch decks

```sh
nib prototype my-design.pen -t presentation
```

List all available templates:

```sh
nib templates
```

See the [Templates overview](/templates/) for a visual comparison of both templates.

## Device Frames

Wrap your prototype in a realistic device bezel to simulate the target platform. Pass any device name from `nib devices`:

```sh
# Mobile
nib prototype app.pen -d "iPhone 16 Pro"
nib prototype app.pen -d "Pixel 9"

# Tablet
nib prototype app.pen -d "iPad Pro 11\""

# Desktop
nib prototype app.pen -d "MacBook Pro 14\""
```

List all available devices and their dimensions:

```sh
nib devices
```

## Offline & CI

`nib build` works entirely from a `.design.json` snapshot — no MCP, no Pencil.dev, no network.

**Workflow for CI/CD:**

1. Capture once locally (Pencil must be open for this step only):
   ```sh
   nib capture my-design.pen -o design-snapshots/my-design.design.json
   ```

2. Commit the snapshot to your repo.

3. In CI, run `nib build` to regenerate HTML on every push — no Pencil, no MCP:
   ```sh
   nib build design-snapshots/my-design.design.json --standalone -o dist/
   ```

The `--standalone` flag embeds all assets (CSS, fonts, images) into a single self-contained HTML file — no external dependencies, no server required.

::: tip One capture, many builds
You only need Pencil open when your design changes and you want to re-capture. Iterating on templates, device frames, or hotspot links only requires `nib build` — which is instant and offline.
:::

## Hotspot Navigation (Screen Links)

Wire up navigation between screens so your prototype is clickable end-to-end. Pass a `links` array to `nib build` (or `nib prototype`):

```sh
# Via nib.config.json
nib build my-design.design.json --config nib.config.json
```

`nib.config.json` example:

```json
{
  "links": [
    { "from": "Home", "nodeId": "btn-signup", "to": "Signup", "transition": "slide-left" },
    { "from": "Signup", "nodeId": "btn-back",  "to": "Home",   "transition": "slide-right" }
  ]
}
```

When using the MCP tool, pass links inline — nib writes the config file for you:

```
nib_build_prototype {
  "input": "my-design.design.json",
  "links": [
    { "from": "Home", "nodeId": "btn-signup", "to": "Signup", "transition": "slide-left" }
  ]
}
```

### Finding node IDs

After `nib capture`, the `.design.json` contains every node with its `id` field. Each node looks like:

```json
{
  "id": "btn-signup",
  "name": "Sign Up Button",
  "type": "rectangle",
  "x": 120, "y": 340,
  "width": 160, "height": 44
}
```

To find IDs, open the `.design.json` file and search for the element's display name — the `id` field next to it is what you pass to `nodeId` in your links config.

You can also see the IDs printed in the `nib capture` output summary — it lists all top-level canvases and their direct children with IDs.

## Opening Files in Pencil

Use `nib pencil open` to open a file in Pencil from the terminal — useful for first-time setup or switching between files in a script.

```sh
# Open an existing .pen file
nib pencil open docs/design/system/design-system.pen

# Create a blank canvas in Pencil
nib pencil open new

# Check whether Pencil is running and MCP is responding
nib pencil status
```

After `nib pencil open new`, Pencil opens a blank canvas. Save it where you want (Cmd+S), then push your tokens into it:

```sh
nib brand push --file docs/design/system/design-system.pen
```

::: tip Canonical file path
nib uses `docs/design/system/design-system.pen` as the conventional path for your design system file. It's set in `.nib/brand.config.json` under `platforms.penFile` and created automatically by `nib brand push` if it doesn't exist yet.
:::

## Try It Yourself

::: info Running from source vs installed
The steps below use `bun src/cli/index.ts` — this is the **in-repo dev path** for contributors. If you installed nib globally (`npm install -g usenib`), replace `bun src/cli/index.ts` with `nib` in every command.
:::

Run this walkthrough inside the nib repo — no external setup needed beyond a running Pencil.dev instance.

### 1. Open a `.pen` file in Pencil

Have Pencil.app running with a `.pen` file open. You can open a file from the terminal:

```sh
nib pencil open my-design.pen   # open existing file
nib pencil open new             # blank canvas
nib pencil status               # confirm Pencil is responding
```

### 2. Capture to JSON

```sh
bun src/cli/index.ts capture my-design.pen -o my-design.design.json
```

Inspect the output — you'll see all canvases, nodes, variables, and assets resolved inline with no component references.

### 3. Build an HTML prototype

```sh
bun src/cli/index.ts build my-design.design.json
```

Open `prototype/index.html` in a browser to see the result.

### 4. Try the presentation template

```sh
bun src/cli/index.ts build my-design.design.json -t presentation -o dist/
```

Open `dist/index.html` and use `←` / `→` to navigate between canvases.

### 5. Add a device frame

```sh
bun src/cli/index.ts build my-design.design.json -d "iPhone 16 Pro" -o dist-mobile/
```

### 6. Run the full pipeline in one step

```sh
bun src/cli/index.ts prototype my-design.pen -t presentation -d "iPhone 16 Pro" --standalone -o dist/
```

### 7. Start the dev server

```sh
bun src/cli/index.ts dev my-design.pen
```

Make a change in Pencil.dev, save, and watch the browser update automatically.

::: tip Offline after first capture
Steps 1, 2, 6, and 7 require Pencil open. Steps 3–5 work fully offline from the captured `.design.json` — no Pencil, no MCP, no network.
:::
