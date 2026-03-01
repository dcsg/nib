/**
 * $extensions.nib — inject the nib extension block into every leaf token.
 *
 * Called by the writer after token generation so individual generators
 * remain pure and free of metadata concerns.
 */

import type { DtcgTokenFile, ExtensionsNib } from "../../types/brand.js";

/** Build the $extensions.nib block for a newly-generated token */
export function makeNibExtension(owner: string = "design-systems"): ExtensionsNib {
  return {
    auditStatus: "unaudited",
    owner,
    deprecated: false,
    migrateTo: null,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Recursively walk a DTCG token object and inject $extensions.nib
 * into every leaf node that has a $value property.
 */
export function injectExtensions(
  obj: Record<string, unknown>,
  owner: string = "design-systems",
): Record<string, unknown> {
  // If this node is a leaf token (has $value), inject extensions
  if ("$value" in obj) {
    const existing = obj.$extensions as Record<string, unknown> | undefined;
    return {
      ...obj,
      $extensions: {
        ...(existing ?? {}),
        nib: makeNibExtension(owner),
      },
    };
  }

  // Otherwise recurse into children, skipping $ keys
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith("$")) {
      result[key] = val;
    } else if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      result[key] = injectExtensions(val as Record<string, unknown>, owner);
    } else {
      result[key] = val;
    }
  }
  return result;
}

/** Inject $extensions.nib into all tokens in a DtcgTokenFile */
export function injectExtensionsIntoFile(
  file: DtcgTokenFile,
  owner?: string,
): DtcgTokenFile {
  return injectExtensions(file as Record<string, unknown>, owner) as DtcgTokenFile;
}
