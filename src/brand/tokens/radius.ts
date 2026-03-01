/**
 * Border radius token generation.
 */

import type { DtcgTokenFile } from "../../types/brand.js";

/** Build border radius tokens */
export function buildRadiusTokens(): DtcgTokenFile {
  return {
    "border-radius": {
      $type: "dimension",
      none: { $value: "0px" },
      sm: { $value: "4px" },
      md: { $value: "8px" },
      lg: { $value: "12px" },
      xl: { $value: "16px" },
      "2xl": { $value: "24px" },
      full: { $value: "9999px" },
    },
  };
}
