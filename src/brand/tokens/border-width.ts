/**
 * Border width token generation.
 */

import type { DtcgTokenFile } from "../../types/brand.js";

/** Build border width tokens */
export function buildBorderWidthTokens(): DtcgTokenFile {
  return {
    "border-width": {
      $type: "dimension",
      none: { $value: "0px" },
      thin: { $value: "1px" },
      default: { $value: "1px" },
      thick: { $value: "2px" },
      thicker: { $value: "4px" },
    },
  };
}
