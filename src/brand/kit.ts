/**
 * Kit recipe builder — produces a structured recipe for Claude to scaffold
 * component frames in Pencil with brand variables already wired.
 *
 * READ-ONLY: this module never writes files or calls Pencil MCP.
 * The recipe is consumed by the nib_kit MCP tool (annotated readOnlyHint: true).
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NibBrandConfig, ComponentContract } from "../types/brand.js";
import { specToOps } from "./pencil-ops.js";

/** Frame dimensions per widget type (px) */
const FRAME_SIZES: Record<string, { width: number; height: number }> = {
  button: { width: 160, height: 40 },
  textinput: { width: 280, height: 44 },
  checkbox: { width: 200, height: 32 },
  radio: { width: 200, height: 32 },
  switch: { width: 120, height: 32 },
  tabs: { width: 360, height: 44 },
  dialog: { width: 440, height: 320 },
  combobox: { width: 280, height: 44 },
  tooltip: { width: 220, height: 40 },
  badge: { width: 100, height: 28 },
  toast: { width: 360, height: 72 },
  alert: { width: 440, height: 88 },
  generic: { width: 280, height: 80 },
};

/**
 * Actual rendered height per widget type.
 * Components with a label above the control (textinput, combobox) are taller
 * than their FRAME_SIZES.height — the label and gap add ~18px on top.
 * Used for cumulative y-position tracking in buildKitRecipe.
 */
const ACTUAL_ROW_HEIGHTS: Record<string, number> = {
  button: 40,
  textinput: 62,  // label 12px + gap 6px + input 44px
  checkbox: 32,
  radio: 32,
  switch: 32,
  tabs: 44,
  dialog: 320,
  combobox: 62,   // label 12px + gap 6px + control 44px
  tooltip: 40,
  badge: 28,
  toast: 72,
  alert: 88,
  generic: 80,
};

/** Row spacing between component frames (px) */
const ROW_SPACING = 60;

/** Horizontal gap between variant frames within a component row (px) */
const VARIANT_GAP = 24;

/**
 * Get the primary axis values from a component's variantMatrix (ADR-007).
 * Returns the first axis's values, or an empty array if no variantMatrix is defined.
 */
export function getPrimaryVariants(contract: ComponentContract): string[] {
  if (!contract.variantMatrix) return [];
  const firstAxis = Object.values(contract.variantMatrix)[0];
  return firstAxis ?? [];
}

/** A single token binding resolved to its variable name and value. */
export interface KitTokenBinding {
  /** Design token path (e.g. "color.brand.600") */
  token: string;
  /** Pencil variable name (e.g. "color-brand-600") */
  varName: string;
  /** Resolved value (e.g. "#3b82f6") — empty if not found in variables.json */
  resolvedValue: string;
  /** Pencil variable reference used in batch_design ops (e.g. "$color-brand-600"). */
  pencilExpr: string;
}

/** Placement hint for a single component frame. */
export interface KitPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * What the agent must verify after executing batchDesignOps.
 * These are concrete checks — not suggestions.
 */
export interface KitVerification {
  /** Minimum number of child nodes expected inside the root frame */
  expectedChildCount: number;
  /** Pencil variable reference for the root frame fill (e.g. "$color-brand-600", "$--primary"). */
  primaryFillExpr?: string;
  /** Number of variant frames produced (1 when no variantMatrix, N for primary axis) */
  variantCount: number;
  /** Call get_screenshot and confirm each of these things visually */
  visualChecks: string[];
}

/** A single component in the kit recipe. */
export interface KitComponent {
  /** Component name (e.g. "Button") */
  name: string;
  /** WAI-ARIA widget type */
  widgetType: string;
  /** Anatomy part names */
  anatomy: string[];
  /** Interactive state names */
  states: string[];
  /**
   * Flat list of token bindings across all parts + states.
   * De-duplicated by varName.
   */
  tokenBindings: KitTokenBinding[];
  /** Suggested placement for the component frame on the canvas */
  placement: KitPlacement;
    /**
   * Ready-to-execute Pencil batch_design operations for the default state.
   * Pass this string directly to batch_design(filePath, operations).
   * "document" is the canvas root — valid without substitution.
   * Fill, stroke, and color values use Pencil variable references ($--primary, $color-brand-600, etc.).
   * Run nib_brand_push before executing these ops so variables are loaded in Pencil.
   */
  batchDesignOps: string;
    /**
   * What to verify after executing batchDesignOps.
   * Check all items before moving to the next component.
   */
  verification: KitVerification;
}

/** Foundation pages included in every kit recipe. */
export interface KitFoundations {
  /** How many color swatches will be created */
  colorCount: number;
  /** How many typography scale steps will be shown */
  typographySteps: number;
  /** Y position on canvas where foundations start (below all components) */
  startsAtY: number;
  /**
   * Ready-to-execute Pencil batch_design operations for all foundation pages.
   * Execute this in a separate batch_design call after all components are drawn.
   */
  batchDesignOps: string;
}

