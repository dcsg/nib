/**
 * Component token tier generator.
 *
 * generateComponentTokens(contract, semanticTokens) →
 *   DTCG token group for the component (third tier: Primitives → Semantic → Component).
 *
 * Naming pattern: {component}.{anatomy}.{variant}.{state} → references semantic token
 * Output format: DTCG with $extensions.nib.tier = "component"
 */

import type { ComponentContract, ComponentTokenValue, DtcgTokenGroup } from "../../types/brand.js";

/** DTCG token with required fields */
interface ComponentDtcgToken {
  $type: string;
  $value: string | Record<string, string>;
  $description?: string;
  $extensions: {
    nib: {
      tier: "component";
      component: string;
    };
  };
}

/** Infer DTCG $type from token value string */
function inferTokenType(value: string): string {
  if (value.includes("color") || value.includes("bg") || value.includes("text") || value.includes("border") || value.includes("focus")) {
    return "color";
  }
  if (value.includes("radius") || value.includes("spacing") || value.includes("padding") || value.includes("gap") || value.includes("width") || value.includes("height")) {
    return "dimension";
  }
  if (value.includes("shadow") || value.includes("elevation")) {
    return "shadow";
  }
  if (value.includes("font")) {
    return "fontFamily";
  }
  // Default to dimension for unknown CSS property references
  return "dimension";
}

/** Build a DTCG token entry from a token binding value */
function makeToken(
  componentName: string,
  tokenValue: ComponentTokenValue,
  description?: string,
): ComponentDtcgToken {
  const isComposite = typeof tokenValue !== "string";
  const type = isComposite ? "shadow" : inferTokenType(tokenValue);
  const $value = isComposite ? tokenValue : `{${tokenValue}}`;
  return {
    $type: type,
    $value,
    $description: description,
    $extensions: {
      nib: {
        tier: "component",
        component: componentName,
      },
    },
  };
}

/**
 * Generate a DTCG token group for the component's token bindings.
 *
 * The token bindings in the contract use component-level references
 * (e.g. "button.bg.primary") which themselves reference semantic tokens.
 * This function wraps those into a proper DTCG token group.
 *
 * Structure: component-name → anatomy-part → state → CSS property tokens
 */
export function generateComponentTokens(
  contract: ComponentContract,
): DtcgTokenGroup {
  const componentKey = contract.name.toLowerCase().replace(/\s+/g, "-");
  const componentGroup: Record<string, unknown> = {
    $description: `Component tokens for ${contract.name}`,
  };

  for (const [part, stateMap] of Object.entries(contract.tokens)) {
    const partGroup: Record<string, unknown> = {};

    for (const [state, propMap] of Object.entries(stateMap)) {
      const stateGroup: Record<string, unknown> = {};

      for (const [prop, tokenRef] of Object.entries(propMap)) {
        const description = `${contract.name} ${part} ${prop} in ${state} state`;
        stateGroup[prop] = makeToken(contract.name, tokenRef, description);
      }

      if (Object.keys(stateGroup).length > 0) {
        partGroup[state] = stateGroup;
      }
    }

    if (Object.keys(partGroup).length > 0) {
      componentGroup[part] = partGroup;
    }
  }

  return { [componentKey]: componentGroup } as DtcgTokenGroup;
}

/**
 * Generate shorthand alias tokens for the component.
 *
 * For example, button.bg.primary → {color.interactive.default}
 * These are the "component alias" tokens that component implementations reference.
 * They live alongside the detailed anatomy tokens.
 */
export function generateComponentAliases(
  contract: ComponentContract,
): DtcgTokenGroup {
  const componentKey = contract.name.toLowerCase().replace(/\s+/g, "-");
  const aliasGroup: Record<string, unknown> = {
    $description: `Alias tokens for ${contract.name} — reference these in component implementations`,
  };

  // Collect all unique token references from the contract tokens
  const seen = new Set<string>();
  for (const stateMap of Object.values(contract.tokens)) {
    for (const propMap of Object.values(stateMap)) {
      for (const tokenRef of Object.values(propMap)) {
        if (typeof tokenRef === "string" && !seen.has(tokenRef)) {
          seen.add(tokenRef);
          // tokenRef is already in component-level naming (e.g. "button.bg.primary")
          // We emit it as a passthrough alias pointing to itself for DTCG completeness
        }
      }
    }
  }

  // If the contract has well-structured tokens, emit them as explicit aliases
  if (contract.tokens.root?.default) {
    for (const [prop, ref] of Object.entries(contract.tokens.root.default)) {
      if (typeof ref !== "string") continue; // skip composite values in alias group
      const type = inferTokenType(ref);
      aliasGroup[prop] = {
        $type: type,
        $value: `{${ref}}`,
        $description: `${contract.name} root ${prop} alias`,
        $extensions: {
          nib: { tier: "component", component: contract.name },
        },
      };
    }
  }

  if (Object.keys(aliasGroup).length <= 1) {
    return {} as DtcgTokenGroup;
  }

  return { [`${componentKey}-aliases`]: aliasGroup } as DtcgTokenGroup;
}
