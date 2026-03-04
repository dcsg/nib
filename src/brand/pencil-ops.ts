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

// ── Renderer-safe emit guards (ADR-010 / INV-010) ─────────────────────────────

/**
 * Thrown when a transformation cannot produce a renderer-safe output.
 * Currently raised only for icon_font nodes whose iconFontName is not in
 * PENCIL_LUCIDE_ALLOWLIST and has no entry in PENCIL_LUCIDE_FALLBACK_MAP.
 * See ADR-010.
 */
export class TransformationError extends Error {
  override readonly name = "TransformationError";
  constructor(message: string) {
    super(message);
  }
}

/**
 * Lucide icon names confirmed to render correctly in Pencil's Lucide snapshot 0.263.
 * Do NOT add names to this set without visual validation in Pencil.
 * See ADR-010 for the full allowlist and validation methodology.
 */
export const PENCIL_LUCIDE_ALLOWLIST: ReadonlySet<string> = new Set([
  "activity",        "arrow-right",     "arrow-up-down",   "bell",            "building",
  "calendar",        "check",           "chevron-down",    "chevron-right",   "chevrons-down",
  "chevrons-up",     "circle",          "circle-alert",    "circle-check",    "circle-x",
  "code",            "copy",            "credit-card",     "gauge",           "inbox",
  "info",            "layers",          "layout-dashboard","link",            "list",
  "lock",            "log-in",          "plus",            "rocket",          "send",
  "server",          "settings",        "shield",          "shopping-cart",   "sparkles",
  "trending-up",     "upload",          "user",            "users",           "x",
  "zap",
]);

/**
 * Maps known-broken Pencil Lucide icon names to their nearest working equivalents.
 * Every value MUST be present in PENCIL_LUCIDE_ALLOWLIST.
 * See ADR-010 for rationale on each mapping choice.
 */
export const PENCIL_LUCIDE_FALLBACK_MAP: Readonly<Record<string, string>> = {
  "ticket":             "credit-card",
  "shopping-bag":       "shopping-cart",
  "cpu":                "server",
  "building-2":         "building",
  "layout-grid":        "layout-dashboard",
  "grid":               "layout-dashboard",
  "door-open":          "log-in",
  "layout-template":    "layout-dashboard",
  "sliders-horizontal": "settings",
  "sliders":            "settings",
  "mail":               "inbox",
  "shield-check":       "shield",
  "chevrons-up-down":   "arrow-up-down",
  "chevron-up-down":    "arrow-up-down",
  "alert-triangle":     "circle-alert",
  "triangle-alert":     "circle-alert",
  "alert-circle":       "circle-alert",
  "filter":             "list",
  "home":               "layout-dashboard",
} as const;

/**
 * Resolve a Lucide icon name to one that is safe to emit in Pencil.
 *
 * Resolution order (ADR-010 §2):
 * 1. Name is in PENCIL_LUCIDE_ALLOWLIST → return unchanged.
 * 2. Name is in PENCIL_LUCIDE_FALLBACK_MAP → substitute, warn in non-production, return fallback.
 * 3. Neither → throw TransformationError.
 *
 * @throws {TransformationError} if the name is unknown and has no fallback.
 */
export function resolveIconName(name: string): string {
  if (PENCIL_LUCIDE_ALLOWLIST.has(name)) {
    return name;
  }
  const fallback = PENCIL_LUCIDE_FALLBACK_MAP[name];
  if (fallback !== undefined) {
    if (process.env["NODE_ENV"] !== "production") {
      console.warn(
        `[nib] icon_font: "${name}" is not in Pencil's Lucide snapshot. ` +
        `Substituting "${fallback}". See ADR-010 for the full allowlist.`,
      );
    }
    return fallback;
  }
  throw new TransformationError(
    `icon_font: "${name}" is not in PENCIL_LUCIDE_ALLOWLIST and has no fallback. ` +
    `Pencil would render a blank box. Add it to the allowlist after visual validation, ` +
    `or use a mapped equivalent. See ADR-010.`,
  );
}

