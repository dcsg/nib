# Clean Template

The default template. Renders your canvases in a minimal viewer with a neutral background — no chrome, no distractions.

## Preview

<div style="border-radius: 8px; overflow: hidden; border: 1px solid var(--vp-c-border); margin: 16px 0;">
  <!-- Browser chrome -->
  <div style="background: #e8e8e8; padding: 8px 12px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #d0d0d0;">
    <div style="display: flex; gap: 6px;">
      <div style="width: 12px; height: 12px; border-radius: 50%; background: #ff5f57;"></div>
      <div style="width: 12px; height: 12px; border-radius: 50%; background: #febc2e;"></div>
      <div style="width: 12px; height: 12px; border-radius: 50%; background: #28c840;"></div>
    </div>
    <div style="flex: 1; background: #fff; border-radius: 4px; padding: 4px 12px; font-size: 12px; color: #666; font-family: system-ui;">prototype/index.html</div>
  </div>
  <!-- Template content -->
  <div style="background: #f0f0f0; padding: 40px; display: flex; justify-content: center; align-items: center; min-height: 300px; position: relative;">
    <!-- Theme toggle -->
    <div style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.5); color: #fff; border-radius: 8px; padding: 4px 10px; font-size: 11px; font-family: system-ui;">Toggle theme</div>
    <!-- Canvas mockup -->
    <div style="background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); width: 260px; padding: 20px; font-family: system-ui;">
      <div style="background: #4f8fff; border-radius: 6px; height: 32px; width: 60%; margin-bottom: 12px;"></div>
      <div style="background: #e5e7eb; border-radius: 4px; height: 8px; width: 100%; margin-bottom: 6px;"></div>
      <div style="background: #e5e7eb; border-radius: 4px; height: 8px; width: 85%; margin-bottom: 6px;"></div>
      <div style="background: #e5e7eb; border-radius: 4px; height: 8px; width: 70%; margin-bottom: 16px;"></div>
      <div style="display: flex; gap: 8px;">
        <div style="background: #4f8fff; border-radius: 6px; height: 28px; flex: 1;"></div>
        <div style="border: 1px solid #d1d5db; border-radius: 6px; height: 28px; flex: 1;"></div>
      </div>
    </div>
  </div>
</div>

<p style="text-align: center; font-size: 13px; color: var(--vp-c-text-2); margin-top: -8px;">
  Neutral gray background, centered canvas, theme toggle — nothing else.
</p>

## What It Renders

- Each canvas as a centered, scaled block
- Click anywhere to advance to the next canvas
- An optional device frame wrapping the canvas
- A light/dark theme toggle (top-right)

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Click` | Advance to next canvas |
| `←` `→` | Navigate canvases |
| `T` | Toggle light/dark theme |

## Use Cases

- **Design handoff** — share a link with developers, they click through screens
- **Iframe embedding** — drop the prototype into Notion, Confluence, or any page that supports iframes
- **Video recording** — capture a walkthrough at your own pace without slide chrome getting in the way

## Theme Support

The clean template includes a built-in theme toggle. Light mode uses a neutral gray background; dark mode switches to a dark surface. The toggle persists across page reloads via `localStorage`.

## Standalone Mode

Pass `--standalone` to embed all images inline as data URIs. The output is a single HTML file with zero external dependencies — share it as an email attachment, upload it anywhere.

```sh
nib prototype my-design.pen --template clean --standalone
```
