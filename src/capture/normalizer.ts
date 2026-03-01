/**
 * Normalizes raw PenNodes into ResolvedNodes for the DesignDocument.
 *
 * Key transformation: `ref` nodes (component instances) are resolved inline
 * by cloning the component tree and applying overrides. The output contains
 * no ref nodes — only concrete node types.
 */

import type { PenNode } from "../types/pen.js";
import type {
  ResolvedNode,
  ResolvedNodeType,
  LayoutProps,
  Spacing,
  Fill,
  Stroke,
  Shadow,
  Blur,
  TextStyle,
  BorderRadius,
  SizingValue,
} from "../types/design.js";

/**
 * Normalize a tree of PenNodes, resolving all refs inline.
 */
export function normalizeNodes(
  nodes: PenNode[],
  components: Record<string, PenNode>,
): ResolvedNode[] {
  return nodes
    .filter((n) => n.visible !== false && n.type !== "note")
    .map((n) => normalizeNode(n, components))
    .filter((n): n is ResolvedNode => n !== null);
}

function normalizeNode(
  node: PenNode,
  components: Record<string, PenNode>,
): ResolvedNode | null {
  // Resolve ref nodes by expanding the component tree
  if (node.type === "ref") {
    return resolveRef(node, components);
  }

  // Skip note nodes
  if (node.type === "note") return null;

  // Skip invisible nodes
  if (node.visible === false) return null;

  const type = mapNodeType(node.type);
  if (!type) return null;

  const resolved: ResolvedNode = { id: node.id, type };

  if (node.name) resolved.name = node.name;

  // Geometry
  if (node.x !== undefined) resolved.x = node.x;
  if (node.y !== undefined) resolved.y = node.y;
  if (node.width !== undefined) resolved.width = node.width as number | SizingValue;
  if (node.height !== undefined) resolved.height = node.height as number | SizingValue;
  if (node.rotation) resolved.rotation = node.rotation;

  // Sizing
  if (node.horizontalSizing) resolved.horizontalSizing = node.horizontalSizing;
  if (node.verticalSizing) resolved.verticalSizing = node.verticalSizing;

  // Layout
  const layout = normalizeLayout(node);
  if (layout) resolved.layout = layout;

  // Visual properties
  if (node.fills?.length) resolved.fills = node.fills as Fill[];
  if (node.strokes?.length) resolved.strokes = normalizeStrokes(node.strokes);
  if (node.shadows?.length) resolved.shadows = normalizeShadows(node.shadows);
  if (node.blur) resolved.blur = node.blur as Blur;
  if (node.opacity !== undefined && node.opacity !== 1) resolved.opacity = node.opacity;
  if (node.borderRadius !== undefined) resolved.borderRadius = normalizeBorderRadius(node.borderRadius);
  if (node.overflow === "hidden") resolved.overflow = "hidden";

  // Text
  if (node.text !== undefined) resolved.text = node.text;
  if (node.textStyle) resolved.textStyle = node.textStyle as TextStyle;
  if (node.textStyles?.length) resolved.textStyles = node.textStyles as TextStyle[];

  // Path
  if (node.pathData) resolved.pathData = node.pathData;

  // Icon
  if (node.iconFamily) resolved.iconFamily = node.iconFamily;
  if (node.iconName) resolved.iconName = node.iconName;
  if (node.iconStyle) resolved.iconStyle = node.iconStyle;

  // Image
  if (node.imageUrl) resolved.imageUrl = node.imageUrl;
  if (node.imageFit) resolved.imageFit = node.imageFit;

  // Children
  if (node.children?.length) {
    resolved.children = normalizeNodes(node.children, components);
  }

  return resolved;
}

/**
 * Resolve a ref node by cloning its component definition and applying overrides.
 */
function resolveRef(
  ref: PenNode,
  components: Record<string, PenNode>,
): ResolvedNode | null {
  const componentId = ref.componentId;
  if (!componentId) return null;

  const component = components[componentId];
  if (!component) {
    // Component not found — skip this ref
    return null;
  }

  // Deep clone the component tree
  const cloned = structuredClone(component);

  // Apply overrides from the ref to descendants in the cloned tree
  if (ref.overrides) {
    applyOverrides(cloned, ref.overrides);
  }

  // Normalize the cloned tree as a regular node, using the ref's position
  const resolved = normalizeNode(
    { ...cloned, type: "frame", id: ref.id, name: ref.name ?? cloned.name, x: ref.x, y: ref.y },
    components,
  );

  if (resolved) {
    // Preserve ref's sizing if specified
    if (ref.width !== undefined) resolved.width = ref.width as number | SizingValue;
    if (ref.height !== undefined) resolved.height = ref.height as number | SizingValue;
    if (ref.horizontalSizing) resolved.horizontalSizing = ref.horizontalSizing;
    if (ref.verticalSizing) resolved.verticalSizing = ref.verticalSizing;
  }

  return resolved;
}

/**
 * Recursively apply overrides to a cloned component tree.
 * Override keys are node IDs; values are partial property sets.
 */
function applyOverrides(
  node: PenNode,
  overrides: Record<string, Partial<PenNode>>,
): void {
  const override = overrides[node.id];
  if (override) {
    Object.assign(node, override);
  }

  if (node.children) {
    for (const child of node.children) {
      applyOverrides(child, overrides);
    }
  }
}

function mapNodeType(type: string): ResolvedNodeType | null {
  switch (type) {
    case "frame":
    case "rectangle":
    case "ellipse":
    case "text":
    case "path":
    case "icon_font":
    case "image":
    case "group":
      return type;
    case "component":
      return "frame"; // Components are rendered as frames
    default:
      return null;
  }
}

function normalizeLayout(node: PenNode): LayoutProps | null {
  const raw = node.layout;
  if (!raw) return null;

  const direction = raw.layout ?? "none";
  if (direction === "none" && !raw.gap && !raw.padding) return null;

  return {
    direction,
    gap: raw.gap,
    padding: normalizePadding(raw.padding),
    alignItems: raw.alignItems,
    justifyContent: raw.justifyContent,
    wrap: raw.wrap,
  };
}

function normalizePadding(
  padding: number | { top: number; right: number; bottom: number; left: number } | undefined,
): Spacing | undefined {
  if (padding === undefined) return undefined;
  if (typeof padding === "number") {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  return padding;
}

function normalizeStrokes(strokes: PenNode["strokes"]): Stroke[] {
  return (strokes ?? []).map((s) => ({
    color: s.color,
    width: s.width,
    style: s.style ?? "solid",
    position: s.position ?? "inside",
  }));
}

function normalizeShadows(shadows: PenNode["shadows"]): Shadow[] {
  return (shadows ?? []).map((s) => ({
    type: s.type,
    color: s.color,
    x: s.x,
    y: s.y,
    blur: s.blur,
    spread: s.spread ?? 0,
  }));
}

function normalizeBorderRadius(
  br: number | { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number },
): number | BorderRadius {
  return br;
}