/** Full kit recipe returned by nib_kit. */
export interface KitRecipe {
  /** Brand name from brand.config.json */
  brandName: string;
  /** All available Pencil variable names → resolved values */
  pencilVariables: Record<string, string>;
  /** Requested components (or all if none specified) */
  components: KitComponent[];
  /**
   * Foundation pages — colors, typography, spacing.
   * Always included regardless of component filter.
   */
  foundations: KitFoundations;
  /**
   * Step-by-step instruction for Claude to draw the kit.
   * Follow this exactly — do not improvise.
   */
  instruction: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a DTCG token value (possibly wrapped in braces) to a Pencil variable reference ($varname). */
function tokenToRef(tokenValue: string): string {
  const token = tokenValue.replace(/^\{|\}$/g, "");
  return `$${token.replace(/\./g, "-")}`;
}

/** Convert a DTCG token path to a Pencil variable name. */
function tokenToVarName(token: string): string {
  return token.replace(/\./g, "-");
}

// ── Widget-specific component builders ─────────────────────────────────────
// Each builder produces a NibNodeSpec tree and converts it to Pencil batch_design op strings
// via specToOps(). All fills/strokes reference Pencil variables ($button-bg-primary, etc.)
// that are loaded via nib_brand_push before these ops are executed.
//
// Using NibNodeSpec ensures:
// - textColor always maps to Pencil's `fill` (never the silently-ignored `color:`)
// - borderColor always produces a properly-structured stroke object
// - Type errors are caught at compile time, not during visual inspection

function buildButtonOps(id: string, name: string, placement: KitPlacement, variant = "primary", parent = "document"): string {
  // Per ADR-007 constraints: buttonWidth="fit-content", textCentering="symmetric-padding"
  // No fixed width — Pencil determines width from content + padding
  const configs: Record<string, { bg?: string; text: string; border?: string }> = {
    primary:     { bg: "$button-bg-primary", text: "$button-text-primary" },
    secondary:   { bg: "#f1f5f9", text: "#1e293b", border: "$--border" },
    outline:     { text: "$--foreground", border: "$--border" },
    destructive: { bg: "#dc2626", text: "#ffffff" },
  };
  const cfg = configs[variant] ?? configs["primary"]!;
  const label = variant.charAt(0).toUpperCase() + variant.slice(1);
  return specToOps({
    id: `${id}_root`, type: "frame", name: `${name} / ${label}`,
    x: placement.x, y: placement.y, height: placement.height,
    layout: "horizontal", gap: 8, padding: 12,
    cornerRadius: [6, 6, 6, 6],
    backgroundColor: cfg.bg,
    borderColor: cfg.border,
    children: [{
      id: `${id}_lbl`, type: "text", name: "label",
      textContent: label, fontSize: 14, fontWeight: "600",
      textColor: cfg.text,
    }],
  }, parent);
}

function buildTextInputOps(id: string, name: string, placement: KitPlacement, variant = "default", parent = "document"): string {
  const configs: Record<string, { bg: string; border: string; labelColor: string; placeholderColor: string }> = {
    default:  { bg: "$input-bg", border: "$input-border", labelColor: "$--foreground", placeholderColor: "$--foreground-muted" },
    error:    { bg: "#fff0f0", border: "#dc2626", labelColor: "$--foreground", placeholderColor: "$--foreground-muted" },
    disabled: { bg: "#f8f9fa", border: "#e2e8f0", labelColor: "#94a3b8", placeholderColor: "#94a3b8" },
  };
  const cfg = configs[variant] ?? configs["default"]!;
  const label = variant.charAt(0).toUpperCase() + variant.slice(1);
  return specToOps({
    id: `${id}_root`, type: "frame", name: `${name} / ${label}`,
    x: placement.x, y: placement.y, width: placement.width,
    layout: "vertical", gap: 6, padding: 0,
    children: [
      {
        id: `${id}_lbl`, type: "text", name: "label",
        textContent: "Label", fontSize: 12, fontWeight: "500",
        textColor: cfg.labelColor,
      },
      {
        id: `${id}_input`, type: "frame", name: "input",
        width: placement.width, height: placement.height,
        layout: "horizontal", gap: 8, padding: 10,
        cornerRadius: [6, 6, 6, 6],
        backgroundColor: cfg.bg,
        borderColor: cfg.border,
        children: [{
          id: `${id}_placeholder`, type: "text", name: "placeholder",
          textContent: variant === "error" ? "Validation error" : "Enter text...", fontSize: 14, fontWeight: "400",
          textColor: cfg.placeholderColor,
        }],
      },
    ],
  }, parent);
}

function buildCheckboxOps(id: string, name: string, placement: KitPlacement, variant = "unchecked", parent = "document"): string {
  const configs: Record<string, { bg: string; border: string; textColor: string }> = {
    unchecked: { bg: "$checkbox-bg", border: "$checkbox-border", textColor: "$--foreground" },
    checked:   { bg: "$--primary", border: "$--primary", textColor: "$--foreground" },
    disabled:  { bg: "#f1f5f9", border: "#e2e8f0", textColor: "#94a3b8" },
  };
  const cfg = configs[variant] ?? configs["unchecked"]!;
  const label = variant.charAt(0).toUpperCase() + variant.slice(1);
  return specToOps({
    id: `${id}_root`, type: "frame", name: `${name} / ${label}`,
    x: placement.x, y: placement.y, width: placement.width, height: placement.height,
    layout: "horizontal", gap: 8, padding: 0,
    children: [
      {
        id: `${id}_box`, type: "frame", name: "checkbox",
        width: 18, height: 18,
        cornerRadius: [4, 4, 4, 4],
        backgroundColor: cfg.bg,
        borderColor: cfg.border,
        borderWidth: 1.5,
      },
      {
        id: `${id}_lbl`, type: "text", name: "label",
        textContent: `${label}`, fontSize: 14, fontWeight: "400",
        textColor: cfg.textColor,
      },
    ],
  }, parent);
}

function buildRadioOps(id: string, name: string, placement: KitPlacement, variant = "unselected", parent = "document"): string {
  const configs: Record<string, { bg: string; border: string; borderWidth: number; textColor: string }> = {
    unselected: { bg: "$radio-bg", border: "$radio-border", borderWidth: 1.5, textColor: "$--foreground" },
    // Selected: white fill + thick primary inner stroke (ADR-007 — inner dot via thick stroke, not nested frame)
    selected:   { bg: "#ffffff", border: "$--primary", borderWidth: 5, textColor: "$--foreground" },
    disabled:   { bg: "#f1f5f9", border: "#e2e8f0", borderWidth: 1.5, textColor: "#94a3b8" },
  };
  const cfg = configs[variant] ?? configs["unselected"]!;
  const label = variant.charAt(0).toUpperCase() + variant.slice(1);
  return specToOps({
    id: `${id}_root`, type: "frame", name: `${name} / ${label}`,
    x: placement.x, y: placement.y, width: placement.width, height: placement.height,
    layout: "horizontal", gap: 8, padding: 0,
    children: [
      {
        id: `${id}_circle`, type: "frame", name: "radio",
        width: 18, height: 18,
        cornerRadius: [9, 9, 9, 9],
        backgroundColor: cfg.bg,
        borderColor: cfg.border,
        borderWidth: cfg.borderWidth,
      },
      {
        id: `${id}_lbl`, type: "text", name: "label",
        textContent: `${label}`, fontSize: 14, fontWeight: "400",
        textColor: cfg.textColor,
      },
    ],
  }, parent);
}

function buildSwitchOps(id: string, name: string, placement: KitPlacement, variant = "off", parent = "document"): string {
  const configs: Record<string, { trackBg: string; thumbBg: string; textColor: string }> = {
    off:      { trackBg: "$switch-track-bg", thumbBg: "$switch-thumb-bg", textColor: "$--foreground" },
    on:       { trackBg: "$--primary", thumbBg: "#ffffff", textColor: "$--foreground" },
    disabled: { trackBg: "#e2e8f0", thumbBg: "#f8fafc", textColor: "#94a3b8" },
  };
  const cfg = configs[variant] ?? configs["off"]!;
  const label = variant.charAt(0).toUpperCase() + variant.slice(1);
  return specToOps({
    id: `${id}_root`, type: "frame", name: `${name} / ${label}`,
    x: placement.x, y: placement.y, width: placement.width, height: placement.height,
    layout: "horizontal", gap: 8, padding: 0,
    children: [
      {
        id: `${id}_track`, type: "frame", name: "track",
        width: 44, height: 24,
        cornerRadius: [12, 12, 12, 12],
        backgroundColor: cfg.trackBg,
        layout: "horizontal", padding: 2,
        children: [{
          id: `${id}_thumb`, type: "frame", name: "thumb",
          width: 20, height: 20,
          cornerRadius: [10, 10, 10, 10],
          backgroundColor: cfg.thumbBg,
        }],
      },
      {
        id: `${id}_lbl`, type: "text", name: "label",
        textContent: `${name} ${label}`, fontSize: 14, fontWeight: "400",
        textColor: cfg.textColor,
      },
    ],
  }, parent);
}

function buildTabsOps(id: string, name: string, placement: KitPlacement, parent = "document"): string {
  // Segmented-control pattern: gray pill + white active card.
  // Underline indicator is impossible in Pencil (no per-side border).
  return specToOps({
    id: `${id}_root`, type: "frame", name: `${name} / Default`,
    x: placement.x, y: placement.y, width: placement.width, height: placement.height,
    layout: "horizontal", gap: 4, padding: 4,
    cornerRadius: [8, 8, 8, 8],
    backgroundColor: "#f1f5f9",
    children: [
      {
        id: `${id}_tab1`, type: "frame", name: "tab-active",
        height: 36,
        layout: "horizontal", padding: 12,
        cornerRadius: [6, 6, 6, 6],
        backgroundColor: "#ffffff",
        children: [{
          id: `${id}_tab1_lbl`, type: "text", name: "label",
          textContent: "Tab 1", fontSize: 14, fontWeight: "600",
          textColor: "$tab-text-selected",
        }],
      },
      {
        id: `${id}_tab2`, type: "frame", name: "tab-2",
        height: 36,
        layout: "horizontal", padding: 12,
        children: [{
          id: `${id}_tab2_lbl`, type: "text", name: "label",
          textContent: "Tab 2", fontSize: 14, fontWeight: "400",
          textColor: "$tab-text",
        }],
      },
      {
        id: `${id}_tab3`, type: "frame", name: "tab-3",
        height: 36,
        layout: "horizontal", padding: 12,
        children: [{
          id: `${id}_tab3_lbl`, type: "text", name: "label",
          textContent: "Tab 3", fontSize: 14, fontWeight: "400",
          textColor: "$tab-text",
        }],
      },
    ],
  }, parent);
}

function buildDialogOps(id: string, name: string, placement: KitPlacement, parent = "document"): string {
  return specToOps({
    id: `${id}_root`, type: "frame", name: `${name} / Default`,
    x: placement.x, y: placement.y, width: placement.width, height: placement.height,
    layout: "vertical", gap: 16, padding: 24,
    cornerRadius: [12, 12, 12, 12],
    backgroundColor: "$dialog-bg",
    borderColor: "$--border",
    children: [
      {
        id: `${id}_title`, type: "text", name: "title",
        textContent: "Dialog Title", fontSize: 20, fontWeight: "600",
        textColor: "$--foreground",
      },
      {
        id: `${id}_body`, type: "frame", name: "body",
        width: "fill_container", height: 160,
        cornerRadius: [6, 6, 6, 6],
        backgroundColor: "$--surface",
      },
      {
        id: `${id}_footer`, type: "frame", name: "footer",
        width: "fill_container",
        layout: "horizontal", gap: 8, padding: 0,
        children: [
          {
            id: `${id}_cancel`, type: "frame", name: "cancel",
            width: 88, height: 36,
            cornerRadius: [6, 6, 6, 6],
            borderColor: "$--border",
            layout: "horizontal", padding: 10,
            children: [{
              id: `${id}_cancel_lbl`, type: "text", name: "label",
              textContent: "Cancel", fontSize: 14, fontWeight: "500",
              textColor: "$--foreground",
            }],
          },
          {
            id: `${id}_confirm`, type: "frame", name: "confirm",
            width: 88, height: 36,
            cornerRadius: [6, 6, 6, 6],
            backgroundColor: "$button-bg-primary",
            layout: "horizontal", padding: 10,
            children: [{
              id: `${id}_confirm_lbl`, type: "text", name: "label",
              textContent: "Confirm", fontSize: 14, fontWeight: "500",
              textColor: "$button-text-primary",
            }],
          },
        ],
      },
    ],
  }, parent);
}

function buildTooltipOps(id: string, name: string, placement: KitPlacement, variant = "dark", parent = "document"): string {
  const configs: Record<string, { bg: string; text: string }> = {
    dark:  { bg: "$tooltip-bg", text: "$tooltip-text" },
    light: { bg: "#f0f9ff", text: "#0f172a" },
  };
  const cfg = configs[variant] ?? configs["dark"]!;
  const label = variant.charAt(0).toUpperCase() + variant.slice(1);
  return specToOps({
    id: `${id}_root`, type: "frame", name: `${name} / ${label}`,
    x: placement.x, y: placement.y, width: placement.width, height: placement.height,
    layout: "horizontal", gap: 0, padding: 10,
    cornerRadius: [6, 6, 6, 6],
    backgroundColor: cfg.bg,
    children: [{
      id: `${id}_text`, type: "text", name: "text",
      textContent: "Tooltip message", fontSize: 12, fontWeight: "400",
      textColor: cfg.text,
    }],
  }, parent);
}

function buildComboboxOps(id: string, name: string, placement: KitPlacement, variant = "default", parent = "document"): string {
  const configs: Record<string, { bg: string; border: string; valueText: string; valueColor: string }> = {
    default:  { bg: "$combobox-bg", border: "$combobox-border", valueText: "Select option...", valueColor: "$--foreground-muted" },
    selected: { bg: "$combobox-bg", border: "$--primary", valueText: "Option selected", valueColor: "$--foreground" },
  };
  const cfg = configs[variant] ?? configs["default"]!;
  const label = variant.charAt(0).toUpperCase() + variant.slice(1);
  return specToOps({
    id: `${id}_root`, type: "frame", name: `${name} / ${label}`,
    x: placement.x, y: placement.y, width: placement.width,
    layout: "vertical", gap: 6, padding: 0,
    children: [
      {
        id: `${id}_lbl`, type: "text", name: "label",
        textContent: "Label", fontSize: 12, fontWeight: "500",
        textColor: "$--foreground",
      },
      {
        id: `${id}_ctrl`, type: "frame", name: "control",
        width: placement.width, height: placement.height,
        layout: "horizontal", gap: 8, padding: 10,
        cornerRadius: [6, 6, 6, 6],
        backgroundColor: cfg.bg,
        borderColor: cfg.border,
        children: [
          {
            id: `${id}_value`, type: "text", name: "value",
            textContent: cfg.valueText, fontSize: 14, fontWeight: "400",
            textColor: cfg.valueColor,
          },
          {
            id: `${id}_chevron`, type: "frame", name: "chevron",
            width: 16, height: 16,
          },
        ],
      },
    ],
  }, parent);
}

function buildBadgeOps(id: string, name: string, placement: KitPlacement, variant = "neutral", parent = "document"): string {
  const configs: Record<string, { bg: string; text: string }> = {
    neutral: { bg: "$badge-bg-neutral", text: "$badge-text-neutral" },
    success: { bg: "#dcfce7", text: "#166534" },
    warning: { bg: "#fef9c3", text: "#854d0e" },
    error:   { bg: "#fee2e2", text: "#991b1b" },
  };
  const cfg = configs[variant] ?? configs["neutral"]!;
  const label = variant.charAt(0).toUpperCase() + variant.slice(1);
  return specToOps({
    id: `${id}_root`, type: "frame", name: `${name} / ${label}`,
    x: placement.x, y: placement.y, width: placement.width, height: placement.height,
    layout: "horizontal", gap: 4, padding: 8,
    cornerRadius: [14, 14, 14, 14],
    backgroundColor: cfg.bg,
    children: [{
      id: `${id}_lbl`, type: "text", name: "label",
      textContent: label, fontSize: 12, fontWeight: "500",
      textColor: cfg.text,
    }],
  }, parent);
}

function buildToastOps(id: string, name: string, placement: KitPlacement, variant = "info", parent = "document"): string {
  // ADR-007: accentBar.width=4 via child frame (Pencil has no per-side borders)
  // ADR-007: constraints.closeGlyph="ascii-safe" → use × U+00D7 not ✕ U+2715
  const configs: Record<string, { accent: string; iconBg: string; label: string }> = {
    info:    { accent: "$--primary", iconBg: "$--primary", label: "Info" },
    success: { accent: "#16a34a", iconBg: "#16a34a", label: "Success" },
    warning: { accent: "#d97706", iconBg: "#d97706", label: "Warning" },
    error:   { accent: "#dc2626", iconBg: "#dc2626", label: "Error" },
  };
  const cfg = configs[variant] ?? configs["info"]!;
  const label = variant.charAt(0).toUpperCase() + variant.slice(1);
  return specToOps({
    id: `${id}_root`, type: "frame", name: `${name} / ${label}`,
    x: placement.x, y: placement.y, width: placement.width, height: placement.height,
    layout: "horizontal", gap: 0, padding: 0,
    cornerRadius: [8, 8, 8, 8],
    backgroundColor: "$toast-bg",
    borderColor: "$--border",
    children: [
      {
        // 4px accent bar on the left (ADR-007 accentBar rule — child frame, not border)
        id: `${id}_accent`, type: "frame", name: "accent-bar",
        width: 4, height: "fill_container",
        cornerRadius: [8, 0, 0, 8],
        backgroundColor: cfg.accent,
      },
      {
        id: `${id}_content`, type: "frame", name: "content",
        width: "fill_container",
        layout: "horizontal", gap: 12, padding: 16,
        children: [
          {
            id: `${id}_icon`, type: "frame", name: "icon",
            width: 20, height: 20,
            cornerRadius: [10, 10, 10, 10],
            backgroundColor: cfg.iconBg,
          },
          {
            id: `${id}_msg`, type: "text", name: "message",
            textContent: `${cfg.label}: operation completed`, fontSize: 14, fontWeight: "400",
            textColor: "$toast-text",
          },
          {
            id: `${id}_close`, type: "text", name: "close",
            textContent: "\u00D7", fontSize: 16, fontWeight: "400", // × U+00D7 (ascii-safe)
            textColor: "$--foreground-muted",
          },
        ],
      },
    ],
  }, parent);
}

function buildAlertOps(id: string, name: string, placement: KitPlacement, variant = "info", parent = "document"): string {
  // ADR-007: visualClass="inline-contextual" — tinted background per intent
  // ADR-007: constraints.closeGlyph="ascii-safe" → use × U+00D7 not ✕ U+2715
  const configs: Record<string, { bg: string; border: string; iconBg: string; label: string }> = {
    info:    { bg: "$alert-bg", border: "$alert-border", iconBg: "$--primary", label: "Info" },
    success: { bg: "#f0fdf4", border: "#16a34a", iconBg: "#16a34a", label: "Success" },
    warning: { bg: "#fffbeb", border: "#d97706", iconBg: "#d97706", label: "Warning" },
    error:   { bg: "#fef2f2", border: "#dc2626", iconBg: "#dc2626", label: "Error" },
  };
  const cfg = configs[variant] ?? configs["info"]!;
  const label = variant.charAt(0).toUpperCase() + variant.slice(1);
  return specToOps({
    id: `${id}_root`, type: "frame", name: `${name} / ${label}`,
    x: placement.x, y: placement.y, width: placement.width, height: placement.height,
    layout: "horizontal", gap: 12, padding: 16,
    cornerRadius: [8, 8, 8, 8],
    backgroundColor: cfg.bg,
    borderColor: cfg.border,
    children: [
      {
        id: `${id}_icon`, type: "frame", name: "icon",
        width: 24, height: 24,
        cornerRadius: [12, 12, 12, 12],
        backgroundColor: cfg.iconBg,
      },
      {
        id: `${id}_content`, type: "frame", name: "content",
        layout: "vertical", gap: 4, width: "fill_container",
        children: [
          {
            id: `${id}_title`, type: "text", name: "title",
            textContent: `${cfg.label} Alert`, fontSize: 14, fontWeight: "600",
            textColor: "$alert-text",
          },
          {
            id: `${id}_desc`, type: "text", name: "description",
            textContent: "Alert description with additional context.", fontSize: 14, fontWeight: "400",
            textColor: "$--foreground-secondary",
          },
        ],
      },
      {
        id: `${id}_close`, type: "text", name: "close",
        textContent: "\u00D7", fontSize: 16, fontWeight: "400", // × U+00D7 (ascii-safe)
        textColor: "$--foreground-muted",
      },
    ],
  }, parent);
}

function buildGenericOps(id: string, name: string, contract: ComponentContract, placement: KitPlacement, parent = "document"): string {
  const rootTokens = contract.tokens["root"]?.["default"] ?? {};
  const rootFill = tokenString(rootTokens["fill"]) ?? tokenString(rootTokens["background"]) ?? tokenString(rootTokens["backgroundColor"]);
  const bgColor = rootFill ? tokenToRef(rootFill) : undefined;
  return specToOps({
    id: `${id}_root`, type: "frame", name: `${name} / Default`,
    x: placement.x, y: placement.y, width: placement.width, height: placement.height,
    layout: "horizontal", gap: 8, padding: 12,
    cornerRadius: [6, 6, 6, 6],
    backgroundColor: bgColor,
    borderColor: "$--border",
    children: [{
      id: `${id}_lbl`, type: "text", name: "label",
      textContent: name, fontSize: 14, fontWeight: "500",
      textColor: "$--foreground",
    }],
  }, parent);
}

/** Pencil variable value — flat or themed (light/dark array). */
type PencilVarValue =
  | string
  | number
  | Array<{ value: string | number; theme: Record<string, string> }>;

/**
 * Flatten pencil variables.json to a simple key → value map.
 * For themed variables (light/dark arrays), uses the first (light-mode) value.
 */
function flattenPencilVars(
  raw: Record<string, { type: string; value: PencilVarValue }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (Array.isArray(v.value)) {
      const first = v.value[0];
      if (first) out[k] = String(first.value);
    } else {
      out[k] = String(v.value);
    }
  }
  return out;
}

