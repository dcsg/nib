# Templates

nib ships with two built-in templates. Both support device frames, theme toggling, and hotspot navigation.

## At a Glance

<div style="display: flex; gap: 16px; flex-wrap: wrap; margin: 16px 0;">

<!-- Clean -->
<div style="flex: 1; min-width: 280px;">
<a href="/templates/clean" style="text-decoration: none; color: inherit;">
<div style="border-radius: 8px; overflow: hidden; border: 1px solid var(--vp-c-border); transition: border-color 0.2s;">
  <div style="background: #f0f0f0; padding: 24px; display: flex; justify-content: center; align-items: center; min-height: 200px; position: relative;">
    <div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.4); color: #fff; border-radius: 6px; padding: 2px 8px; font-size: 10px; font-family: system-ui;">Theme</div>
    <div style="background: #fff; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); width: 160px; padding: 14px; font-family: system-ui;">
      <div style="background: #4f8fff; border-radius: 4px; height: 20px; width: 55%; margin-bottom: 8px;"></div>
      <div style="background: #e5e7eb; border-radius: 3px; height: 5px; width: 100%; margin-bottom: 4px;"></div>
      <div style="background: #e5e7eb; border-radius: 3px; height: 5px; width: 80%; margin-bottom: 4px;"></div>
      <div style="background: #e5e7eb; border-radius: 3px; height: 5px; width: 65%; margin-bottom: 10px;"></div>
      <div style="display: flex; gap: 4px;">
        <div style="background: #4f8fff; border-radius: 4px; height: 18px; flex: 1;"></div>
        <div style="border: 1px solid #d1d5db; border-radius: 4px; height: 18px; flex: 1;"></div>
      </div>
    </div>
  </div>
  <div style="padding: 12px 16px; border-top: 1px solid var(--vp-c-border);">
    <div style="font-weight: 600; font-size: 14px;">Clean</div>
    <div style="font-size: 12px; color: var(--vp-c-text-2); margin-top: 2px;">Minimal, no chrome — click to navigate</div>
  </div>
</div>
</a>
</div>

<!-- Presentation -->
<div style="flex: 1; min-width: 280px;">
<a href="/templates/presentation" style="text-decoration: none; color: inherit;">
<div style="border-radius: 8px; overflow: hidden; border: 1px solid var(--vp-c-border); transition: border-color 0.2s;">
  <div style="background: #1a1a1a; padding: 24px 24px 40px; display: flex; flex-direction: column; align-items: center; min-height: 200px; position: relative;">
    <div style="position: absolute; top: 0; left: 0; width: 40%; height: 3px; background: #4f8fff;"></div>
    <div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.4); color: #fff; border-radius: 6px; padding: 2px 8px; font-size: 10px; font-family: system-ui;">Theme</div>
    <div style="background: #fff; border-radius: 6px; width: 160px; padding: 14px; font-family: system-ui; margin-top: 4px;">
      <div style="background: #4f8fff; border-radius: 4px; height: 20px; width: 55%; margin-bottom: 8px;"></div>
      <div style="background: #e5e7eb; border-radius: 3px; height: 5px; width: 100%; margin-bottom: 4px;"></div>
      <div style="background: #e5e7eb; border-radius: 3px; height: 5px; width: 80%; margin-bottom: 4px;"></div>
      <div style="background: #e5e7eb; border-radius: 3px; height: 5px; width: 65%; margin-bottom: 10px;"></div>
      <div style="display: flex; gap: 4px;">
        <div style="background: #4f8fff; border-radius: 4px; height: 18px; flex: 1;"></div>
        <div style="border: 1px solid #d1d5db; border-radius: 4px; height: 18px; flex: 1;"></div>
      </div>
    </div>
    <div style="position: absolute; bottom: 10px; display: flex; align-items: center; gap: 10px; background: rgba(0,0,0,0.7); padding: 4px 14px; border-radius: 16px;">
      <span style="color: #fff; opacity: 0.7; font-size: 12px; font-family: system-ui;">←</span>
      <span style="color: #fff; opacity: 0.7; font-size: 10px; font-family: system-ui;">2 / 5</span>
      <span style="color: #fff; opacity: 0.7; font-size: 12px; font-family: system-ui;">→</span>
    </div>
  </div>
  <div style="padding: 12px 16px; border-top: 1px solid var(--vp-c-border);">
    <div style="font-weight: 600; font-size: 14px;">Presentation</div>
    <div style="font-size: 12px; color: var(--vp-c-text-2); margin-top: 2px;">Slide-deck with progress bar & controls</div>
  </div>
</div>
</a>
</div>

</div>

## Comparison

| Feature | Clean | Presentation |
| --- | --- | --- |
| Background | Neutral gray (`#f0f0f0`) | Dark stage (`#1a1a1a`) |
| Navigation UI | Click anywhere | Arrow buttons + slide counter |
| Progress indicator | None | Blue bar at top |
| Transitions | Instant swap | Opacity + slide (0.3s ease) |
| Keyboard | `←` `→` to navigate, `T` for theme | `←` `→` `Space` `F` `Esc` `T` |
| Fullscreen | No | Yes (`F` key or button) |
| Best for | Handoff, review, embedding | Live demos, async walkthroughs |
| Theme toggle | Yes | Yes |

## When to Use Each

**[Clean](/templates/clean)** is the default. Use it when you want a straightforward prototype that stays out of the way — ideal for design review, developer handoff, or embedding in an iframe.

**[Presentation](/templates/presentation)** adds slide-style controls on top of your prototype. Use it when you're walking someone through a flow — in a meeting, a Loom recording, or an async review where the viewer navigates step-by-step.
