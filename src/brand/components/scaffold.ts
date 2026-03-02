/**
 * Component contract scaffolder.
 *
 * scaffoldContract(name, options) — detects widget type from name heuristic,
 * loads the WAI-ARIA template, and returns a complete ComponentContract.
 */

import type {
  ComponentContract,
  ComponentInitOptions,
  WidgetType,
} from "../../types/brand.js";

/** DTCG schema URL for component contracts (v1) */
const SCHEMA_URL = "https://nibjs.dev/schemas/component-contract.v1.json";

/**
 * Detect widget type from component name using heuristics (FR-3).
 * Falls back to "generic" if no pattern matches.
 */
export function detectWidgetType(name: string): WidgetType {
  const lower = name.toLowerCase();

  if (lower.includes("checkbox")) return "checkbox";
  if (lower.includes("radio")) return "radio";
  if (lower.includes("switch") || lower.includes("toggle")) return "switch";
  if (lower.includes("dialog") || lower.includes("modal")) return "dialog";
  if (lower.includes("combobox") || lower.includes("select") || lower.includes("dropdown")) return "combobox";
  if (lower.includes("tooltip")) return "tooltip";
  if (lower.includes("tab")) return "tabs";
  if (lower.includes("input") || lower.includes("field") || lower.includes("textfield")) return "textinput";
  if (lower.includes("button") || lower.includes("btn")) return "button";
  if (lower.includes("badge") || lower.includes("tag") || lower.includes("chip")) return "badge";
  if (lower.includes("toast") || lower.includes("snackbar")) return "toast";
  if (lower.includes("alert") || lower.includes("banner")) return "alert";

  return "generic";
}

/** Load the WAI-ARIA template for the given widget type */
async function loadTemplate(widgetType: WidgetType): Promise<Partial<ComponentContract>> {
  switch (widgetType) {
    case "button": {
      const m = await import("./templates/button.js");
      return m.buttonTemplate;
    }
    case "textinput": {
      const m = await import("./templates/textinput.js");
      return m.textinputTemplate;
    }
    case "checkbox": {
      const m = await import("./templates/checkbox.js");
      return m.checkboxTemplate;
    }
    case "radio": {
      const m = await import("./templates/radio.js");
      return m.radioTemplate;
    }
    case "switch": {
      const m = await import("./templates/switch.js");
      return m.switchTemplate;
    }
    case "tabs": {
      const m = await import("./templates/tabs.js");
      return m.tabsTemplate;
    }
    case "dialog": {
      const m = await import("./templates/dialog.js");
      return m.dialogTemplate;
    }
    case "combobox": {
      const m = await import("./templates/combobox.js");
      return m.comboboxTemplate;
    }
    case "tooltip": {
      const m = await import("./templates/tooltip.js");
      return m.tooltipTemplate;
    }
    case "badge": {
      const m = await import("./templates/badge.js");
      return m.badgeTemplate;
    }
    case "toast": {
      const m = await import("./templates/toast.js");
      return m.toastTemplate;
    }
    case "alert": {
      const m = await import("./templates/alert.js");
      return m.alertTemplate;
    }
    case "generic":
    default: {
      const m = await import("./templates/generic.js");
      return m.genericTemplate;
    }
  }
}

/**
 * Scaffold a complete ComponentContract for the given component name.
 *
 * Detects widget type via heuristic (or uses options.widgetType),
 * merges the WAI-ARIA template, and applies any variant/size overrides
 * from options.
 */
export async function scaffoldContract(
  name: string,
  options: ComponentInitOptions = {},
): Promise<ComponentContract> {
  const widgetType = options.widgetType ?? detectWidgetType(name);
  const template = await loadTemplate(widgetType);

  // Build variants from options or fall back to template defaults
  const variants: Record<string, string> = {};
  if (options.variants && options.variants.length > 0) {
    for (const v of options.variants) {
      variants[v] = `${v} variant`;
    }
  } else if (template.variants) {
    Object.assign(variants, template.variants);
  }

  // Build sizes from options or fall back to template defaults
  const sizes: Record<string, { height?: string; paddingX?: string; fontSize?: string }> = {};
  if (options.sizes && options.sizes.length > 0) {
    for (const s of options.sizes) {
      sizes[s] = {};
    }
  } else if (template.sizes) {
    Object.assign(sizes, template.sizes);
  }

  const contract: ComponentContract = {
    $schema: SCHEMA_URL,
    name,
    description: template.description ?? `${name} component`,
    widgetType,
    anatomy: template.anatomy ?? { root: "The outer element" },
    states: template.states ?? {
      default: { description: "Resting state" },
      focused: { description: "Keyboard or programmatic focus", focusRing: true },
      disabled: { description: "Not interactive", ariaDisabled: true },
    },
    a11y: template.a11y ?? {
      role: "region",
      keyboard: {},
      focusBehavior: "user-defined",
      focusTrap: false,
      focusReturnTarget: null,
      minimumTouchTarget: { ios: "44pt", android: "48dp", web: "24px" },
      ariaAttributes: ["aria-label"],
      requiredLabel: true,
      labelStrategy: "user-defined",
    },
    tokens: template.tokens ?? { root: { default: {} } },
  };

  // Add optional fields only when non-empty
  if (Object.keys(variants).length > 0) {
    contract.variants = variants;
  }
  if (Object.keys(sizes).length > 0) {
    contract.sizes = sizes;
  }
  if (template.interaction) {
    contract.interaction = template.interaction;
  }
  if (template.responsive) {
    contract.responsive = template.responsive;
  }
  if (template.slots) {
    contract.slots = template.slots;
  }
  if (template.visualClass) {
    contract.visualClass = template.visualClass;
  }
  if (template.variantMatrix) {
    contract.variantMatrix = template.variantMatrix;
  }
  if (template.constraints) {
    contract.constraints = template.constraints;
  }
  if (template.accentBar) {
    contract.accentBar = template.accentBar;
  }

  return contract;
}