/** Return a token value only if it is a plain string reference. */
function tokenString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}


/**
 * Generate batch_design operation strings for all variant states of a component (ADR-007).
 *
 * When the contract has a variantMatrix, renders one frame per primary axis value,
 * placed side-by-side with VARIANT_GAP px between each.
 * When no variantMatrix is defined, renders a single "default" frame.
 *
 * Fills and strokes use Pencil variable references ($button-bg-primary, $--border, etc.).
 * Run nib_brand_push before executing so variables are loaded in Pencil.
 */
/**
 * Build ops for one component section.
 *
 * Structure:
 *   kitFrameId (parent passed in — the "Component Kit" wrapper frame)
 *   └── ${id}_section  (light-gray card, layout=vertical)
 *       ├── ${id}_title  (section label)
 *       └── ${id}_row    (layout=horizontal, gap=VARIANT_GAP)
 *           ├── variant1 frame
 *           ├── variant2 frame
 *           └── ...
 */
function buildComponentOps(
  name: string,
  contract: ComponentContract,
  _placement: KitPlacement,
  _pencilVars: Record<string, string>,
  kitFrameId = "document",
): string {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const variants = getPrimaryVariants(contract);
  const widgetType = contract.widgetType;
  const frameSize = FRAME_SIZES[widgetType] ?? FRAME_SIZES["generic"]!;
  const effectiveVariants = variants.length > 0 ? variants : ["default"];

  const sectionId = `${id}_section`;
  const rowId = `${id}_row`;

  // Section card — child of the kit wrapper frame
  const sectionOps = specToOps({
    id: sectionId,
    type: "frame",
    name,
    layout: "vertical",
    gap: 12,
    padding: 16,
    cornerRadius: 12,
    backgroundColor: "#f5f6f7",
  }, kitFrameId);

  // Section label — child of section card
  const titleOps = specToOps({
    id: `${id}_title`,
    type: "text",
    name: "section-title",
    textContent: name,
    fontSize: 11,
    fontWeight: "600",
    textColor: "#566267",
  }, sectionId);

  // Variants row — horizontal flex child of section card
  const rowOps = specToOps({
    id: rowId,
    type: "frame",
    name: "variants",
    layout: "horizontal",
    gap: VARIANT_GAP,
  }, sectionId);

  // Dummy placement (x/y ignored inside flex — width/height still needed for variant frames)
  const variantPlacement: KitPlacement = { x: 0, y: 0, width: frameSize.width, height: frameSize.height };

  const opsParts: string[] = [sectionOps, titleOps, rowOps];
  for (let i = 0; i < effectiveVariants.length; i++) {
    const variant = effectiveVariants[i]!;
    const variantId = i === 0 ? id : `${id}_${variant.replace(/[^a-z0-9]+/g, "_")}`;
    switch (widgetType) {
      case "button":    opsParts.push(buildButtonOps(variantId, name, variantPlacement, variant, rowId)); break;
      case "textinput": opsParts.push(buildTextInputOps(variantId, name, variantPlacement, variant, rowId)); break;
      case "checkbox":  opsParts.push(buildCheckboxOps(variantId, name, variantPlacement, variant, rowId)); break;
      case "radio":     opsParts.push(buildRadioOps(variantId, name, variantPlacement, variant, rowId)); break;
      case "switch":    opsParts.push(buildSwitchOps(variantId, name, variantPlacement, variant, rowId)); break;
      case "tabs":      opsParts.push(buildTabsOps(variantId, name, variantPlacement, rowId)); break;
      case "dialog":    opsParts.push(buildDialogOps(variantId, name, variantPlacement, rowId)); break;
      case "tooltip":   opsParts.push(buildTooltipOps(variantId, name, variantPlacement, variant, rowId)); break;
      case "combobox":  opsParts.push(buildComboboxOps(variantId, name, variantPlacement, variant, rowId)); break;
      case "badge":     opsParts.push(buildBadgeOps(variantId, name, variantPlacement, variant, rowId)); break;
      case "toast":     opsParts.push(buildToastOps(variantId, name, variantPlacement, variant, rowId)); break;
      case "alert":     opsParts.push(buildAlertOps(variantId, name, variantPlacement, variant, rowId)); break;
      default:          opsParts.push(buildGenericOps(variantId, name, contract, variantPlacement, rowId)); break;
    }
  }
  return opsParts.join("\n");
}

