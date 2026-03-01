/**
 * Breakpoint token generation — responsive design breakpoints.
 */

import type { DtcgTokenFile } from "../../types/brand.js";

/** Build breakpoint tokens */
export function buildBreakpointTokens(): DtcgTokenFile {
  return {
    breakpoint: {
      $type: "dimension",
      xs: { $value: "0px" },
      sm: { $value: "480px" },
      md: { $value: "768px" },
      lg: { $value: "1024px" },
      xl: { $value: "1280px" },
      "2xl": { $value: "1536px" },
    },
  };
}
