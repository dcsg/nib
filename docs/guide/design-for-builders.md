# Design for Builders

You're a builder — a founder, indie hacker, or product person — shipping a product without a dedicated designer. This page teaches you just enough design to make decisions confidently: the concepts, the vocabulary, and how to go from "I need a sign-up screen" to something that looks professional and works for users.

---

## The mental model

Think of UI design as a stack, where each layer is built from the one below:

```
Tokens           →  the raw values (colors, sizes, spacing)
  ↓
Components       →  reusable UI building blocks (buttons, inputs, cards)
  ↓
Screens          →  a single view in your product (one page, one state)
  ↓
UX Flows         →  a sequence of screens that achieves one user goal
  ↓
Prototype        →  a clickable simulation used for testing and sharing
```

nib works through this exact stack. `nib brand init` handles tokens. `nib kit` scaffolds components. You design the screens. `nib prototype` builds the clickable output.

---

## The vocabulary

### Design tokens

Design tokens are the atomic values of your visual language — the building blocks everything else references.

| Token type | What it defines | Example |
|---|---|---|
| Color | Every color in your product | `color.brand.600 = #2563EB` |
| Typography | Font families, sizes, line heights | `fontSize.lg = 18px` |
| Spacing | Gaps, padding, margins | `spacing.md = 16px` |
| Border radius | How rounded corners are | `radius.md = 6px` |
| Shadow | Depth and elevation | `shadow.sm = 0 1px 3px rgba(0,0,0,.1)` |

**Why they matter:** Instead of writing `color: #2563EB` everywhere, you write `color: var(--color-brand-600)`. When you need to change your brand color, you change one token and every button, link, and badge updates automatically.

nib generates 77+ tokens from your brand colors and font. You never define them manually.

### Components

Components are reusable UI elements. Think of them like LEGO bricks — a limited set of pieces you combine to build anything.

Common components every product needs:

| Component | What it does |
|---|---|
| **Button** | Triggers an action — primary, secondary, destructive variants |
| **TextInput** | Accepts user text — email, password, search |
| **Checkbox / Radio** | Binary or single-choice selection |
| **Switch** | Toggle an on/off setting |
| **Dialog / Modal** | Interrupts the flow for an important decision or form |
| **Card** | Groups related content with a visual boundary |
| **Badge** | A label that conveys status or count |
| **Toast** | Temporary feedback message (success, error, info) |
| **Tabs** | Switches between sections without a page change |
| **Dropdown / Select** | Choosing from a list |

Each component has **states**: default, hover, focus, disabled, error. nib component contracts define all of these with the exact tokens to use.

### Design system

