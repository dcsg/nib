/**
 * Elevation (shadow) token generation.
 */

import type { DtcgTokenFile } from "../../types/brand.js";

/** Build elevation/shadow tokens */
export function buildElevationTokens(): DtcgTokenFile {
  return {
    elevation: {
      $type: "shadow",
      none: {
        $value: { offsetX: "0px", offsetY: "0px", blur: "0px", spread: "0px", color: "transparent" },
      },
      sm: {
        $value: { offsetX: "0px", offsetY: "1px", blur: "2px", spread: "0px", color: "rgba(0,0,0,0.05)" },
      },
      md: {
        $value: { offsetX: "0px", offsetY: "4px", blur: "6px", spread: "-1px", color: "rgba(0,0,0,0.1)" },
      },
      lg: {
        $value: { offsetX: "0px", offsetY: "10px", blur: "15px", spread: "-3px", color: "rgba(0,0,0,0.1)" },
      },
      xl: {
        $value: { offsetX: "0px", offsetY: "20px", blur: "25px", spread: "-5px", color: "rgba(0,0,0,0.1)" },
      },
    },
  };
}
