/**
 * Font availability check — verify brand fonts are installed before pushing to Pencil.
 *
 * Pencil silently falls back to the system default when a font is missing.
 * Catching this at push time (rather than after opening the file) gives
 * actionable feedback before the user sees wrong rendering.
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";

/** Result of a font availability check */
export interface FontCheckResult {
  /** The font family name that was checked */
  family: string;
  /** True if the font is found on this system */
  installed: boolean;
  /** Suggested fix message shown to the user when not installed */
  hint?: string;
}

/** System font directories to scan on macOS */
const MACOS_FONT_DIRS = [
  join(homedir(), "Library", "Fonts"),
  "/Library/Fonts",
  "/System/Library/Fonts",
  "/System/Library/Fonts/Supplemental",
  "/Network/Library/Fonts",
];

/** System font directories to scan on Linux */
const LINUX_FONT_DIRS = [
  join(homedir(), ".fonts"),
  join(homedir(), ".local", "share", "fonts"),
  "/usr/share/fonts",
  "/usr/local/share/fonts",
];

/** Check if a font family is available via fontconfig (fc-list) */
function checkFontconfigList(family: string): boolean {
  try {
    const output = execSync("fc-list", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000,
    });
    return output.toLowerCase().includes(family.toLowerCase());
  } catch {
    return false;
  }
}

/** Scan font directories for files matching the family name */
function checkFontDirectories(family: string, dirs: string[]): boolean {
  const pattern = family.toLowerCase().replace(/\s+/g, "");
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    try {
      const files = readdirSync(dir, { recursive: true });
      for (const file of files) {
        const fileName = String(file).toLowerCase().replace(/[\s-_]/g, "");
        if (fileName.includes(pattern)) return true;
      }
    } catch {
      // Skip unreadable directories
    }
  }
  return false;
}

/** Build a download hint for common fonts */
function buildHint(family: string): string {
  const slug = family.toLowerCase().replace(/\s+/g, "-");
  const googleSlug = family.replace(/\s+/g, "+");
  const npmPackage = `@fontsource/${slug}`;

  const lines = [
    `Font "${family}" is not installed — Pencil will fall back to the system default font.`,
    ``,
    `Fix options:`,
    `  → Download:   https://fonts.google.com/specimen/${googleSlug}`,
    `  → Web project: npm install ${npmPackage}`,
  ];

  if (process.platform === "darwin") {
    lines.push(`  → macOS:       Download the font and drag to Font Book`);
  }

  return lines.join("\n");
}

/**
 * Check whether a font family is installed on the current system.
 *
 * Uses fontconfig (fc-list) when available, falls back to directory scanning.
 * Returns a result with an actionable hint when the font is not found.
 */
export function checkFontInstalled(family: string): FontCheckResult {
  // Skip check for generic families — always available
  const genericFamilies = new Set(["inter", "system-ui", "sans-serif", "serif", "monospace"]);
  if (genericFamilies.has(family.toLowerCase())) {
    return { family, installed: true };
  }

  const os = platform();

  // Try fontconfig first (fastest, available on most Unix systems)
  if (os === "darwin" || os === "linux") {
    try {
      execSync("which fc-list", { stdio: "ignore", timeout: 1000 });
      const found = checkFontconfigList(family);
      if (found) return { family, installed: true };
      // fc-list available but not found — directory scan as backup
    } catch {
      // fc-list not available — fall through to directory scan
    }
  }

  // Directory scan
  const dirs = os === "darwin" ? MACOS_FONT_DIRS : LINUX_FONT_DIRS;
  if (os === "darwin" || os === "linux") {
    const found = checkFontDirectories(family, dirs);
    if (found) return { family, installed: true };
    return { family, installed: false, hint: buildHint(family) };
  }

  // Windows or unknown — skip check (can't reliably detect)
  return { family, installed: true };
}

/**
 * Extract font family names from a Pencil variables JSON object.
 * Returns unique font families referenced in font-family-* variables.
 */
export function extractFontFamiliesFromVars(
  variables: Record<string, { type: string; value: unknown }>,
): string[] {
  const families: string[] = [];
  for (const [key, { type, value }] of Object.entries(variables)) {
    if (type === "string" && key.startsWith("font-family-") && typeof value === "string") {
      // Take only the first font in a fallback stack
      const first = value.split(",")[0]?.trim();
      if (first) families.push(first);
    }
  }
  return [...new Set(families)];
}
