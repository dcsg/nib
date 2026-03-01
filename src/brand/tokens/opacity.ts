/**
 * Opacity token generation — semantic opacity values for interaction states.
 */

import type { DtcgTokenFile } from "../../types/brand.js";

/** Build opacity tokens */
export function buildOpacityTokens(): DtcgTokenFile {
  return {
    opacity: {
      $type: "number",
      disabled: { $value: 0.38 },
      hover: { $value: 0.08 },
      pressed: { $value: 0.12 },
      overlay: { $value: 0.5 },
      loading: { $value: 0.3 },
    },
  };
}
