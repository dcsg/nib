/**
 * Generates CSS for a single canvas and all its nodes.
 *
 * Positioning rules:
 * - parent.layout === "none" → children use absolute (left/top)
 * - parent.layout === "horizontal"|"vertical" → parent is flex, children use sizing
 *   - fill_container → flex: 1 1 0%
 *   - fit_content → flex: 0 0 auto
 *   - number → fixed size
 */

import type {
  DesignCanvas,
  ResolvedNode,
  Fill,
  Stroke,
  Shadow,
  BorderRadius,
  TextStyle,
  LayoutProps,
  SizingValue,
} from "../types/design.js";

export function generateCss(canvas: DesignCanvas): string {
  const rules: string[] = [];

  // Canvas container
  rules.push(
    `#canvas-${css(canvas.id)} {`,
    `  position: relative;`,
    `  width: ${canvas.width}px;`,
    `  height: ${canvas.height}px;`,
    canvas.backgroundColor ? `  background: ${canvas.backgroundColor};` : "",
    `  overflow: hidden;`,
    `}`,
  );

  // Recursively generate rules for all nodes
  for (const child of canvas.children) {
    generateNodeCss(child, rules, null);
  }

  return rules.filter(Boolean).join("\n");
}

function generateNodeCss(
  node: ResolvedNode,
  rules: string[],
  parentLayout: LayoutProps | null,
): void {
  const sel = `#n-${css(node.id)}`;
  const props: string[] = [];

  // Positioning based on parent layout
  if (!parentLayout || parentLayout.direction === "none") {
    props.push("position: absolute");
    if (node.x !== undefined) props.push(`left: ${node.x}px`);
    if (node.y !== undefined) props.push(`top: ${node.y}px`);
  } else {
    // Inside a flex parent — sizing determines flex behavior
    addFlexChildProps(props, node, parentLayout.direction);
  }

  // Dimensions
  addDimensions(props, node, parentLayout);

  // This node's own layout (for its children)
  if (node.layout && node.layout.direction !== "none") {
    const dir = node.layout.direction;
    props.push("display: flex");
    props.push(`flex-direction: ${dir === "horizontal" ? "row" : "column"}`);
    if (node.layout.gap) props.push(`gap: ${node.layout.gap}px`);
    if (node.layout.alignItems) props.push(`align-items: ${mapAlign(node.layout.alignItems)}`);
    if (node.layout.justifyContent) props.push(`justify-content: ${mapJustify(node.layout.justifyContent)}`);
    if (node.layout.wrap) props.push("flex-wrap: wrap");
    if (node.layout.padding) {
      const p = node.layout.padding;
      props.push(`padding: ${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`);
    }
  }

  // Visual styles
  addFills(props, node.fills);
  addStrokes(props, node.strokes);
  addShadows(props, node.shadows);
  addBorderRadius(props, node.borderRadius);

  if (node.opacity !== undefined && node.opacity !== 1) {
    props.push(`opacity: ${node.opacity}`);
  }

  if (node.overflow === "hidden") {
    props.push("overflow: hidden");
  }

  if (node.rotation) {
    props.push(`transform: rotate(${node.rotation}deg)`);
  }

  if (node.blur) {
    if (node.blur.type === "layer") {
      props.push(`filter: blur(${node.blur.radius}px)`);
    } else {
      props.push(`backdrop-filter: blur(${node.blur.radius}px)`);
    }
  }

  // Text styles
  if (node.textStyle) {
    addTextStyle(props, node.textStyle);
  }

  // Ellipse → border-radius: 50%
  if (node.type === "ellipse") {
    props.push("border-radius: 50%");
  }

  // Image background
  if (node.type === "image" && node.imageUrl) {
    props.push(`background-image: url('${node.imageUrl}')`);
    props.push(`background-size: ${node.imageFit ?? "cover"}`);
    props.push("background-position: center");
    props.push("background-repeat: no-repeat");
  }

  if (props.length) {
    rules.push(`${sel} {\n${props.map((p) => `  ${p};`).join("\n")}\n}`);
  }

  // Recurse into children
  if (node.children) {
    for (const child of node.children) {
      generateNodeCss(child, rules, node.layout ?? null);
    }
  }
}

function addFlexChildProps(
  props: string[],
  node: ResolvedNode,
  parentDirection: "horizontal" | "vertical" | "none",
): void {
  const mainSizing = parentDirection === "horizontal" ? node.horizontalSizing : node.verticalSizing;
  const crossSizing = parentDirection === "horizontal" ? node.verticalSizing : node.horizontalSizing;

  if (mainSizing === "fill_container") {
    props.push("flex: 1 1 0%");
  } else if (mainSizing === "fit_content") {
    props.push("flex: 0 0 auto");
  } else if (typeof mainSizing === "number") {
    if (parentDirection === "horizontal") {
      props.push(`flex: 0 0 ${mainSizing}px`);
    } else {
      props.push(`flex: 0 0 ${mainSizing}px`);
    }
  }

  // Cross-axis sizing
  if (crossSizing === "fill_container") {
    props.push("align-self: stretch");
  } else if (crossSizing === "fit_content") {
    // Default behavior in flex
  }
}

