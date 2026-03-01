/**
 * Z-index token generation — layering scale for stacking contexts.
 */

import type { DtcgTokenFile } from "../../types/brand.js";

/** Build z-index tokens */
export function buildZIndexTokens(): DtcgTokenFile {
  return {
    "z-index": {
      $type: "number",
      hide: { $value: -1 },
      base: { $value: 0 },
      dropdown: { $value: 1000 },
      sticky: { $value: 1100 },
      fixed: { $value: 1200 },
      "modal-backdrop": { $value: 1300 },
      modal: { $value: 1400 },
      popover: { $value: 1500 },
      tooltip: { $value: 1600 },
      overlay: { $value: 1700 },
    },
  };
}
