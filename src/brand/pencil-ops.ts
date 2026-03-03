/**
 * Pencil transformation layer — canonical NibNodeSpec interface and toPencilOps() adapter.
 *
 * All widget builders in kit.ts produce NibNodeSpec trees (typed, composable).
 * This module converts them to verbatim Pencil batch_design operation strings.
 *
 * Key property mappings (the transformation contract):
 *   NibNodeSpec.backgroundColor  → Pencil: fill         (frame)
 *   NibNodeSpec.borderColor      → Pencil: stroke.fill   (frame)
 *   NibNodeSpec.textColor        → Pencil: fill          (text/icon — same property as frame fill)
 *   NibNodeSpec.textContent      → Pencil: content       (text)
 *   NibNodeSpec.cornerRadius: N  → Pencil: cornerRadius:[N,N,N,N]
 *   NibNodeSpec.borderWidth: {bottom:N} → Pencil: stroke.thickness:{bottom:N} (per-side)
 *
 * The critical insight: Pencil uses `fill` for BOTH frame backgrounds AND text colour.
 * Using `color:` on a text node is silently ignored. NibNodeSpec exposes `textColor`
 * so callers never need to know this Pencil quirk — it is handled here.
 *
 * See ADR-008 for the full Pencil layout feature reference.
 */

export type NibFill = string; // "$var-name" or "#hex"
export type NibDimension = number | "fill_container";

/** Per-side border thickness (Pencil supports partial borders — ADR-008). */
export interface NibBorderSides {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface NibNodeSpec {
  id: string;
  type: "frame" | "text" | "ellipse" | "icon_font";
  name: string;

  // Geometry (all types)
  x?: number;
  y?: number;
  width?: NibDimension;
  height?: NibDimension;

  // Frame-only properties (canonical names → Pencil equivalents)
  layout?: "horizontal" | "vertical";
  gap?: number;
  /** Uniform, [vertical, horizontal], or [top, right, bottom, left] */
  padding?: number | [number, number] | [number, number, number, number];
  cornerRadius?: number | [number, number, number, number];
  backgroundColor?: NibFill; // → Pencil: fill
  borderColor?: NibFill;     // → Pencil: stroke.fill
  /** Uniform px value OR per-side object (ADR-008 — Pencil supports both) */
  borderWidth?: number | NibBorderSides;
  borderAlign?: "inside" | "outside" | "center"; // default "inside"
  /** Flex cross-axis alignment (frame only) */
  alignItems?: "center" | "start" | "end" | "space_between";
  /** Flex main-axis alignment (frame only) */
  justifyContent?: "center" | "start" | "end" | "space_between";
  /** Clip overflow to frame bounds */
  clip?: boolean;

  // icon_font-only properties
  iconFontFamily?: string; // e.g. "lucide"
  iconFontName?: string;   // e.g. "check", "chevrons-up-down"

  // Text/icon properties (canonical names → Pencil equivalents)
  textContent?: string; // → Pencil: content  (text only)
  textColor?: NibFill;  // → Pencil: fill (text + icon_font nodes use fill for colour)
  fontSize?: number;
  fontWeight?: string;
  textAlign?: "left" | "center" | "right";
  textAlignVertical?: "top" | "middle" | "bottom";
  lineHeight?: number;