function addDimensions(
  props: string[],
  node: ResolvedNode,
  parentLayout: LayoutProps | null,
): void {
  const inFlex = parentLayout && parentLayout.direction !== "none";

  const addSize = (value: number | SizingValue | undefined, prop: "width" | "height") => {
    if (value === undefined) return;
    if (typeof value === "number") {
      // In flex contexts, fixed sizes are handled by flex basis
      if (!inFlex) {
        props.push(`${prop}: ${value}px`);
      } else {
        // Still set explicit size if it's the cross axis
        const isMainAxis = parentLayout?.direction === "horizontal" ? prop === "width" : prop === "height";
        if (!isMainAxis) {
          props.push(`${prop}: ${value}px`);
        }
      }
    } else if (value === "fill_container" && !inFlex) {
      props.push(`${prop}: 100%`);
    }
    // fit_content is default, no explicit CSS needed
  };

  addSize(node.width, "width");
  addSize(node.height, "height");
}

function addFills(props: string[], fills?: Fill[]): void {
  if (!fills?.length) return;
  const fill = fills[0]!; // Use first fill as primary

  if (fill.type === "solid" && fill.color) {
    const color = fill.opacity !== undefined && fill.opacity < 1
      ? applyOpacity(fill.color, fill.opacity)
      : fill.color;
    props.push(`background: ${color}`);
  } else if (fill.type === "linear" && fill.gradient?.length) {
    const stops = fill.gradient.map((s) => `${s.color} ${s.position * 100}%`).join(", ");
    props.push(`background: linear-gradient(${stops})`);
  } else if (fill.type === "radial" && fill.gradient?.length) {
    const stops = fill.gradient.map((s) => `${s.color} ${s.position * 100}%`).join(", ");
    props.push(`background: radial-gradient(${stops})`);
  } else if (fill.type === "image" && fill.imageUrl) {
    props.push(`background-image: url('${fill.imageUrl}')`);
    props.push(`background-size: ${fill.imageFit ?? "cover"}`);
    props.push("background-position: center");
  }
}

function addStrokes(props: string[], strokes?: Stroke[]): void {
  if (!strokes?.length) return;
  const s = strokes[0]!;
  if (s.position === "outside") {
    // Outline renders outside the element box — no border needed
    props.push(`outline: ${s.width}px ${s.style} ${s.color}`);
  } else {
    // Default: inside stroke via border + border-box sizing
    props.push(`border: ${s.width}px ${s.style} ${s.color}`);
    props.push("box-sizing: border-box");
  }
}

function addShadows(props: string[], shadows?: Shadow[]): void {
  if (!shadows?.length) return;
  const parts = shadows.map((s) => {
    const inset = s.type === "inner" ? "inset " : "";
    return `${inset}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`;
  });
  props.push(`box-shadow: ${parts.join(", ")}`);
}

function addBorderRadius(props: string[], br?: number | BorderRadius): void {
  if (br === undefined) return;
  if (typeof br === "number") {
    if (br > 0) props.push(`border-radius: ${br}px`);
  } else {
    props.push(
      `border-radius: ${br.topLeft}px ${br.topRight}px ${br.bottomRight}px ${br.bottomLeft}px`,
    );
  }
}

function addTextStyle(props: string[], style: TextStyle): void {
  if (style.fontFamily) props.push(`font-family: '${style.fontFamily}', sans-serif`);
  if (style.fontSize) props.push(`font-size: ${style.fontSize}px`);
  if (style.fontWeight) props.push(`font-weight: ${style.fontWeight}`);
  if (style.fontStyle === "italic") props.push("font-style: italic");
  if (style.lineHeight !== undefined) {
    const lh = typeof style.lineHeight === "number" ? `${style.lineHeight}px` : style.lineHeight;
    props.push(`line-height: ${lh}`);
  }
  if (style.letterSpacing) props.push(`letter-spacing: ${style.letterSpacing}px`);
  if (style.textAlign) props.push(`text-align: ${style.textAlign}`);
  if (style.textDecoration && style.textDecoration !== "none") {
    props.push(`text-decoration: ${style.textDecoration}`);
  }
  if (style.color) props.push(`color: ${style.color}`);
}

function applyOpacity(color: string, opacity: number): string {
  if (color.startsWith("#") && color.length === 7) {
    const alpha = Math.round(opacity * 255).toString(16).padStart(2, "0");
    return color + alpha;
  }
  return color;
}

function mapAlign(val: string): string {
  if (val === "start") return "flex-start";
  if (val === "end") return "flex-end";
  return val;
}

function mapJustify(val: string): string {
  if (val === "start") return "flex-start";
  if (val === "end") return "flex-end";
  return val;
}

/** Escape an ID for use in a CSS selector */
function css(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}
