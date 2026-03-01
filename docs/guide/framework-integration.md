# Framework Integration

nib outputs two platform artifacts every component framework can consume: a **CSS variables file** and a **Tailwind preset**. How much work the integration takes depends on the framework.

---

## The connection point

```
nib brand build
  ├── build/css/variables.css      ← CSS custom properties (--color-interactive-default, etc.)
  └── build/tailwind/preset.js     ← Tailwind config extension (colors, spacing, radius, etc.)
```

Every framework below pulls from one or both of these outputs.

---

## [shadcn/ui](https://ui.shadcn.com?utm_source=nib&utm_medium=docs)

shadcn/ui is the most common stack for builders using nib. It's also the most direct integration — shadcn is built entirely on CSS custom properties, and nib already outputs CSS custom properties. The only work is a **name mapping**.

### The gap

shadcn expects variables like `--primary`, `--background`, `--border`. nib generates `--color-interactive-default`, `--color-background-primary`, `--color-border-primary`. Same values, different names.

### The fix — one mapping block in your global CSS

Add this to your `globals.css` (or wherever shadcn's `:root` block lives), **after** importing nib's `variables.css`:

```css
@import "path/to/docs/design/system/build/css/variables.css";

@layer base {
  :root {
    /* Backgrounds */
    --background:           var(--color-background-primary);
    --card:                 var(--color-surface-primary);
    --popover:              var(--color-surface-primary);

    /* Text */
    --foreground:           var(--color-text-primary);
    --card-foreground:      var(--color-text-primary);
    --popover-foreground:   var(--color-text-primary);
    --muted-foreground:     var(--color-text-secondary);

    /* Interactive / Brand */
    --primary:              var(--color-interactive-default);
    --primary-foreground:   var(--color-text-inverse);
    --secondary:            var(--color-surface-secondary);
    --secondary-foreground: var(--color-text-secondary);
    --accent:               var(--color-surface-secondary);
    --accent-foreground:    var(--color-text-secondary);
    --muted:                var(--color-surface-primary);

    /* Feedback */
    --destructive:          var(--color-feedback-error);
    --destructive-foreground: var(--color-text-inverse);

    /* Borders & inputs */
    --border:               var(--color-border-primary);
    --input:                var(--color-border-primary);
    --ring:                 var(--color-interactive-default);

    /* Radius */
    --radius:               var(--border-radius-md);
  }

  .dark {
    --background:           var(--color-background-primary-dark);
    --foreground:           var(--color-text-primary-dark);
    --primary:              var(--color-interactive-default-dark);
    --primary-foreground:   var(--color-text-inverse-dark);
    --secondary:            var(--color-surface-secondary-dark);
    --secondary-foreground: var(--color-text-secondary-dark);
    --muted:                var(--color-surface-primary-dark);
    --muted-foreground:     var(--color-text-tertiary-dark);
    --accent:               var(--color-surface-secondary-dark);
    --accent-foreground:    var(--color-text-secondary-dark);
    --destructive:          var(--color-feedback-error-dark);
    --border:               var(--color-border-primary-dark);
    --input:                var(--color-border-primary-dark);
    --ring:                 var(--color-interactive-default-dark);
  }
}
```

### Tailwind config

shadcn's `tailwind.config.js` references the same CSS variables. Import the nib preset alongside it:

```js
// tailwind.config.js
import nibPreset from "./docs/design/system/build/tailwind/preset.js";

export default {
  presets: [nibPreset],
  // shadcn's content and plugin config stays as-is
  content: ["./src/**/*.{ts,tsx}"],
  plugins: [require("tailwindcss-animate")],
};
```

### Result

Every shadcn component — Button, Card, Dialog, Input, Badge, Toast — renders in your brand colors automatically. When you update a token in nib and run `nib brand build`, all shadcn components update with zero code changes.

---

## [Tailwind CSS](https://tailwindcss.com?utm_source=nib&utm_medium=docs) (without shadcn)

If you're using Tailwind directly without a component library, the nib preset gives you semantic utility classes:

```js
// tailwind.config.js
import nibPreset from "./docs/design/system/build/tailwind/preset.js";

export default {
  presets: [nibPreset],
  content: ["./src/**/*.{html,js,ts,jsx,tsx}"],
};
```

Use nib token names as Tailwind utilities:

```html
<!-- Colors -->
<button class="bg-interactive-default text-text-inverse hover:bg-interactive-hover">
  Get started
</button>

<!-- Spacing -->
<div class="p-spacing-md gap-spacing-sm">

<!-- Border radius -->
<div class="rounded-radius-md">

<!-- Typography -->
<h1 class="font-sans text-display">
```

---

## [Radix UI](https://radix-ui.com?utm_source=nib&utm_medium=docs) (headless)

Radix components are unstyled — they accept any CSS classes. Use nib CSS variables directly:

```tsx
import * as Dialog from "@radix-ui/react-dialog";

// globals.css already imports nib variables.css — use them in className or style
<Dialog.Content
  className="bg-[var(--color-surface-primary)] border border-[var(--color-border-primary)] rounded-[var(--border-radius-lg)] p-[var(--spacing-lg)]"
>
```

Or combine with the Tailwind preset and use semantic utilities as shown above.

---

## [Chakra UI](https://chakra-ui.com?utm_source=nib&utm_medium=docs)

Chakra has its own theme system. Map nib's resolved token values into a Chakra theme extension:

```ts
// theme.ts
import { extendTheme } from "@chakra-ui/react";
import preset from "./docs/design/system/build/tailwind/preset.js";

// Pull resolved values from the nib Tailwind preset
const { colors, fontFamily, spacing, borderRadius } = preset.theme.extend;

export const theme = extendTheme({
  colors: {
    brand: colors.brand,       // the full 50–950 scale
    neutral: colors.neutral,
  },
  fonts: {
    heading: fontFamily.sans.join(", "),
    body: fontFamily.sans.join(", "),
    mono: fontFamily.mono.join(", "),
  },
  space: spacing,
  radii: borderRadius,
  semanticTokens: {
    colors: {
      "chakra-body-bg":   { default: colors.background?.primary, _dark: colors["background-dark"]?.primary },
      "chakra-body-text": { default: colors.text?.primary, _dark: colors["text-dark"]?.primary },
    },
  },
});
```

::: tip Pull values from the preset, not the JSON
The Tailwind preset contains resolved values (actual hex codes, px values). Don't read from the DTCG `.tokens.json` files directly — those use reference syntax like `{color.brand.600}` that needs to be resolved first.
:::

---

## [Mantine](https://mantine.dev?utm_source=nib&utm_medium=docs)

Mantine accepts a theme object with color scales. nib's primitive color scales map directly:

```ts
// theme.ts
import { createTheme, MantineColorsTuple } from "@mantine/core";
import preset from "./docs/design/system/build/tailwind/preset.js";

const { colors } = preset.theme.extend;

// Mantine needs colors as a 10-value tuple [50, 100, 200, ..., 900]
const brandScale = [
  colors.brand[50],
  colors.brand[100],
  colors.brand[200],
  colors.brand[300],
  colors.brand[400],
  colors.brand[500],
  colors.brand[600],
  colors.brand[700],
  colors.brand[800],
  colors.brand[900],
] as MantineColorsTuple;

export const theme = createTheme({
  primaryColor: "brand",
  colors: { brand: brandScale },
  fontFamily: preset.theme.extend.fontFamily.sans.join(", "),
  defaultRadius: "md",
});
```

---

## [Material UI (MUI)](https://mui.com?utm_source=nib&utm_medium=docs)

MUI has its own palette system. Map nib's semantic tokens into MUI's `createTheme`:

```ts
import { createTheme } from "@mui/material/styles";
import preset from "./docs/design/system/build/tailwind/preset.js";

const { colors } = preset.theme.extend;

export const theme = createTheme({
  palette: {
    primary: {
      main:          colors.interactive?.default ?? colors.brand[600],
      light:         colors.brand[400],
      dark:          colors.brand[700],
      contrastText:  "#ffffff",
    },
    error: {
      main: colors.feedback?.error ?? colors.error[600],
    },
    background: {
      default: colors.background?.primary,
      paper:   colors.surface?.primary,
    },
    text: {
      primary:   colors.text?.primary,
      secondary: colors.text?.secondary,
    },
  },
  typography: {
    fontFamily: preset.theme.extend.fontFamily.sans.join(", "),
  },
  shape: {
    borderRadius: 6,  // matches --border-radius-md
  },
});
```

---

## When tokens update

Regardless of which framework you use, the process is the same after any token change:

```sh
nib brand build   # regenerates variables.css and preset.js
```

- **shadcn / Radix / plain Tailwind** — zero code changes. The mapping layer picks up new values automatically.
- **Chakra / Mantine / MUI** — if you're reading from the preset at build time, a rebuild picks up the changes. If you hardcoded values, update the theme file.

This is why the mapping approach (pointing framework variables at nib variables) is better than copying raw hex values into a theme file — one `nib brand build` propagates everywhere.

---

## Summary

| Framework | Integration effort | Approach |
|---|---|---|
| **shadcn/ui** | Low — one mapping block | CSS var aliases in globals.css |
| **Tailwind only** | None | Import nib preset in tailwind.config.js |
| **Radix UI** | None | Use nib CSS vars in className |
| **Chakra UI** | Medium | Extract from preset, pass to extendTheme |
| **Mantine** | Medium | Extract color scale from preset, createTheme |
| **MUI** | Medium | Map semantic tokens to MUI palette |

---

## Roadmap — `nib brand build --framework`

The manual mapping blocks above will become automated. A planned `--framework` flag on `nib brand build` will generate the correct integration file for your stack directly:

```sh
nib brand build --framework shadcn    # writes globals.css mapping block
nib brand build --framework chakra    # writes theme.ts with extendTheme()
nib brand build --framework mantine   # writes theme.ts with createTheme()
nib brand build --framework mui       # writes theme.ts with createTheme()
```

Each framework adapter reads your resolved token values from the preset and emits idiomatic framework code — the same code shown in this guide, but generated automatically from your actual token values.

Until that ships, the manual approach above is the path. The mapping blocks are stable — once written they don't need to change unless you rename or remove tokens.