  children?: NibNodeSpec[];
}

/**
 * Serialize a value to a JavaScript-style object literal suitable for Pencil batch_design ops.
 * Strings get double-quoted, numbers/booleans are bare, arrays use [...], objects use {key:val,...}.
 * Object keys are NOT quoted — Pencil's op format expects JavaScript object literal syntax.
 */
function serializeValue(val: unknown): string {
  if (typeof val === "string") return JSON.stringify(val);
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (Array.isArray(val)) return `[${val.map(serializeValue).join(",")}]`;
  if (val !== null && typeof val === "object") {
    const entries = Object.entries(val as Record<string, unknown>)
      .map(([k, v]) => `${k}:${serializeValue(v)}`)
      .join(",");
    return `{${entries}}`;
  }
  return String(val);
}

/**
 * Build Pencil-native props from a NibNodeSpec, applying all canonical property mappings.
 * Children are recursively inlined as a `children:` array — no `id` is emitted (Pencil
 * auto-assigns IDs for inline children per its batch_design schema).
 *
 * Key mappings enforced here:
 * - frame.backgroundColor → fill
 * - frame.borderColor     → stroke.fill  (with align and thickness)
 * - frame.borderWidth     → stroke.thickness (number OR per-side object)
 * - frame.alignItems      → alignItems
 * - frame.justifyContent  → justifyContent
 * - frame.clip            → clip
 * - text.textColor        → fill         (NOT color — Pencil uses fill for text colour)
 * - text.textContent      → content
 * - text.textAlign        → textAlign
 * - text.textAlignVertical → textAlignVertical
 * - text.lineHeight       → lineHeight
 * - icon_font.textColor   → fill
 * - icon_font.iconFontFamily → iconFontFamily
 * - icon_font.iconFontName   → iconFontName
 * - cornerRadius: N       → [N, N, N, N]
 * - children              → inlined recursively (no separate I() ops emitted)
 *
 * See ADR-008 for the complete Pencil layout feature reference.
 */
function buildPencilProps(spec: NibNodeSpec): Record<string, unknown> {
  const props: Record<string, unknown> = { type: spec.type, name: spec.name };

  // Geometry — common to all node types
  if (spec.x !== undefined) props["x"] = spec.x;
  if (spec.y !== undefined) props["y"] = spec.y;
  if (spec.width !== undefined) props["width"] = spec.width;
  if (spec.height !== undefined) props["height"] = spec.height;

  if (spec.type === "frame") {
    if (spec.layout) props["layout"] = spec.layout;
    if (spec.gap !== undefined) props["gap"] = spec.gap;
    if (spec.padding !== undefined) props["padding"] = spec.padding;
    if (spec.cornerRadius !== undefined) {
      props["cornerRadius"] = Array.isArray(spec.cornerRadius)
        ? spec.cornerRadius
        : [spec.cornerRadius, spec.cornerRadius, spec.cornerRadius, spec.cornerRadius];
    }
    if (spec.backgroundColor) props["fill"] = spec.backgroundColor;
    if (spec.borderColor) {
      props["stroke"] = {
        align: spec.borderAlign ?? "inside",
        fill: spec.borderColor,
        // Pass through number OR per-side object {top?,right?,bottom?,left?}
        thickness: spec.borderWidth !== undefined ? spec.borderWidth : 1,
      };
    }
    if (spec.alignItems) props["alignItems"] = spec.alignItems;
    if (spec.justifyContent) props["justifyContent"] = spec.justifyContent;
    if (spec.clip !== undefined) props["clip"] = spec.clip;
    // Inline children recursively — no separate I() ops, Pencil auto-assigns child IDs
    if (spec.children && spec.children.length > 0) {
      props["children"] = spec.children.map(buildPencilProps);
    }

  } else if (spec.type === "text") {
    if (spec.textContent !== undefined) props["content"] = spec.textContent;
    if (spec.fontSize !== undefined) props["fontSize"] = spec.fontSize;
    if (spec.fontWeight) props["fontWeight"] = spec.fontWeight;
    if (spec.textColor) props["fill"] = spec.textColor; // ← the critical mapping
    if (spec.textAlign) props["textAlign"] = spec.textAlign;
    if (spec.textAlignVertical) props["textAlignVertical"] = spec.textAlignVertical;
    if (spec.lineHeight !== undefined) props["lineHeight"] = spec.lineHeight;

  } else if (spec.type === "ellipse") {
    // Ellipse: fill from backgroundColor; no layout/gap/padding
    if (spec.backgroundColor) props["fill"] = spec.backgroundColor;

  } else if (spec.type === "icon_font") {
    // Icon: iconFontFamily + iconFontName + fill from textColor
    if (spec.iconFontFamily) props["iconFontFamily"] = spec.iconFontFamily;
    if (spec.iconFontName) props["iconFontName"] = spec.iconFontName;
    if (spec.textColor) props["fill"] = spec.textColor;
    if (spec.fontSize !== undefined) props["fontSize"] = spec.fontSize;
  }

  return props;
}

/**
 * Transform a NibNodeSpec tree into a single Pencil batch_design operation string.
 *
 * All children are inlined recursively into the root Insert op via a `children:` array.
 * This produces exactly one op per specToOps() call, regardless of tree depth.
 *
 * The root node's `id` becomes the batch_design binding name. Child node IDs are
 * intentionally omitted — Pencil auto-assigns IDs for inline children.
 *
 * Cross-call parent bindings (e.g. sectionId used as parent for a subsequent specToOps
 * call) still work because all ops land in the same batch_design operations string.
 *
 * @param spec    The node to render
 * @param parent  The Pencil parent binding (e.g. "document" or a binding name)
 * @returns Single-element array containing the complete Insert op
 */
export function toPencilOps(spec: NibNodeSpec, parent: string): string[] {
  return [`${spec.id}=I(${parent}, ${serializeValue(buildPencilProps(spec))})`];
}

/**
 * Convert a NibNodeSpec tree to a single-line Pencil batch_design operations string.
 * Children are inlined — always returns exactly one line.
 *
 * @param spec    Root node spec
 * @param parent  Parent binding (typically "document" for canvas-level frames)
 * @returns Single op line as a string
 */
export function specToOps(spec: NibNodeSpec, parent: string): string {
  return toPencilOps(spec, parent).join("\n");
}
