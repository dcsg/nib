/**
 * Sizing token generation — icon, component, container, and touch-target sizes.
 */

import type { DtcgTokenFile } from "../../types/brand.js";

/** Build sizing tokens */
export function buildSizingTokens(): DtcgTokenFile {
  return {
    sizing: {
      $type: "dimension",
      icon: {
        sm: { $value: "16px" },
        md: { $value: "20px" },
        lg: { $value: "24px" },
        xl: { $value: "32px" },
        "2xl": { $value: "40px" },
      },
      component: {
        xs: { $value: "24px" },
        sm: { $value: "32px" },
        md: { $value: "40px" },
        lg: { $value: "48px" },
        xl: { $value: "56px" },
      },
      container: {
        sm: { $value: "640px" },
        md: { $value: "768px" },
        lg: { $value: "1024px" },
        xl: { $value: "1280px" },
        "2xl": { $value: "1536px" },
      },
      "touch-target": { $value: "44px" },
    },
  };
}