/** Expected direct child counts per widget type (matching widget-specific builders). */
const WIDGET_CHILD_COUNTS: Record<string, number> = {
  button: 1,    // label text
  textinput: 2, // label text + input frame
  checkbox: 2,  // checkbox square + label text
  radio: 2,     // radio circle + label text
  switch: 2,    // track (contains thumb) + label text
  tabs: 3,      // 3 tab frames
  dialog: 3,    // title + body + footer
  tooltip: 1,   // text
  combobox: 2,  // label text + control frame
  badge: 1,     // label text
  toast: 2,     // accent-bar + content frame (ADR-007 accentBar child frame)
  alert: 3,     // icon + content frame + close glyph (ADR-007 ascii-safe ×)
};

/** Build the verification checklist for a component. */
function buildVerification(
  name: string,
  contract: ComponentContract,
  _pencilVars: Record<string, string>,
): KitVerification {
  const expectedChildCount = WIDGET_CHILD_COUNTS[contract.widgetType] ?? 1;
  const variants = getPrimaryVariants(contract);
  const variantCount = variants.length > 0 ? variants.length : 1;
  const firstVariantLabel = variants.length > 0
    ? (variants[0]!.charAt(0).toUpperCase() + variants[0]!.slice(1))
    : "Default";

  const visualChecks: string[] = [
    `Frame named "${name} / ${firstVariantLabel}" exists at x=80`,
    `No child fills appear black — if they do, brand variables are not loaded (run nib_brand_push first)`,
  ];

  if (variantCount > 1) {
    visualChecks.push(`${variantCount} variant frames exist side-by-side (${VARIANT_GAP}px gap between each)`);
  }

  switch (contract.widgetType) {
    case "button":
      visualChecks.push(`First variant fill is $button-bg-primary (brand primary color) — label text is light/white ($button-text-primary)`);
      break;
    case "textinput":
    case "combobox":
      visualChecks.push(`Label text is visible above the input/control box`);
      visualChecks.push(`Input/control frame has a light background ($input-bg or $combobox-bg) with a visible border stroke`);
      break;
    case "checkbox":
    case "radio":
      visualChecks.push(`Control square/circle (18×18) has a border stroke and light/white fill`);
      visualChecks.push(`Label text is visible and readable beside the control`);
      break;
    case "switch":
      visualChecks.push(`Track (44×24 pill) has a muted fill ($switch-track-bg = disabled color)`);
      visualChecks.push(`Thumb (20×20 circle) is inside the track with a light fill ($switch-thumb-bg)`);
      break;
    case "tabs":
      visualChecks.push(`Active tab has a 2px indicator stroke in $tab-indicator (brand primary color)`);
      visualChecks.push(`Active tab label uses $tab-text-selected (primary text), inactive tabs use $tab-text (muted)`);
      break;
    case "dialog":
      visualChecks.push(`Dialog has a surface background ($dialog-bg) with rounded corners (12px) and a border`);
      visualChecks.push(`Footer has Cancel (bordered) and Confirm ($button-bg-primary fill) buttons`);
      break;
    case "tooltip":
      visualChecks.push(`Dark variant has a near-black fill ($tooltip-bg) with light/white text ($tooltip-text)`);
      break;
    case "badge":
      visualChecks.push(`Neutral variant has $badge-bg-neutral fill; success/warning/error variants show distinct tinted backgrounds`);
      break;
    case "toast":
      visualChecks.push(`Each variant has a 4px accent bar on the left with intent-specific color (ADR-007 accentBar)`);
      visualChecks.push(`Close button shows \u00D7 glyph (× U+00D7, ascii-safe per ADR-007 constraints)`);
      break;
    case "alert":
      visualChecks.push(`Each intent variant has a distinct tinted background and border color`);
      visualChecks.push(`Close button shows \u00D7 glyph (× U+00D7, ascii-safe per ADR-007 constraints)`);
      break;
  }

  return {
    expectedChildCount,
    variantCount,
    visualChecks,
  };
}

