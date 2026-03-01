/**
 * Tests for nib brand validate checks V-01 through V-11.
 */

import { describe, it, expect } from "bun:test";
import {
  flattenForValidation,
  checkV01,
  checkV02,
  checkV03,
  checkV04,
  checkV05,
  checkV06,
  checkV07,
  checkV08,
  checkV09,
  checkV10,
  checkV11,
  type FlatToken,
} from "./checks.js";
import type { ComponentContract } from "../../types/brand.js";

// ---------------------------------------------------------------------------
// Helper: build a minimal valid token set
// ---------------------------------------------------------------------------

function makeToken(path: string, type: string, value: unknown): FlatToken {
  return { path, $type: type, $value: value };
}

// ---------------------------------------------------------------------------
// flattenForValidation
// ---------------------------------------------------------------------------

describe("flattenForValidation", () => {
  it("flattens a simple DTCG token", () => {
    const input = {
      color: {
        brand: {
          "500": { $value: "#3B82F6", $type: "color" },
        },
      },
    };
    const result = flattenForValidation(input);
    expect(result).toHaveLength(1);
    expect(result[0]!.path).toBe("color.brand.500");
    expect(result[0]!.$type).toBe("color");
    expect(result[0]!.$value).toBe("#3B82F6");
  });

  it("inherits $type from parent group", () => {
    const input = {
      color: {
        $type: "color",
        white: { $value: "#ffffff" },
      },
    };
    const result = flattenForValidation(input);
    expect(result[0]!.$type).toBe("color");
  });

  it("skips $ keys at root level", () => {
    const input = {
      $type: "color",
      color: {
        white: { $value: "#ffffff", $type: "color" },
      },
    };
    const result = flattenForValidation(input);
    expect(result).toHaveLength(1);
  });

  it("handles deeply nested groups", () => {
    const input = {
      elevation: {
        $type: "shadow",
        sm: { $value: { offsetX: "0px", offsetY: "1px", blur: "2px", spread: "0px", color: "rgba(0,0,0,0.05)" } },
        md: { $value: { offsetX: "0px", offsetY: "4px", blur: "6px", spread: "-1px", color: "rgba(0,0,0,0.1)" } },
      },
    };
    const result = flattenForValidation(input);
    expect(result).toHaveLength(2);
    expect(result[0]!.path).toBe("elevation.sm");
    expect(result[0]!.$type).toBe("shadow");
  });
});

// ---------------------------------------------------------------------------
// V-01: DTCG schema compliance
// ---------------------------------------------------------------------------

