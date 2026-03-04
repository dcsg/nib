/**
 * Validation checks V-01 through V-11 for nib brand validate.
 *
 * All checks are pure functions that operate on a flat token map
 * derived from the DTCG token files.
 */

import type { ComponentContract, ComponentRegistry, ValidationIssue } from "../../types/brand.js";

/** A flat representation of a single token for validation */
export interface FlatToken {
  /** Dot-separated token path, e.g. "color.brand.500" */
  path: string;
  $type?: string;
  $value: unknown;
}

/**
 * Flatten a nested DTCG token object into an array of FlatToken.
 * Leaf nodes are those that have a $value property.
 */
export function flattenForValidation(
  obj: Record<string, unknown>,
  prefix: string = "",
  parentType?: string,
): FlatToken[] {
  const results: FlatToken[] = [];
  const currentType = (obj.$type as string | undefined) ?? parentType;

  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith("$")) continue;
    const path = prefix ? `${prefix}.${key}` : key;

    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      const node = val as Record<string, unknown>;
      if ("$value" in node) {
        results.push({
          path,
          $type: (node.$type as string | undefined) ?? currentType,
          $value: node.$value,
        });
      } else {
        results.push(...flattenForValidation(node, path, currentType));
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// V-01: DTCG schema compliance — every token has $type and $value
// ---------------------------------------------------------------------------

export function checkV01(tokens: FlatToken[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const token of tokens) {
    if (token.$type === undefined) {
      issues.push({
        check: "V-01",
        token: token.path,
        message: "missing $type",
      });
    }
    if (token.$value === undefined || token.$value === null) {
      issues.push({
        check: "V-01",
        token: token.path,
        message: "missing $value",
      });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// V-02: Required token categories present
// ---------------------------------------------------------------------------

const REQUIRED_CATEGORIES = ["color", "typography", "spacing", "borderRadius", "elevation"] as const;

export function checkV02(
  tokenFiles: Record<string, Record<string, unknown>>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // Map each category to its expected root key in the token files
  const categoryMap: Record<string, string> = {
    color: "color",
    typography: "font-family", // typography file uses font-family as root key
    spacing: "spacing",
    borderRadius: "border-radius",
    elevation: "elevation",
  };

  for (const category of REQUIRED_CATEGORIES) {
    const rootKey = categoryMap[category] ?? category;
    const found = Object.values(tokenFiles).some((file) => rootKey in file);
    if (!found) {
      issues.push({
        check: "V-02",
        token: category,
        message: `required token category "${category}" is missing`,
      });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// V-03: Required semantic tokens present
// ---------------------------------------------------------------------------

const REQUIRED_SEMANTIC_TOKENS = [
  "color.interactive.default",
  "color.background.default",
  "color.text.default",
  "color.text.muted",
  "color.border.default",
] as const;

// Alternate semantic paths that Phase 1 uses (background.primary instead of background.default, etc.)
const SEMANTIC_ALIASES: Record<string, string[]> = {
  "color.interactive.default": ["color.interactive.default"],
  "color.background.default": ["color.background.default", "color.background.primary"],
  "color.text.default": ["color.text.default", "color.text.primary"],
  "color.text.muted": ["color.text.muted", "color.text.secondary", "color.text.tertiary"],
  "color.border.default": ["color.border.default", "color.border.primary"],
};

export function checkV03(tokens: FlatToken[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const paths = new Set(tokens.map((t) => t.path));

  for (const required of REQUIRED_SEMANTIC_TOKENS) {
    const aliases = SEMANTIC_ALIASES[required] ?? [required];
    const found = aliases.some((alias) => paths.has(alias));
    if (!found) {
      issues.push({
        check: "V-03",
        token: required,
        message: `required semantic token "${required}" is missing`,
      });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// V-04: Naming conventions — kebab-case segments, no camelCase, no spaces
// ---------------------------------------------------------------------------

/** Test a single path segment for naming violations */
function hasNamingViolation(segment: string): boolean {
  // Allow: lowercase letters, digits, hyphens
  // Disallow: uppercase letters (camelCase), spaces, underscores
  return /[A-Z\s_]/.test(segment);
}

export function checkV04(tokens: FlatToken[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const token of tokens) {
    const segments = token.path.split(".");
    for (const segment of segments) {
      if (hasNamingViolation(segment)) {
        issues.push({
          check: "V-04",
          token: token.path,
          message: `naming violation in segment "${segment}" — use kebab-case (lowercase, hyphens only)`,
        });
        break; // one issue per token
      }
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// V-05: Typography scale completeness — at minimum xs, sm, base, lg, xl, 2xl
// ---------------------------------------------------------------------------

const REQUIRED_FONT_SIZE_STEPS = ["xs", "sm", "base", "lg", "xl", "2xl"] as const;

// Phase 1 uses role-based names; map them to the required steps where possible
const FONT_SIZE_STEP_ALIASES: Record<string, string[]> = {
  xs: ["xs", "caption"],
  sm: ["sm", "label"],
  base: ["base", "body"],
  lg: ["lg", "body-lg"],
  xl: ["xl", "heading-sm", "heading"],
  "2xl": ["2xl", "heading-lg", "display"],
};

export function checkV05(tokens: FlatToken[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Find all font-size tokens (kebab-case path)
  const fontSizeTokens = tokens.filter(
    (t) => t.path.startsWith("font-size.") || t.$type === "dimension" && t.path.includes("font-size"),
  );

  if (fontSizeTokens.length === 0) {
    // No font-size tokens at all — report as missing scale
    issues.push({
      check: "V-05",
      token: "font-size",
      message: "no font-size tokens found — type scale is incomplete",
    });
    return issues;
  }

  const fontSizeNames = new Set(
    fontSizeTokens.map((t) => {
      const parts = t.path.split(".");
      return parts[parts.length - 1] ?? "";
    }),
  );

  for (const step of REQUIRED_FONT_SIZE_STEPS) {
    const aliases = FONT_SIZE_STEP_ALIASES[step] ?? [step];
    const found = aliases.some((alias) => fontSizeNames.has(alias));
    if (!found) {
      issues.push({
        check: "V-05",
        token: `font-size.${step}`,
        message: `required type scale step "${step}" is missing`,
      });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// V-06: Hover-only information anti-pattern
// ---------------------------------------------------------------------------

/**
 * Detects tokens that declare hover-only states (e.g. tooltip visibility that
 * is only reachable via hover), which is an accessibility violation.
 *
 * In Phase 2, this checks for token names/paths that suggest hover-only
 * component contracts (e.g. tooltip.visible, tooltip.opacity paired with
 * no focus equivalent).
 */
export function checkV06(tokens: FlatToken[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Patterns that indicate hover-only state declarations
  const hoverOnlyPatterns = [
    /^component\.tooltip\.visible$/,
    /^component\.tooltip\.show$/,
    /\.hover-only\./,
    /\.hover-tooltip\./,
  ];

  for (const token of tokens) {
    for (const pattern of hoverOnlyPatterns) {
      if (pattern.test(token.path)) {
        issues.push({
          check: "V-06",
          token: token.path,
          message: "hover-only information anti-pattern: component state only reachable via hover",
        });
        break;
      }
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// V-07: Composite type structure — shadow, typography, transition must be objects
// ---------------------------------------------------------------------------

export function checkV07(tokens: FlatToken[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const compositeTypes = new Set(["shadow", "typography", "transition"]);

  for (const token of tokens) {
    if (!token.$type || !compositeTypes.has(token.$type)) continue;

    // DTCG allows composite tokens to reference another token via "{path}" syntax.
    // Only flag strings that are NOT DTCG references (i.e. raw string values).
    if (typeof token.$value === "string" && !token.$value.startsWith("{")) {
      issues.push({
        check: "V-07",
        token: token.path,
        message: `composite type "${token.$type}" must be a structured object or a DTCG reference, not a raw string`,
      });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// V-08: All contracts in registry have required fields
// Required: name, widgetType, anatomy, states, a11y, tokens
// ---------------------------------------------------------------------------

const REQUIRED_CONTRACT_FIELDS = [
  "name",
  "widgetType",
  "anatomy",
  "states",
  "a11y",
  "tokens",
] as const;

export function checkV08(
  contracts: Map<string, ComponentContract>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [name, contract] of contracts) {
    for (const field of REQUIRED_CONTRACT_FIELDS) {
      if (
        contract[field] === undefined ||
        contract[field] === null ||
        (typeof contract[field] === "object" &&
          !Array.isArray(contract[field]) &&
          Object.keys(contract[field] as object).length === 0)
      ) {
        issues.push({
          check: "V-08",
          token: `${name}.contract.json`,
          message: `required field "${field}" is missing or empty in ${name} contract`,
        });
      }
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// V-09: No hover-only states in any contract
// A state with hoverOnly: true is an accessibility violation
// ---------------------------------------------------------------------------

export function checkV09(
  contracts: Map<string, ComponentContract>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [name, contract] of contracts) {
    for (const [stateName, stateDef] of Object.entries(contract.states)) {
      if (stateDef.hoverOnly === true) {
        issues.push({
          check: "V-09",
          token: `${name}.states.${stateName}`,
          message: `hover-only state "${stateName}" in ${name} contract is an accessibility violation — information must be accessible without hover`,
        });
      }
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// V-10: Component tokens reference valid semantic token paths
// Token references use {semantic.token.path} syntax
// ---------------------------------------------------------------------------

/** Extract all DTCG references {foo.bar} from a string */
function extractRefs(value: string): string[] {
  const matches = value.match(/\{([^}]+)\}/g) ?? [];
  return matches.map((m) => m.slice(1, -1));
}

export function checkV10(
  contracts: Map<string, ComponentContract>,
  allTokenPaths: Set<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [name, contract] of contracts) {
    for (const [part, stateMap] of Object.entries(contract.tokens)) {
      for (const [state, propMap] of Object.entries(stateMap)) {
        for (const [prop, tokenRef] of Object.entries(propMap)) {
          // Skip composite values (shadow objects etc.) — they don't reference semantic tokens by path
          if (typeof tokenRef !== "string") continue;
          // tokenRef is a component-level alias like "button.bg.primary"
          // or a semantic reference like "{color.interactive.default}"
          const refs = extractRefs(tokenRef);

          for (const ref of refs) {
            // Check if the semantic token path exists
            if (!allTokenPaths.has(ref)) {
              issues.push({
                check: "V-10",
                token: `${name}.tokens.${part}.${state}.${prop}`,
                message: `token reference "{${ref}}" in ${name} contract does not resolve to a known semantic token`,
              });
            }
          }

          // If the tokenRef has no {} wrapper, it's a component alias path
          // We only validate {} references — component aliases are user-defined
        }
      }
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// V-11: All widget types use valid WAI-ARIA template patterns
//
// button → must have keyboard.Enter AND keyboard.Space
// dialog → must have keyboard.Escape AND focusTrap: true
// tabs   → must have keyboard.ArrowLeft/ArrowRight
// combobox → must have keyboard.ArrowDown AND keyboard.Enter AND keyboard.Escape
// tooltip → must have focusBehavior: "not-focusable"
// ---------------------------------------------------------------------------

const WIDGET_TYPE_ARIA_REQUIREMENTS: Record<
  string,
  (contract: ComponentContract) => string | null
> = {
  button: (c) => {
    const keys = Object.keys(c.a11y.keyboard);
    if (!keys.includes("Enter") || !keys.includes("Space")) {
      return "button widget type must have keyboard.Enter and keyboard.Space in a11y.keyboard";
    }
    return null;
  },
  dialog: (c) => {
    const keys = Object.keys(c.a11y.keyboard);
    if (!keys.includes("Escape")) {
      return "dialog widget type must have keyboard.Escape in a11y.keyboard";
    }
    if (!c.a11y.focusTrap) {
      return "dialog widget type must have a11y.focusTrap: true";
    }
    return null;
  },
  tabs: (c) => {
    const keys = Object.keys(c.a11y.keyboard);
    if (!keys.includes("ArrowLeft") || !keys.includes("ArrowRight")) {
      return "tabs widget type must have keyboard.ArrowLeft and keyboard.ArrowRight in a11y.keyboard";
    }
    return null;
  },
  combobox: (c) => {
    const keys = Object.keys(c.a11y.keyboard);
    if (!keys.includes("ArrowDown") || !keys.includes("Enter") || !keys.includes("Escape")) {
      return "combobox widget type must have keyboard.ArrowDown, keyboard.Enter, and keyboard.Escape in a11y.keyboard";
    }
    return null;
  },
  tooltip: (c) => {
    if (c.a11y.focusBehavior !== "not-focusable") {
      return 'tooltip widget type must have a11y.focusBehavior: "not-focusable"';
    }
    return null;
  },
};

export function checkV11(
  contracts: Map<string, ComponentContract>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [name, contract] of contracts) {
    const checker = WIDGET_TYPE_ARIA_REQUIREMENTS[contract.widgetType];
    if (!checker) continue;

    const message = checker(contract);
    if (message) {
      issues.push({
        check: "V-11",
        token: `${name}.a11y`,
        message: `${name} (${contract.widgetType}): ${message}`,
      });
    }
  }
  return issues;
}
