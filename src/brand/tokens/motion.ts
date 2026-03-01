/**
 * Motion (duration + easing + transition) token generation.
 */

import type { DtcgTokenFile } from "../../types/brand.js";

/** Build motion tokens */
export function buildMotionTokens(): DtcgTokenFile {
  return {
    duration: {
      $type: "duration",
      instant: { $value: "0ms" },
      fast: { $value: "100ms" },
      normal: { $value: "200ms" },
      slow: { $value: "300ms" },
      slower: { $value: "500ms" },
    },
    easing: {
      $type: "cubicBezier",
      default: { $value: [0.4, 0, 0.2, 1] },
      in: { $value: [0.4, 0, 1, 1] },
      out: { $value: [0, 0, 0.2, 1] },
      "ease-in-out": { $value: [0.4, 0, 0.2, 1] },
      spring: { $value: [0.175, 0.885, 0.32, 1.275] },
    },
    transition: {
      $type: "transition",
      /**
       * Micro-interactions: hover, focus, small state changes (100ms)
       */
      micro: {
        $value: {
          duration: "{duration.fast}",
          delay: "0ms",
          timingFunction: "{easing.out}",
        },
      },
      /**
       * Default UI transitions: panels, modals, dropdowns (200ms)
       */
      default: {
        $value: {
          duration: "{duration.normal}",
          delay: "0ms",
          timingFunction: "{easing.default}",
        },
      },
      /**
       * Page-level transitions and large element movements (300ms)
       */
      page: {
        $value: {
          duration: "{duration.slow}",
          delay: "0ms",
          timingFunction: "{easing.ease-in-out}",
        },
      },
    },
  };
}