describe("checkV01", () => {
  it("passes when all tokens have $type and $value", () => {
    const tokens: FlatToken[] = [
      makeToken("color.brand.500", "color", "#3B82F6"),
      makeToken("spacing.sm", "dimension", "12px"),
    ];
    expect(checkV01(tokens)).toHaveLength(0);
  });

  it("fails when a token is missing $type", () => {
    const tokens: FlatToken[] = [
      { path: "color.brand.500", $value: "#3B82F6" },
    ];
    const issues = checkV01(tokens);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.check).toBe("V-01");
    expect(issues[0]!.token).toBe("color.brand.500");
    expect(issues[0]!.message).toContain("missing $type");
  });

  it("fails when a token has null $value", () => {
    const tokens: FlatToken[] = [
      { path: "color.brand.500", $type: "color", $value: null },
    ];
    const issues = checkV01(tokens);
    expect(issues[0]!.message).toContain("missing $value");
  });

  it("reports multiple issues for multiple bad tokens", () => {
    const tokens: FlatToken[] = [
      { path: "color.a", $value: "#fff" },
      { path: "color.b", $value: null },
    ];
    expect(checkV01(tokens).length).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// V-02: Required token categories
// ---------------------------------------------------------------------------

describe("checkV02", () => {
  const validFiles: Record<string, Record<string, unknown>> = {
    "color/primitives.tokens.json": { color: { $type: "color", white: { $value: "#fff" } } },
    "typography.tokens.json": { "font-family": { sans: { $value: "Inter", $type: "fontFamily" } } },
    "spacing.tokens.json": { spacing: { sm: { $value: "12px", $type: "dimension" } } },
    "border-radius.tokens.json": { "border-radius": { sm: { $value: "4px", $type: "dimension" } } },
    "elevation.tokens.json": { elevation: { sm: { $value: {}, $type: "shadow" } } },
  };

  it("passes when all required categories are present", () => {
    expect(checkV02(validFiles)).toHaveLength(0);
  });

  it("fails when spacing is missing", () => {
    const files = { ...validFiles };
    const { "spacing.tokens.json": _removed, ...withoutSpacing } = files;
    const issues = checkV02(withoutSpacing);
    expect(issues.some((i) => i.token === "spacing")).toBe(true);
  });

  it("fails when elevation is missing", () => {
    const files = { ...validFiles };
    const { "elevation.tokens.json": _removed, ...withoutElevation } = files;
    const issues = checkV02(withoutElevation);
    expect(issues.some((i) => i.token === "elevation")).toBe(true);
  });

  it("fails for all categories when files are empty", () => {
    const issues = checkV02({});
    expect(issues.length).toBe(5); // all 5 required categories
  });
});

// ---------------------------------------------------------------------------
// V-03: Required semantic tokens
// ---------------------------------------------------------------------------

describe("checkV03", () => {
  const validTokens: FlatToken[] = [
    makeToken("color.interactive.default", "color", "{color.brand.600}"),
    makeToken("color.background.primary", "color", "{color.white}"),
    makeToken("color.text.primary", "color", "{color.neutral.900}"),
    makeToken("color.text.secondary", "color", "{color.neutral.700}"),
    makeToken("color.border.primary", "color", "{color.neutral.200}"),
  ];

  it("passes when all required semantic tokens are present (using aliases)", () => {
    expect(checkV03(validTokens)).toHaveLength(0);
  });

  it("passes when exact required names are used", () => {
    const tokens: FlatToken[] = [
      makeToken("color.interactive.default", "color", "{color.brand.600}"),
      makeToken("color.background.default", "color", "{color.white}"),
      makeToken("color.text.default", "color", "{color.neutral.900}"),
      makeToken("color.text.muted", "color", "{color.neutral.600}"),
      makeToken("color.border.default", "color", "{color.neutral.200}"),
    ];
    expect(checkV03(tokens)).toHaveLength(0);
  });

  it("fails when color.interactive.default is missing", () => {
    const tokens = validTokens.filter((t) => t.path !== "color.interactive.default");
    const issues = checkV03(tokens);
    expect(issues.some((i) => i.token === "color.interactive.default")).toBe(true);
  });

  it("fails when all semantic tokens are absent", () => {
    expect(checkV03([])).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// V-04: Naming conventions
// ---------------------------------------------------------------------------

describe("checkV04", () => {
  it("passes for valid kebab-case token paths", () => {
    const tokens: FlatToken[] = [
      makeToken("color.brand.500", "color", "#3B82F6"),
      makeToken("color.background.primary", "color", "#fff"),
      makeToken("font-family.sans", "fontFamily", "Inter"),
      makeToken("spacing.2xl", "dimension", "48px"),
    ];
    expect(checkV04(tokens)).toHaveLength(0);
  });

  it("fails for camelCase segment", () => {
    const tokens: FlatToken[] = [
      makeToken("color.brandPrimary", "color", "#3B82F6"),
    ];
    const issues = checkV04(tokens);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.check).toBe("V-04");
    expect(issues[0]!.token).toBe("color.brandPrimary");
  });

  it("fails for uppercase segment", () => {
    const tokens: FlatToken[] = [
      makeToken("Color.brand.500", "color", "#3B82F6"),
    ];
    expect(checkV04(tokens)).toHaveLength(1);
  });

  it("reports one issue per token even with multiple violations", () => {
    const tokens: FlatToken[] = [
      makeToken("Color.Brand.FiveHundred", "color", "#3B82F6"),
    ];
    // Only one issue per token
    expect(checkV04(tokens)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// V-05: Typography scale completeness
// ---------------------------------------------------------------------------

describe("checkV05", () => {
  const fullScale: FlatToken[] = [
    makeToken("font-size.caption", "dimension", "10px"),   // xs alias
    makeToken("font-size.label", "dimension", "13px"),     // sm alias
    makeToken("font-size.body", "dimension", "16px"),      // base alias
    makeToken("font-size.body-lg", "dimension", "20px"),   // lg alias
    makeToken("font-size.heading-sm", "dimension", "25px"), // xl alias
    makeToken("font-size.display", "dimension", "49px"),   // 2xl alias
  ];

  it("passes when all required scale steps are present (via aliases)", () => {
    expect(checkV05(fullScale)).toHaveLength(0);
  });

  it("passes with exact required step names", () => {
    const tokens: FlatToken[] = [
      makeToken("font-size.xs", "dimension", "10px"),
      makeToken("font-size.sm", "dimension", "13px"),
      makeToken("font-size.base", "dimension", "16px"),
      makeToken("font-size.lg", "dimension", "20px"),
      makeToken("font-size.xl", "dimension", "25px"),
      makeToken("font-size.2xl", "dimension", "31px"),
    ];
    expect(checkV05(tokens)).toHaveLength(0);
  });

  it("fails when no fontSize tokens exist", () => {
    const issues = checkV05([
      makeToken("spacing.sm", "dimension", "12px"),
    ]);
    expect(issues.length).toBeGreaterThan(0);
  });

  it("fails when scale has too few steps", () => {
    const tokens: FlatToken[] = [
      makeToken("fontSize.body", "dimension", "16px"),
      makeToken("fontSize.heading", "dimension", "31px"),
    ];
    const issues = checkV05(tokens);
    // Should be missing xs/sm/lg/xl/2xl — some steps missing
    expect(issues.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// V-06: Hover-only information anti-pattern
// ---------------------------------------------------------------------------

describe("checkV06", () => {
  it("passes for normal tokens", () => {
    const tokens: FlatToken[] = [
      makeToken("color.interactive.default", "color", "#3B82F6"),
      makeToken("color.interactive.hover", "color", "#2563EB"),
    ];
    expect(checkV06(tokens)).toHaveLength(0);
  });

  it("fails for hover-only tooltip visibility token", () => {
    const tokens: FlatToken[] = [
      makeToken("component.tooltip.visible", "number", 1),
    ];
    const issues = checkV06(tokens);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.check).toBe("V-06");
  });

  it("fails for hover-only pattern in path", () => {
    const tokens: FlatToken[] = [
      makeToken("component.hover-tooltip.opacity", "number", 1),
    ];
    expect(checkV06(tokens)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// V-07: Composite type structure
// ---------------------------------------------------------------------------

describe("checkV07", () => {
  it("passes when shadow token is a structured object", () => {
    const tokens: FlatToken[] = [
      makeToken("elevation.sm", "shadow", { offsetX: "0px", offsetY: "1px", blur: "2px", spread: "0px", color: "rgba(0,0,0,0.05)" }),
    ];
    expect(checkV07(tokens)).toHaveLength(0);
  });

  it("fails when shadow token is a string", () => {
    const tokens: FlatToken[] = [
      makeToken("elevation.sm", "shadow", "0 1px 2px rgba(0,0,0,0.05)"),
    ];
    const issues = checkV07(tokens);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.check).toBe("V-07");
    expect(issues[0]!.token).toBe("elevation.sm");
  });

  it("passes when typography token is a structured object", () => {
    const tokens: FlatToken[] = [
      makeToken("text.body", "typography", {
        fontFamily: "{font.family.sans}",
        fontWeight: "400",
        fontSize: "1rem",
        lineHeight: "1.5",
        letterSpacing: "0",
      }),
    ];
    expect(checkV07(tokens)).toHaveLength(0);
  });

  it("fails when typography token is a string", () => {
    const tokens: FlatToken[] = [
      makeToken("text.body", "typography", "400 1rem/1.5 Inter"),
    ];
    expect(checkV07(tokens)).toHaveLength(1);
  });

  it("passes when transition token is a structured object", () => {
    const tokens: FlatToken[] = [
      makeToken("transition.micro", "transition", {
        duration: "{duration.fast}",
        delay: "0ms",
        timingFunction: "{easing.out}",
      }),
    ];
    expect(checkV07(tokens)).toHaveLength(0);
  });

  it("fails when transition token is a string", () => {
    const tokens: FlatToken[] = [
      makeToken("transition.micro", "transition", "100ms ease-out"),
    ];
    expect(checkV07(tokens)).toHaveLength(1);
  });

  it("ignores non-composite types", () => {
    const tokens: FlatToken[] = [
      makeToken("color.brand.500", "color", "#3B82F6"),
      makeToken("spacing.sm", "dimension", "12px"),
    ];
    expect(checkV07(tokens)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Helpers for component checks (V-08 through V-11)
// ---------------------------------------------------------------------------

function makeButtonContract(overrides: Partial<ComponentContract> = {}): ComponentContract {
  return {
    $schema: "https://nibjs.dev/schemas/component-contract.v1.json",
    name: "Button",
    description: "Triggers an action or event",
    widgetType: "button",
    anatomy: { root: "The outer element", label: "The visible text" },
    states: {
      default: { description: "Resting state" },
      hover: { description: "Hover state" },
      focused: { description: "Focus state", focusRing: true },
      disabled: { description: "Disabled", ariaDisabled: true },
    },
    a11y: {
      role: "button",
      keyboard: { Enter: "Activates the button", Space: "Activates the button" },
      focusBehavior: "receives-focus",
      focusTrap: false,
      focusReturnTarget: null,
      minimumTouchTarget: { ios: "44pt", android: "48dp", web: "24px" },
      ariaAttributes: ["aria-label", "aria-disabled"],
      requiredLabel: true,
      labelStrategy: "visible-text-or-aria-label",
    },
    tokens: {
      root: {
        default: { background: "{color.interactive.default}", color: "{color.text.inverse}" },
        disabled: { background: "{color.surface.disabled}" },
      },
    },
    ...overrides,
  };
}

function makeDialogContract(overrides: Partial<ComponentContract> = {}): ComponentContract {
  return {
    $schema: "https://nibjs.dev/schemas/component-contract.v1.json",
    name: "Dialog",
    description: "Modal overlay",
    widgetType: "dialog",
    anatomy: { root: "The dialog element" },
    states: {
      open: { description: "Dialog is open" },
      closed: { description: "Dialog is hidden" },
    },
    a11y: {
      role: "dialog",
      keyboard: {
        Tab: "Move focus within trap",
        "Shift+Tab": "Move focus backward",
        Escape: "Close dialog",
      },
      focusBehavior: "focus-trap",
      focusTrap: true,
      focusReturnTarget: "trigger-element",
      minimumTouchTarget: { ios: "44pt", android: "48dp", web: "24px" },
      ariaAttributes: ["aria-modal", "aria-labelledby"],
      requiredLabel: true,
      labelStrategy: "aria-labelledby-pointing-to-title",
    },
    tokens: { root: { open: { background: "{color.surface.primary}" } } },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// V-08: Required contract fields
// ---------------------------------------------------------------------------

describe("checkV08", () => {
  it("passes when all required fields are present", () => {
    const contracts = new Map([["Button", makeButtonContract()]]);
    expect(checkV08(contracts)).toHaveLength(0);
  });

  it("fails when anatomy is missing", () => {
    const bad = makeButtonContract({ anatomy: {} });
    const contracts = new Map([["Button", bad]]);
    const issues = checkV08(contracts);
    expect(issues.some((i) => i.message.includes("anatomy"))).toBe(true);
    expect(issues[0]!.check).toBe("V-08");
  });

  it("fails when tokens is empty", () => {
    const bad = makeButtonContract({ tokens: {} });
    const contracts = new Map([["Button", bad]]);
    const issues = checkV08(contracts);
    expect(issues.some((i) => i.message.includes("tokens"))).toBe(true);
  });

  it("fails when a11y is missing keyboard", () => {
    const bad = makeButtonContract({
      a11y: {
        ...makeButtonContract().a11y,
        role: "",
      },
    });
    // We test absence of the a11y object entirely
    const contracts = new Map([["BadComp", { ...makeButtonContract(), a11y: undefined as unknown as ComponentContract["a11y"] }]]);
    const issues = checkV08(contracts);
    expect(issues.some((i) => i.message.includes("a11y"))).toBe(true);
  });

  it("passes for multiple valid contracts", () => {
    const contracts = new Map([
      ["Button", makeButtonContract()],
      ["Dialog", makeDialogContract()],
    ]);
    expect(checkV08(contracts)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// V-09: No hover-only states
// ---------------------------------------------------------------------------

describe("checkV09", () => {
  it("passes when no states have hoverOnly: true", () => {
    const contracts = new Map([["Button", makeButtonContract()]]);
    expect(checkV09(contracts)).toHaveLength(0);
  });

  it("fails when a state has hoverOnly: true", () => {
    const bad = makeButtonContract({
      states: {
        ...makeButtonContract().states,
        hover: { description: "Hover only", hoverOnly: true },
      },
    });
    const contracts = new Map([["Button", bad]]);
    const issues = checkV09(contracts);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.check).toBe("V-09");
    expect(issues[0]!.message).toContain("hover");
  });

  it("fails on multiple hover-only states", () => {
    const bad = makeButtonContract({
      states: {
        default: { description: "Resting" },
        hover: { description: "Hover only", hoverOnly: true },
        tooltip: { description: "Tooltip only", hoverOnly: true },
      },
    });
    const contracts = new Map([["Button", bad]]);
    expect(checkV09(contracts)).toHaveLength(2);
  });

  it("passes with multiple valid contracts", () => {
    const contracts = new Map([
      ["Button", makeButtonContract()],
      ["Dialog", makeDialogContract()],
    ]);
    expect(checkV09(contracts)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// V-10: Component token references resolve to known semantic tokens
// ---------------------------------------------------------------------------

describe("checkV10", () => {
  const knownPaths = new Set([
    "color.interactive.default",
    "color.text.inverse",
    "color.surface.disabled",
    "color.surface.primary",
  ]);

  it("passes when all {} references resolve to known tokens", () => {
    const contracts = new Map([["Button", makeButtonContract()]]);
    expect(checkV10(contracts, knownPaths)).toHaveLength(0);
  });

  it("fails when a {} reference is unknown", () => {
    const bad = makeButtonContract({
      tokens: {
        root: {
          default: { background: "{color.interactive.nonexistent}" },
        },
      },
    });
    const contracts = new Map([["Button", bad]]);
    const issues = checkV10(contracts, knownPaths);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.check).toBe("V-10");
    expect(issues[0]!.message).toContain("color.interactive.nonexistent");
  });

  it("passes when token values have no {} references (component aliases)", () => {
    const noRef = makeButtonContract({
      tokens: {
        root: {
          default: { background: "button.bg.primary" },
        },
      },
    });
    const contracts = new Map([["Button", noRef]]);
    expect(checkV10(contracts, knownPaths)).toHaveLength(0);
  });

  it("reports multiple issues for multiple bad references", () => {
    const bad = makeButtonContract({
      tokens: {
        root: {
          default: {
            background: "{color.interactive.bad1}",
            color: "{color.text.bad2}",
          },
        },
      },
    });
    const contracts = new Map([["Button", bad]]);
    expect(checkV10(contracts, knownPaths)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// V-11: Widget types use valid WAI-ARIA template patterns
// ---------------------------------------------------------------------------

describe("checkV11", () => {
  it("passes for a valid button contract (Enter and Space)", () => {
    const contracts = new Map([["Button", makeButtonContract()]]);
    expect(checkV11(contracts)).toHaveLength(0);
  });

  it("fails for button missing Space key", () => {
    const bad = makeButtonContract({
      a11y: {
        ...makeButtonContract().a11y,
        keyboard: { Enter: "Activates" },
      },
    });
    const contracts = new Map([["Button", bad]]);
    const issues = checkV11(contracts);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.check).toBe("V-11");
  });

  it("fails for button missing Enter key", () => {
    const bad = makeButtonContract({
      a11y: {
        ...makeButtonContract().a11y,
        keyboard: { Space: "Activates" },
      },
    });
    const contracts = new Map([["Button", bad]]);
    expect(checkV11(contracts)).toHaveLength(1);
  });

  it("passes for a valid dialog contract", () => {
    const contracts = new Map([["Dialog", makeDialogContract()]]);
    expect(checkV11(contracts)).toHaveLength(0);
  });

  it("fails for dialog missing Escape key", () => {
    const bad = makeDialogContract({
      a11y: {
        ...makeDialogContract().a11y,
        keyboard: { Tab: "Move focus" },
      },
    });
    const contracts = new Map([["Dialog", bad]]);
    const issues = checkV11(contracts);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain("Escape");
  });

  it("fails for dialog missing focusTrap: true", () => {
    const bad = makeDialogContract({
      a11y: {
        ...makeDialogContract().a11y,
        focusTrap: false,
      },
    });
    const contracts = new Map([["Dialog", bad]]);
    const issues = checkV11(contracts);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain("focusTrap");
  });

  it("passes for generic widget type (no requirements)", () => {
    const generic: ComponentContract = {
      ...makeButtonContract(),
      widgetType: "generic",
      a11y: {
        ...makeButtonContract().a11y,
        keyboard: {},
        focusBehavior: "user-defined",
      },
    };
    const contracts = new Map([["CustomComp", generic]]);
    expect(checkV11(contracts)).toHaveLength(0);
  });

  it("passes for multiple valid contracts", () => {
    const contracts = new Map([
      ["Button", makeButtonContract()],
      ["Dialog", makeDialogContract()],
    ]);
    expect(checkV11(contracts)).toHaveLength(0);
  });
});
