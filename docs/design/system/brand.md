# Brand System — Flux
<!-- nib-brand: v1 | generated: 2026-03-02 | do not edit manually -->

## Identity

Flux is a bold, technical brand in the developer tools industry.

**Personality:** bold, technical
**Industry:** developer tools

## Color

- Use **brand** colors for primary interactive elements (buttons, links, focus rings)
- Use **neutral** colors for text, borders, and backgrounds
- Reserve **feedback** colors (success, warning, error, info) strictly for status communication
- In dark mode, use lighter tints of brand colors for interactive elements
- Never use raw hex values — always reference semantic tokens

## Typography

**Primary font:** Inter

**Scale ratio:** major-third (1.25)

- **Display**: Hero sections, landing page headlines only
- **Heading**: Section titles, card headers
- **Body**: Default paragraph text, form labels
- **Caption**: Helper text, timestamps, metadata
- Line heights follow a 4px grid for vertical rhythm
- Font weights: 400 (body), 500 (labels), 600 (headings), 700 (display)

## Spacing

- Base unit: 4px — all spacing is a multiple of 4
- Use **xs** (8px) for tight element spacing (icon gaps, inline elements)
- Use **sm–md** (12–16px) for component internal padding
- Use **lg–xl** (24–32px) for section spacing
- Use **2xl–4xl** (48–96px) for page-level vertical rhythm

## Components

### Buttons
- Primary: brand interactive color, white text, md border-radius
- Secondary: transparent with brand border, brand text
- Destructive: error color, white text
- All buttons: md padding horizontal, sm padding vertical, label font weight

### Cards
- White/surface background, sm border-radius, md elevation shadow
- lg padding, neutral border (secondary)
- Hover: elevate shadow one step

### Forms
- Inputs: neutral border, md border-radius, sm vertical padding, md horizontal
- Focus: brand focus ring (2px), border color → brand
- Error state: error border + error text below
- Labels: label size, secondary text color, sm margin below

## Component Inventory
<!-- nib-component-inventory:start -->

The following components are defined in this design system.
Do not invent or use components not listed here.

| Component | Status | Description |
|-----------|--------|-------------|
| Button | draft | Triggers an action or event |
| TextInput | draft | Accepts free-form text input from the user |
| Checkbox | draft | A binary toggle that can be checked or unchecked |
| Radio | draft | A single option within a radio group — only one option can be selected at a time |
| Switch | draft | A binary on/off toggle control |
| Dialog | draft | A modal overlay that requires user interaction before the rest of the UI becomes accessible |
| Tooltip | draft | A small popup that displays information about another element on hover or focus |
| Tabs | draft | A set of layered sections of content — only one section is visible at a time |
| Combobox | draft | An input that displays a popup list of suggested values |
| Badge | draft | A small label used to convey status, category, or metadata at a glance |
| Toast | draft | A transient message that confirms an action or communicates status — auto-dismisses after a timeout |
| Alert | draft | A persistent inline message that communicates status or guidance — stays visible until the condition changes or the user dismisses it |

For full contracts, see docs/design/system/components/.

<!-- nib-component-inventory:end -->