Your tokens + components + the rules for using them, packaged together so every screen stays consistent automatically. [See the full breakdown below →](#the-design-system)

### Screen

A screen is one view of your product at a specific moment. One canvas in Pencil = one screen.

A screen has:
- **Layout** — how content is arranged (header, content area, footer/nav)
- **Components** — the UI elements on it (buttons, inputs, cards)
- **Content** — the actual text, labels, and data shown
- **State** — empty state? loading? error? success? Each is a different screen.

### UX flow

A UX flow is a sequence of screens that takes a user from a starting point to a goal. One `.pen` file = one flow.

Examples:
- **Onboarding flow** — Welcome → Sign Up → Verify Email → Dashboard
- **Checkout flow** — Cart → Shipping → Payment → Confirmation
- **Settings flow** — Settings list → Edit profile → Saved confirmation

Each screen in a flow has a clear purpose and one primary action. If a screen has three different things a user might want to do, it probably needs to be split.

### Prototype

A prototype is a clickable version of your screens — it looks like the real product but has no real data or backend. Its purpose is to test whether the flow makes sense before you build it.

`nib prototype` turns your Pencil screens into a clickable HTML file you can share with anyone. No deploy, no server, no account needed to view it.

---

## The design system

You've seen tokens and components defined above. A **design system** is what you get when you combine them with rules and documentation into a single source of truth — so every screen, every AI-generated component, and every developer's implementation stays consistent automatically.

Think of it like this:

```
Brand guidelines (your intent)
  ↓
Design tokens (the values)       ← nib generates from brand.md
  ├── Primitive tokens           color.brand.600 = #2563EB
  └── Semantic tokens            color.interactive.default = {color.brand.600}
  ↓
Components (the building blocks) ← nib kit scaffolds in Pencil
  ├── Each component uses tokens for every visual property
  └── Each component has defined states (default, hover, focus, disabled, error)
  ↓
Documentation (the rules)        ← nib generates brand.md + component specs
  ├── When to use which component
  ├── What each token means in context
  └── Accessibility requirements per component
  ↓
Platform outputs (the code)      ← nib brand build generates
  ├── CSS custom properties
  ├── Tailwind preset
  └── Pencil variables
```

### Why this matters for you

Without a system, every screen becomes a guessing game. You pick colors by eye, invent spacing values, and rebuild the same button three different ways. The result looks inconsistent — not because you lack taste, but because you lack constraints.

With a system:
- **Consistency is automatic.** You can't accidentally use the wrong shade of blue — there's only one blue.
- **AI agents stay on-brand.** Claude reads `brand.md` before generating any UI and uses the exact tokens, not hardcoded hex values.
- **Developers implement correctly.** They consume the CSS variables or Tailwind preset, not a Figma file they have to interpret.
- **Changes propagate everywhere.** Update one token value and every component that references it updates in every screen and every output.

### What your design system looks like in practice

After running `nib brand init` + `nib brand push` + `nib kit`, your system is:

| Layer | What it contains |
|---|---|
| **Primitive tokens**<br>`tokens/color/primitives.tokens.json` | Raw color scales — 11 steps per color |
| **Semantic tokens**<br>`tokens/color/semantic-light.tokens.json` | Purpose-mapped aliases — interactive, text, background, feedback |
| **Typography tokens**<br>`tokens/typography.tokens.json` | Font roles, sizes, line heights |
| **Spacing + layout**<br>`tokens/spacing.tokens.json` | The spacing scale, border radius, shadows |
| **Component contracts**<br>`.nib/components/*.contract.json` | Per-component: token slots, states, ARIA patterns |
| **AI context**<br>`docs/design/system/brand.md` | Plain-language rules any AI agent reads before writing UI |
| **CSS output**<br>`build/css/variables.css` | Drop into any web project |
| **Tailwind preset**<br>`build/tailwind/preset.js` | Extend your Tailwind config |
| **Pencil file**<br>`docs/design/system/design-system.pen` | Tokens + component kit, live in Pencil |

::: tip You don't build this manually
nib generates the entire system from your `brand.md` brief. What would take a design team weeks to produce, nib generates in seconds.
:::

---

## Basic design principles

You don't need a design degree. These five principles will take you 90% of the way.

### 1. Visual hierarchy — guide the eye

Every screen has one most important thing. Make it obvious.

- **Size**: bigger = more important
- **Weight**: bold draws attention before regular
- **Color**: brand color for primary actions, neutral for secondary
- **Position**: top-left is read first (in left-to-right languages), center for important single actions

**In practice:** Your primary CTA button ("Get started", "Sign up", "Save") should be the most visually prominent thing on the screen. Everything else is secondary.

### 2. Spacing — breathe

Cramped UI feels cheap. Spacing is not wasted space — it creates structure.

Use your spacing tokens consistently:
- `spacing.xs` (4px) — between an icon and its label
- `spacing.sm` (8px) — between related elements in a list
- `spacing.md` (16px) — between form fields, inside cards
- `spacing.lg` (24px) — between sections
- `spacing.xl` (32px+) — section headers, page padding

**In practice:** When something feels off, add more spacing first. 9 times out of 10 that's the fix.

### 3. Alignment — create order

Randomly placed elements look amateurish. Aligned elements feel intentional.

- Align everything to a grid (Pencil has grid snapping built in)
- Left-align body text (centered text is hard to read in paragraphs)
- Align form labels consistently (all left, or all top — never mixed)
- Use consistent left margins — if your content starts at 24px on one screen, do it on all screens

### 4. Color — use tokens, not hex

Never pick colors by eye. Always use your semantic tokens:

| Token | When to use |
|---|---|
| `color.interactive.default` | Primary buttons, links, checkboxes |
| `color.interactive.hover` | What happens on hover — don't invent this |
| `color.text.primary` | Body text, headings |
| `color.text.secondary` | Labels, captions, placeholders |
| `color.background.primary` | Main page background |
| `color.surface.primary` | Cards, modals, sidebars |
| `color.feedback.error` | Error states, destructive actions |
| `color.feedback.success` | Confirmations, completed states |

If you're reaching for a hex code, stop and find the right token instead.

### 5. Contrast — make it readable

Text must be readable. This isn't a preference, it's a legal accessibility requirement (WCAG AA).

- Small text (below 18px) needs a **4.5:1** contrast ratio
- Large text (18px+ or bold 14px+) needs **3:1**
- Interactive elements (buttons, inputs) need **3:1** against their background

`nib brand audit` checks every color pair in your token system automatically. Run it before every handoff.

---

## Designing a UX flow step by step

### Step 1: Write the user story

Before opening Pencil, write one sentence:

> "A user who [starting state] wants to [goal] so they can [outcome]."

Example: *"A user who just discovered the product wants to create an account so they can start using it."*

### Step 2: Map the steps

Break the goal into discrete steps. Each step is likely one screen.

| # | Screen | User's job | Primary action |
|---|---|---|---|
| 1 | Welcome | Understand the value | "Get started" |
| 2 | Sign Up | Enter credentials | "Create account" |
| 3 | Verify Email | Confirm they own the email | "Resend email" / wait |
| 4 | Done | Transition to the product | Auto-redirect |

Rule of thumb: **4–7 screens per flow** is healthy. Under 3 might be incomplete. Over 10 probably needs splitting.

### Step 3: Identify the components you need

Go through each screen and list the components:

- Welcome → Button (primary CTA), maybe a text/image block
- Sign Up → TextInput (email), TextInput (password), Button, link ("Already have an account?")
- Verify Email → Text block, Button (resend), possibly a countdown

### Step 4: Design in Pencil

1. One canvas per screen — name them clearly ("Welcome", "Sign Up", "Verify Email")
2. Use component kit frames from `design-system.pen` — drag them in, don't recreate
3. Use token variables for fills and text colors — e.g. `{var.color-interactive-default}`
4. Put the primary action at the bottom right (or centered for single-action screens)
5. Design the error state for every form — not just the happy path

### Step 5: Write the flow README

Fill in the screen README template (see [Project Structure](/guide/project-structure#screen-readme-template)) with your screens, edge cases, and navigation links. AI agents use this to implement the screens without you re-explaining everything.

### Step 6: Capture and prototype

```sh
nib capture docs/design/screens/01-sign-up/sign-up.pen
nib build docs/design/screens/01-sign-up/sign-up.design.json \
  --config nib.config.json --standalone -o prototype/
```

Click through it. Does it feel right? Does the primary action on each screen match what the user needs to do? Is anything confusing?

---

## Common UI patterns to steal

You don't need to invent everything. These patterns work and users already know them.

### Authentication
- Sign up: email + password, or social login (Google, GitHub)
- Sign in: email + password + "Forgot password?" link
- Forgot password: email field + confirmation sent screen
- Verify email: static info screen, resend button

### Onboarding (after sign-up)
- Welcome screen: personalize with user's name
- 1–3 setup steps: collect what you need to personalize the experience
- First action: get them to the "aha moment" as fast as possible
- Completion: celebrate with a success state

### Dashboard / home
- Navigation: sidebar (desktop) or bottom bar (mobile)
- Summary cards: key metrics at a glance
- Recent activity list: what happened last
- Primary action: always visible ("+ New", "Create", "Add")

### Empty states
Every list, table, or feed needs an empty state: an icon, a friendly message, and a CTA to add the first item. Don't leave users staring at a blank box.

### Forms
- Label above input (not placeholder text as label — placeholders disappear on type)
- Inline validation errors: show them on blur, not on submit
- One primary action per form (Save, Submit, Continue)
- Disabled state for the primary button until required fields are valid

---

## Go deeper

These are the resources worth reading when you're ready:

| Resource | What you'll learn |
|---|---|
| [Refactoring UI](https://refactoringui.com) | The definitive guide for builders who design. Practical, opinionated, no fluff. |
| [Laws of UX](https://lawsofux.com) | 21 psychological principles that explain why design decisions work |
| [Nielsen Norman Group](https://nngroup.com/articles) | Evidence-based UX research — search any pattern and find how users actually behave |
| [Checklist Design](https://www.checklist.design) | Best practices for every UI component, one checklist at a time |
| [Contrast Checker](https://webaim.org/resources/contrastchecker/) | Manual WCAG contrast checking (nib automates this with `nib brand audit`) |
| [Component Gallery](https://component.gallery) | Real-world examples of every UI component across products |
| [Mobbin](https://mobbin.com) | Screenshots of real app flows — search "sign up flow", "onboarding", etc. |