/** Forbidden Unicode ranges — Inter does not provide glyphs for these blocks. See ADR-010. */
const INTER_FORBIDDEN_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x2300, 0x23ff], // Miscellaneous Technical
  [0x2400, 0x243f], // Control Pictures
  [0x2500, 0x257f], // Box Drawing
  [0x2580, 0x259f], // Block Elements
  [0x25a0, 0x25ff], // Geometric Shapes (includes ▾ U+25BE)
  [0x2600, 0x26ff], // Miscellaneous Symbols (includes ✦ U+2726)
  [0x2700, 0x27bf], // Dingbats
];

/** Bullet/CTA codepoints — substituted with → (U+2192). */
const INTER_BULLET_CODEPOINTS = new Set([0x2726, 0x2605]); // ✦ ★

/** Dropdown/sort chevron codepoints — stripped (use icon_font instead). */
const INTER_DROPDOWN_CODEPOINTS = new Set([0x25be, 0x25b4]); // ▾ ▴

function isForbiddenCodepoint(cp: number): boolean {
  return INTER_FORBIDDEN_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi);
}

/**
 * Sanitise text content for Pencil emit, replacing codepoints outside Inter's
 * glyph coverage with safe equivalents. Never throws.
 *
 * Substitution rules (ADR-010 §3):
 * - Bullet/CTA markers (✦ U+2726, ★ U+2605) → "→" (U+2192)
 * - Dropdown chevrons (▾ U+25BE, ▴ U+25B4) → stripped with a warning
 * - All other forbidden codepoints → stripped with a warning
 */
export function sanitiseTextContent(text: string): string {
  let result = "";
  for (const char of text) {
    const cp = char.codePointAt(0)!;
    if (!isForbiddenCodepoint(cp)) {
      result += char;
      continue;
    }
    if (INTER_BULLET_CODEPOINTS.has(cp)) {
      console.warn(
        `[nib] text: character U+${cp.toString(16).toUpperCase().padStart(4, "0")} ` +
        `("${char}") is outside Inter's glyph coverage. Replaced with "→". See ADR-010.`,
      );
      result += "→";
      continue;
    }
    if (INTER_DROPDOWN_CODEPOINTS.has(cp)) {
      console.warn(
        `[nib] text: character U+${cp.toString(16).toUpperCase().padStart(4, "0")} ` +
        `("${char}") is a dropdown chevron Inter cannot render. ` +
        `Use an icon_font node with iconFontName:"chevron-down" instead. See ADR-010.`,
      );
      // Stripped — no replacement
      continue;
    }
    console.warn(
      `[nib] text: character U+${cp.toString(16).toUpperCase().padStart(4, "0")} ` +
      `("${char}") is outside Inter's glyph coverage. Stripped. See ADR-010.`,
    );
    // Omitted from result
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────

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
  /** Mark as a reusable Pencil component (shows in component picker, can be instanced) */
  reusable?: boolean;

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
    if (spec.reusable !== undefined) props["reusable"] = spec.reusable;
    // Inline children recursively — no separate I() ops, Pencil auto-assigns child IDs
    if (spec.children && spec.children.length > 0) {
      props["children"] = spec.children.map(buildPencilProps);
    }

  } else if (spec.type === "text") {
    if (spec.textContent !== undefined) props["content"] = sanitiseTextContent(spec.textContent);
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
    // Icon: iconFontFamily + iconFontName + fill from textColor.
    // Size is controlled by width/height (set as geometry above) — fontSize is ignored by Pencil for icon_font.
    if (spec.iconFontFamily) props["iconFontFamily"] = spec.iconFontFamily;
    if (spec.iconFontName) props["iconFontName"] = resolveIconName(spec.iconFontName);
    if (spec.textColor) props["fill"] = spec.textColor;
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