// ── Foundation pages ──────────────────────────────────────────────────────────

/** Group pencil variable entries by semantic category. */
function groupVarsByCategory(pencilVars: Record<string, string>): {
  backgrounds: [string, string][];
  texts: [string, string][];
  interactives: [string, string][];
  feedbacks: [string, string][];
  borders: [string, string][];
} {
  const norm = (k: string) => k.replace(/^\$--/, "").replace(/^--/, "").replace(/^color-/, "");
  const entries = Object.entries(pencilVars).filter(([, v]) => /^#[0-9a-fA-F]{3,8}$/.test(v));

  return {
    backgrounds: entries.filter(([k]) => /^background/.test(norm(k))),
    texts: entries.filter(([k]) => /^(text|foreground)/.test(norm(k))),
    interactives: entries.filter(([k]) => /^interactive/.test(norm(k))),
    feedbacks: entries.filter(([k]) => /^(error|warning|success|info|feedback)/.test(norm(k))),
    borders: entries.filter(([k]) => /^border/.test(norm(k))),
  };
}

/** Resolve a usable text hex color for section headings. */
function headingColorHex(pencilVars: Record<string, string>): string {
  const key = Object.keys(pencilVars).find(k => /(\$--|^--)?(text-?primary|foreground)$/.test(k));
  return (key ? pencilVars[key] : undefined) ?? "#1a1a1a";
}

/** Resolve a usable background hex color for section backgrounds. */
function bgColorHex(pencilVars: Record<string, string>): string {
  const key = Object.keys(pencilVars).find(k => /^(\$--|--)?background$/.test(k));
  return (key ? pencilVars[key] : undefined) ?? "#f5f5f5";
}

/**
 * Build foundation page operations — color swatches, typography specimen, spacing scale.
 * Returns batch_design operation strings ready to execute.
 */
function buildFoundationsOps(
  brandName: string,
  pencilVars: Record<string, string>,
  startsAtY: number,
): { ops: string; foundations: KitFoundations } {
  const lines: string[] = [];
  const CANVAS_X = 80;
  const SWATCH_SIZE = 64;
  const SWATCH_GAP = 12;
  const ROW_HEIGHT = SWATCH_SIZE + 28; // swatch + label
  const SECTION_PADDING = 24;
  const SECTION_TITLE_HEIGHT = 40;
  const SECTION_GAP = 48;
  const headingColor = headingColorHex(pencilVars);

  let y = startsAtY;
  const groups = groupVarsByCategory(pencilVars);

  // ── Color palette page ─────────────────────────────────────────────────────

  const colorGroups: [string, [string, string][]][] = [
    ["Backgrounds", groups.backgrounds],
    ["Text", groups.texts],
    ["Interactive", groups.interactives],
    ["Feedback", groups.feedbacks],
    ["Borders", groups.borders],
  ].filter(([, entries]) => (entries as [string, string][]).length > 0) as [string, [string, string][]][];

  const totalSwatches = colorGroups.reduce((sum, [, e]) => sum + e.length, 0);

  if (colorGroups.length > 0) {
    // Section title
    lines.push(
      `color_page_title=I(document, {type: "text", name: "Color Palette", content: "Color Palette", x: ${CANVAS_X}, y: ${y}, fontSize: 28, fontWeight: "700", fill: "${headingColor}"})`,
    );
    y += SECTION_TITLE_HEIGHT + 8;

    for (const [groupName, entries] of colorGroups) {
      const groupId = groupName.toLowerCase().replace(/\s+/g, "_");
      const rowWidth = entries.length * (SWATCH_SIZE + SWATCH_GAP) - SWATCH_GAP + SECTION_PADDING * 2;

      lines.push(
        `color_group_${groupId}=I(document, {type: "frame", name: "Colors / ${groupName}", x: ${CANVAS_X}, y: ${y}, width: ${rowWidth}, height: ${ROW_HEIGHT + SECTION_TITLE_HEIGHT + SECTION_PADDING * 2}, layout: "vertical", gap: 8, padding: ${SECTION_PADDING}, cornerRadius: [8,8,8,8], fill: "${bgColorHex(pencilVars)}"})`,
      );
      lines.push(
        `color_group_${groupId}_label=I(color_group_${groupId}, {type: "text", name: "group-label", content: "${groupName}", fontSize: 12, fontWeight: "600", fill: "${headingColor}"})`,
      );
      lines.push(
        `color_swatches_${groupId}=I(color_group_${groupId}, {type: "frame", name: "swatches", layout: "horizontal", gap: ${SWATCH_GAP}})`,
      );

      for (let i = 0; i < entries.length; i++) {
        const [varKey, hexValue] = entries[i]!;
        const swatchId = `swatch_${groupId}_${i}`;
        const displayName = varKey.replace(/^\$--/, "").replace(/^--/, "");

        lines.push(
          `${swatchId}=I(color_swatches_${groupId}, {type: "frame", name: "${displayName}", width: ${SWATCH_SIZE}, layout: "vertical", gap: 4})`,
        );
        lines.push(
          `${swatchId}_color=I(${swatchId}, {type: "frame", name: "color", width: ${SWATCH_SIZE}, height: ${SWATCH_SIZE}, cornerRadius: [6,6,6,6], fill: "${hexValue}"})`,
        );
        lines.push(
          `${swatchId}_hex=I(${swatchId}, {type: "text", name: "hex", content: "${hexValue}", fontSize: 10, fill: "${headingColor}"})`,
        );
      }

      y += ROW_HEIGHT + SECTION_TITLE_HEIGHT + SECTION_PADDING * 2 + SECTION_GAP;
    }
  }

  y += SECTION_GAP;

  // ── Typography specimen ────────────────────────────────────────────────────

  const typeSteps: { label: string; fontSize: number; fontWeight: string; content: string }[] = [
    { label: "Display", fontSize: 48, fontWeight: "700", content: "Display Heading" },
    { label: "H1", fontSize: 36, fontWeight: "700", content: "Heading 1" },
    { label: "H2", fontSize: 28, fontWeight: "600", content: "Heading 2" },
    { label: "H3", fontSize: 22, fontWeight: "600", content: "Heading 3" },
    { label: "H4", fontSize: 18, fontWeight: "600", content: "Heading 4" },
    { label: "Body Large", fontSize: 16, fontWeight: "400", content: "Body text, large. Use for introductory paragraphs." },
    { label: "Body", fontSize: 14, fontWeight: "400", content: "Body text, default. Use for most UI text content." },
    { label: "Caption", fontSize: 12, fontWeight: "400", content: "Caption or helper text, smaller labels." },
    { label: "Code", fontSize: 13, fontWeight: "400", content: "const token = '{var.color-brand-600}';" },
  ];

  lines.push(
    `type_page_title=I(document, {type: "text", name: "Typography Scale", content: "Typography Scale", x: ${CANVAS_X}, y: ${y}, fontSize: 28, fontWeight: "700", fill: "${headingColor}"})`,
  );
  y += SECTION_TITLE_HEIGHT + 8;

  lines.push(
    `type_section=I(document, {type: "frame", name: "Typography / Specimen", x: ${CANVAS_X}, y: ${y}, width: 700, layout: "vertical", gap: 12, padding: ${SECTION_PADDING}, cornerRadius: [8,8,8,8], fill: "${bgColorHex(pencilVars)}"})`,
  );

  for (const step of typeSteps) {
    const stepId = `type_${step.label.toLowerCase().replace(/\s+/g, "_")}`;
    lines.push(
      `${stepId}_row=I(type_section, {type: "frame", name: "${step.label}", layout: "horizontal", gap: 16, width: "fill_container"})`,
    );
    lines.push(
      `${stepId}_meta=I(${stepId}_row, {type: "text", name: "meta", content: "${step.label} / ${step.fontSize}px", fontSize: 11, fontWeight: "500", fill: "${headingColor}", width: 100})`,
    );
    lines.push(
      `${stepId}_text=I(${stepId}_row, {type: "text", name: "specimen", content: "${step.content}", fontSize: ${step.fontSize}, fontWeight: "${step.fontWeight}", fill: "${headingColor}"})`,
    );
  }

  y += typeSteps.length * 60 + SECTION_PADDING * 2 + SECTION_GAP * 2;

  // ── Spacing scale ──────────────────────────────────────────────────────────

  const spacingSteps = [2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128];

  lines.push(
    `spacing_page_title=I(document, {type: "text", name: "Spacing Scale", content: "Spacing Scale", x: ${CANVAS_X}, y: ${y}, fontSize: 28, fontWeight: "700", fill: "${headingColor}"})`,
  );
  y += SECTION_TITLE_HEIGHT + 8;

  lines.push(
    `spacing_section=I(document, {type: "frame", name: "Spacing / Scale", x: ${CANVAS_X}, y: ${y}, width: 700, layout: "vertical", gap: 8, padding: ${SECTION_PADDING}, cornerRadius: [8,8,8,8], fill: "${bgColorHex(pencilVars)}"})`,
  );

  // Spacing bar fill — always use the primary interactive color, not the spacing token
  // (spacing tokens resolve to numeric pixel values, not hex colors)
  const spacingBarFill = groups.interactives[0] ? groups.interactives[0][1] : "#3b82f6";

  for (const step of spacingSteps) {
    const stepId = `spacing_${step}`;
    const barFill = spacingBarFill;

    lines.push(
      `${stepId}_row=I(spacing_section, {type: "frame", name: "${step}px", layout: "horizontal", gap: 12, width: "fill_container"})`,
    );
    lines.push(
      `${stepId}_label=I(${stepId}_row, {type: "text", name: "label", content: "${step}px", fontSize: 12, fontWeight: "500", fill: "${headingColor}", width: 48})`,
    );
    lines.push(
      `${stepId}_bar=I(${stepId}_row, {type: "frame", name: "bar", width: ${step * 2}, height: 20, cornerRadius: [4,4,4,4], fill: "${barFill}"})`,
    );
  }

  const ops = lines.join("\n");

  return {
    ops,
    foundations: {
      colorCount: totalSwatches,
      typographySteps: typeSteps.length,
      startsAtY,
      batchDesignOps: ops,
    },
  };
}

// ── Instruction ───────────────────────────────────────────────────────────────

/** Build the directive instruction text for the agent. */
function buildInstruction(components: KitComponent[]): string {
  return [
    `## Drawing the ${components.length} component(s) + foundation pages`,
    "",
    "PREREQUISITE: nib_brand_push must be run before executing these ops.",
    "Fills and strokes use Pencil variable references ($--primary, $color-brand-600, etc.).",
    "Without brand variables loaded, all fills will render as black.",
    "",
    "STEP 1 — Components (execute one at a time, verify before continuing):",
    "For each component in the recipe:",
    "  a. Call batch_design(filePath, component.batchDesignOps) — use the operations VERBATIM.",
    "     DO NOT rewrite them. Fill and stroke values use Pencil variable references.",
    "  b. Call snapshot_layout — confirm the frame is placed correctly with no clipping.",
    "  c. Call get_screenshot(nodeId) on the frame — check every item in component.verification.visualChecks.",
    "  d. If fills appear black, brand variables are not loaded — run nib_brand_push first.",
    "     Use batch_design Update operations to fix any layout or visibility issues.",
    "",
    "STEP 2 — Foundation pages (after all components):",
    "  Call batch_design(filePath, foundations.batchDesignOps) to create the color palette,",
    "  typography specimen, and spacing scale pages below the components.",
    "  Then call get_screenshot to visually verify the foundations page looks correct.",
    "",
    "STEP 3 — Final report:",
    "  Report: component names, frame nodeIds, any unresolved variable references or visual issues.",
    "  If any fill appears black instead of a colour, report it — variables may not be loaded.",
  ].join("\n");
}

// ── Core builder ──────────────────────────────────────────────────────────────

/** Build a KitComponent from a contract and resolved variables. */
function buildKitComponent(
  name: string,
  contract: ComponentContract,
  pencilVars: Record<string, string>,
  startY: number,
): KitComponent {
  const widgetType = contract.widgetType;
  const frameSize = FRAME_SIZES[widgetType] ?? FRAME_SIZES["generic"]!;

  const placement: KitPlacement = {
    x: 80,
    y: startY,
    width: frameSize.width,
    height: frameSize.height,
  };

  const anatomy = Object.keys(contract.anatomy);
  const states = Object.keys(contract.states);

  // Collect all token bindings, de-duplicated by varName
  const seen = new Set<string>();
  const tokenBindings: KitTokenBinding[] = [];

  for (const [, partTokens] of Object.entries(contract.tokens)) {
    for (const [, stateTokens] of Object.entries(partTokens)) {
      for (const [, tokenValue] of Object.entries(stateTokens)) {
        const strValue = tokenString(tokenValue);
        if (!strValue) continue;
        const token = strValue.replace(/^\{|\}$/g, "");
        const varName = tokenToVarName(token);
        if (seen.has(varName)) continue;
        seen.add(varName);
        const resolvedValue = pencilVars[varName] ?? "";
        tokenBindings.push({
          token,
          varName,
          resolvedValue,
          pencilExpr: `$${varName}`,
        });
      }
    }
  }

  return {
    name,
    widgetType,
    anatomy,
    states,
    tokenBindings,
    placement,
    batchDesignOps: buildComponentOps(name, contract, placement, pencilVars),
    verification: buildVerification(name, contract, pencilVars),
  };
}

/** Load and flatten pencil variables from the platform output path. */
async function loadPencilVars(
  config: NibBrandConfig,
): Promise<Record<string, string>> {
  const pencilPath = config.platforms.pencil;
  if (!existsSync(pencilPath)) {
    return {};
  }
  try {
    const raw = JSON.parse(await readFile(pencilPath, "utf-8")) as Record<
      string,
      { type: string; value: PencilVarValue }
    >;
    return flattenPencilVars(raw);
  } catch {
    return {};
  }
}

/** Options for buildKitRecipe */
export interface BuildKitRecipeOptions {
  /** Path to brand.config.json (default: .nib/brand.config.json) */
  config?: string;
  /** Filter to specific component names (default: all) */
  components?: string[];
}

/**
 * Build a kit recipe for Claude to scaffold component frames in Pencil.
 *
 * Returns structured data (READ-ONLY — no files written, no MCP calls).
 */
export async function buildKitRecipe(
  options: BuildKitRecipeOptions = {},
): Promise<KitRecipe> {
  const configPath = options.config ?? resolve(".nib", "brand.config.json");

  if (!existsSync(configPath)) {
    throw new Error(
      `No brand.config.json found at ${configPath}. Run nib_brand_init first.`,
    );
  }

  const { loadBrandConfig } = await import("./index.js");
  const config = await loadBrandConfig(options.config);

  const pencilVars = await loadPencilVars(config);

  const registry = config.components ?? {};
  const allNames = Object.keys(registry);
  const requestedNames =
    options.components?.length
      ? options.components.filter((n) => allNames.includes(n))
      : allNames;

  if (options.components?.length && requestedNames.length === 0) {
    const unknown = options.components.filter((n) => !allNames.includes(n));
    throw new Error(
      `Component(s) not found in registry: ${unknown.join(", ")}. Available: ${allNames.join(", ") || "(none)"}`,
    );
  }

  // Load contracts in parallel
  const contractEntries = await Promise.all(
    requestedNames.map(async (name) => {
      const entry = registry[name]!;
      const contractPath = resolve(entry.contractPath);
      try {
        const raw = await readFile(contractPath, "utf-8");
        const contract = JSON.parse(raw) as ComponentContract;
        return { name, contract };
      } catch {
        return { name, contract: null };
      }
    }),
  );

  // Build components with cumulative y-tracking so rows don't overlap.
  // Each row advances by the actual rendered height (ACTUAL_ROW_HEIGHTS) + ROW_SPACING.
  let currentY = 80;
  const components: KitComponent[] = contractEntries
    .filter((e): e is { name: string; contract: ComponentContract } => e.contract !== null)
    .map(({ name, contract }) => {
      const widgetType = contract.widgetType ?? "generic";
      const comp = buildKitComponent(name, contract, pencilVars, currentY);
      const actualHeight = ACTUAL_ROW_HEIGHTS[widgetType] ?? ACTUAL_ROW_HEIGHTS["generic"]!;
      currentY += actualHeight + ROW_SPACING;
      return comp;
    });

  if (components.length === 0) {
    const brandName = config.brand.name;
    const noComponents = allNames.length === 0;
    throw new Error(
      noComponents
        ? `No components in registry for brand "${brandName}". Run nib_component_init first.`
        : `Could not load contract files for the requested components.`,
    );
  }

  // Foundation pages start below all components.
  // currentY is already past the last component row (y + actualHeight + ROW_SPACING),
  // so add an extra gap for visual separation.
  const foundationsStartY = currentY + 80;

  const { ops: foundationsOps, foundations } = buildFoundationsOps(
    config.brand.name,
    pencilVars,
    foundationsStartY,
  );
  // Attach batchDesignOps to the returned foundations object
  const foundationsWithOps: KitFoundations = { ...foundations, batchDesignOps: foundationsOps };

  const instruction = buildInstruction(components);

  return {
    brandName: config.brand.name,
    pencilVariables: pencilVars,
    components,
    foundations: foundationsWithOps,
    instruction,
  };
}
