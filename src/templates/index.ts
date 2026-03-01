/**
 * Template registry — available templates and device definitions.
 */

import type { DeviceInfo, TemplateInfo } from "../types/options.js";
import type { Template } from "./base/types.js";
import { cleanTemplate } from "./clean/index.js";
import { presentationTemplate } from "./presentation/index.js";

export type { Template, TemplateContext } from "./base/types.js";

const TEMPLATE_MAP: Record<string, Template> = {
  clean: cleanTemplate,
  presentation: presentationTemplate,
};

export function getTemplate(name: string): Template {
  const tmpl = TEMPLATE_MAP[name];
  if (!tmpl) throw new Error(`Unknown template: "${name}". Available: ${Object.keys(TEMPLATE_MAP).join(", ")}`);
  return tmpl;
}

export const TEMPLATES: TemplateInfo[] = Object.values(TEMPLATE_MAP).map((t) => ({
  name: t.name,
  description: t.description,
}));

export const DEVICES: DeviceInfo[] = [
  // Phones
  { name: "iPhone 16 Pro", width: 393, height: 852, category: "phone" },
  { name: "iPhone 16 Pro Max", width: 430, height: 932, category: "phone" },
  { name: "iPhone SE", width: 375, height: 667, category: "phone" },
  { name: "Pixel 9", width: 412, height: 924, category: "phone" },
  { name: "Samsung Galaxy S24", width: 360, height: 780, category: "phone" },

  // Tablets
  { name: "iPad Pro 13\"", width: 1032, height: 1376, category: "tablet" },
  { name: "iPad Pro 11\"", width: 834, height: 1194, category: "tablet" },
  { name: "iPad Mini", width: 744, height: 1133, category: "tablet" },

  // Desktop
  { name: "MacBook Pro 16\"", width: 1728, height: 1117, category: "desktop" },
  { name: "MacBook Pro 14\"", width: 1512, height: 982, category: "desktop" },
  { name: "MacBook Air 13\"", width: 1470, height: 956, category: "desktop" },
  { name: "Desktop 1920", width: 1920, height: 1080, category: "desktop" },
  { name: "Desktop 1440", width: 1440, height: 900, category: "desktop" },
  { name: "Desktop 1280", width: 1280, height: 800, category: "desktop" },
];

/** Find the closest matching device for given canvas dimensions */
export function detectDevice(width: number, height: number): DeviceInfo | null {
  let best: DeviceInfo | null = null;
  let bestDist = Infinity;

  for (const device of DEVICES) {
    const dist = Math.abs(device.width - width) + Math.abs(device.height - height);
    if (dist < bestDist) {
      bestDist = dist;
      best = device;
    }
  }

  // Only match if reasonably close (within 50px per dimension)
  if (best && bestDist <= 100) return best;
  return null;
}
