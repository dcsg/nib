/**
 * Elevation (shadow) token generation.
 */

import type { DtcgTokenFile } from "../../types/brand.js";

/** Build elevation/shadow tokens (ADR-008: structured ShadowValue objects) */
export function buildElevationTokens(): DtcgTokenFile {
  return {
    elevation: {
      $type: "shadow",
      none: {
        $value: { offsetX: { value: 0, unit: "px" }, offsetY: { value: 0, unit: "px" }, blur: { value: 0, unit: "px" }, spread: { value: 0, unit: "px" }, color: "transparent" },
      },
      sm: {
        $value: { offsetX: { value: 0, unit: "px" }, offsetY: { value: 1, unit: "px" }, blur: { value: 2, unit: "px" }, spread: { value: 0, unit: "px" }, color: "rgba(0,0,0,0.05)" },
      },
      md: {
        $value: { offsetX: { value: 0, unit: "px" }, offsetY: { value: 4, unit: "px" }, blur: { value: 6, unit: "px" }, spread: { value: -1, unit: "px" }, color: "rgba(0,0,0,0.1)" },
      },
      lg: {
        $value: { offsetX: { value: 0, unit: "px" }, offsetY: { value: 10, unit: "px" }, blur: { value: 15, unit: "px" }, spread: { value: -3, unit: "px" }, color: "rgba(0,0,0,0.1)" },
      },
      xl: {
        $value: { offsetX: { value: 0, unit: "px" }, offsetY: { value: 20, unit: "px" }, blur: { value: 25, unit: "px" }, spread: { value: -5, unit: "px" }, color: "rgba(0,0,0,0.1)" },
      },
    },
  };
}
