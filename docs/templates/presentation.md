# Presentation Template

A slide-deck style viewer that adds a progress bar, arrow navigation, a slide counter, and keyboard controls on top of your prototype.

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
  <div style="background: #1a1a1a; padding: 40px 40px 60px; display: flex; flex-direction: column; align-items: center; min-height: 340px; position: relative;">
    <!-- Progress bar -->
    <div style="position: absolute; top: 0; left: 0; width: 40%; height: 3px; background: #4f8fff;"></div>
    <!-- Theme toggle -->
    <div style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.5); color: #fff; border-radius: 8px; padding: 4px 10px; font-size: 11px; font-family: system-ui;">Toggle theme</div>
    <!-- Canvas mockup -->
    <div style="background: #fff; border-radius: 8px; width: 260px; padding: 20px; font-family: system-ui; margin-top: 12px;">
      <div style="background: #4f8fff; border-radius: 6px; height: 32px; width: 60%; margin-bottom: 12px;"></div>
      <div style="background: #e5e7eb; border-radius: 4px; height: 8px; width: 100%; margin-bottom: 6px;"></div>
      <div style="background: #e5e7eb; border-radius: 4px; height: 8px; width: 85%; margin-bottom: 6px;"></div>
      <div style="background: #e5e7eb; border-radius: 4px; height: 8px; width: 70%; margin-bottom: 16px;"></div>
      <div style="display: flex; gap: 8px;">
        <div style="background: #4f8fff; border-radius: 6px; height: 28px; flex: 1;"></div>
        <div style="border: 1px solid #d1d5db; border-radius: 6px; height: 28px; flex: 1;"></div>
      </div>
    </div>
    <!-- Bottom controls -->
    <div style="position: absolute; bottom: 16px; display: flex; align-items: center; gap: 14px; background: rgba(0,0,0,0.7); padding: 6px 18px; border-radius: 20px; backdrop-filter: blur(8px);">
      <span style="color: #fff; opacity: 0.7; font-size: 16px; cursor: pointer; font-family: system-ui;">&#8592;</span>
      <span style="color: #fff; opacity: 0.7; font-size: 12px; font-family: system-ui; font-variant-numeric: tabular-nums;">2 / 5</span>
      <span style="color: #fff; opacity: 0.7; font-size: 16px; cursor: pointer; font-family: system-ui;">&#8594;</span>
      <span style="color: #fff; opacity: 0.7; font-size: 14px; cursor: pointer; font-family: system-ui;">&#x26F6;</span>
    </div>
  </div>
</div>

<p style="text-align: center; font-size: 13px; color: var(--vp-c-text-2); margin-top: -8px;">
  Dark background, blue progress bar, frosted glass controls with slide counter.
</p>

## What It Renders

- Each canvas as a full-screen slide on a dark stage
- A blue progress bar at the top
- Previous/next arrow buttons in a floating control bar
- A slide counter (e.g. "2 / 5")
- Configurable transitions between slides
- An optional device frame wrapping each canvas
- A light/dark theme toggle

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `→` or `Space` | Next canvas |
| `←` | Previous canvas |
| `Escape` | Reset to first canvas |
| `F` | Toggle fullscreen |
| `T` | Toggle light/dark theme |

## Use Cases

- **Live demos** — present a prototype in a meeting, navigating with arrow keys
- **Async walkthroughs** — share a link where reviewers step through the flow at their own pace
- **Loom recordings** — record a narrated walkthrough with clean slide transitions

::: tip Hotspots Still Work
Even in presentation mode, hotspot links defined in `nib.config.json` remain active. Viewers can click hotspots to jump to linked canvases or use the arrow keys to go sequentially.
:::
