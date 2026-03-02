/**
 * Pencil transformation layer — canonical NibNodeSpec interface and toPencilOps() adapter.
 *
 * All widget builders in kit.ts produce NibNodeSpec trees (typed, composable).
 * This module converts them to verbatim Pencil batch_design operation strings.
 *
 * Key property mappings (the transformation contract):
 *   NibNodeSpec.backgroundColor  → Pencil: fill         (frame)
 *   NibNodeSpec.borderColor      → Pencil: stroke.fill   (frame)
 *   NibNodeSpec.textColor        → Pencil: fill          (text — same property as frame fill)
 *   NibNodeSpec.textContent      → Pencil: content       (text)
 *   NibNodeSpec.cornerRadius: N  → Pencil: cornerRadius:[N,N,N,N]
 *
 * The critical insight: Pencil uses `fill` for BOTH frame backgrounds AND text colour.
 * Using `color:` on a text node is silently ignored. NibNodeSpec exposes `textColor`
 * so callers never need to know this Pencil quirk — it is handled here.
 */

export type NibFill = string; // "$var-name" or "#hex"
export type NibDimension = number | "fill_container";

export interface NibNodeSpec {
  id: string;
  type: "frame" | "text";
  name: string;

  // Geometry (frame + text)
  x?: number;
  y?: number;
  width?: NibDimension;
  height?: NibDimension;

  // Frame-only properties (canonical names → Pencil equivalents)
  layout?: "horizontal" | "vertical";
  gap?: number;
  padding?: number;
  cornerRadius?: number | [number, number, number, number];
  backgroundColor?: NibFill; // → Pencil: fill
  borderColor?: NibFill;     // → Pencil: stroke.fill
  borderWidth?: number;      // → Pencil: stroke.thickness (default 1)
  borderAlign?: "inside" | "outside" | "center"; // default "inside"

  // Text-only properties (canonical names → Pencil equivalents)
  textContent?: string; // → Pencil: content
  textColor?: NibFill;  // → Pencil: fill (text nodes use fill for colour too)
  fontSize?: number;
  fontWeight?: string;

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
 * Transform a NibNodeSpec tree into Pencil batch_design operation strings.
 *
 * Key mappings enforced here:
 * - frame.backgroundColor → fill
 * - frame.borderColor     → stroke.fill  (with align and thickness)
 * - text.textColor        → fill         (NOT color — Pencil uses fill for text colour)
 * - text.textContent      → content
 * - cornerRadius: N       → [N, N, N, N]
 *
 * @param spec    The node to render
 * @param parent  The Pencil parent binding (e.g. "document" or a binding name)
 * @returns Flat list of op strings, one per node
 */
export function toPencilOps(spec: NibNodeSpec, parent: string): string[] {
  const ops: string[] = [];
  const props: Record<string, unknown> = { type: spec.type, name: spec.name };

  // Geometry — common to both frame and text
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
        thickness: spec.borderWidth ?? 1,
      };
    }
  } else if (spec.type === "text") {
    if (spec.textContent !== undefined) props["content"] = spec.textContent;
    if (spec.fontSize !== undefined) props["fontSize"] = spec.fontSize;
    if (spec.fontWeight) props["fontWeight"] = spec.fontWeight;
    if (spec.textColor) props["fill"] = spec.textColor; // ← the critical mapping
  }

  ops.push(`${spec.id}=I(${parent}, ${serializeValue(props)})`);

  for (const child of spec.children ?? []) {
    ops.push(...toPencilOps(child, spec.id));
  }
  return ops;
}

/**
 * Convert a NibNodeSpec tree to a single multi-line Pencil batch_design operations string.
 *
 * @param spec    Root node spec
 * @param parent  Parent binding (typically "document" for canvas-level frames)
 */
export function specToOps(spec: NibNodeSpec, parent: string): string {
  return toPencilOps(spec, parent).join("\n");
}
