/**
 * Generates CDN link tags for fonts and icon libraries detected in assets.
 */

import type { DesignAsset } from "../types/design.js";

export function collectAssetLinks(assets: DesignAsset[], standalone: boolean): string[] {
  if (standalone) {
    // Standalone mode: assets are inlined later — no CDN links
    return [];
  }

  const links: string[] = [];
  const googleFonts: string[] = [];

  for (const asset of assets) {
    if (asset.type === "font" && asset.provider === "google" && asset.family) {
      const weights = asset.weights?.join(";") ?? "400;500;600;700";
      googleFonts.push(`family=${encodeURIComponent(asset.family)}:wght@${weights}`);
    }

    if (asset.type === "icon_font") {
      if (asset.provider === "material") {
        links.push(
          `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200">`,
        );
      } else if (asset.provider === "lucide") {
        links.push(
          `<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"><\/script>`,
        );
      }
    }
  }

  if (googleFonts.length > 0) {
    links.unshift(
      `<link rel="preconnect" href="https://fonts.googleapis.com">`,
      `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
      `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${googleFonts.join("&")}&display=swap">`,
    );
  }

  return links;
}
