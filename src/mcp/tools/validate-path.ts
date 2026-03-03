/**
 * Path traversal guard for MCP tool handlers.
 *
 * Ensures all file paths stay within the current working directory.
 */

import { resolve } from "node:path";

/**
 * Resolve and validate a file path against cwd.
 * Throws if the resolved path escapes the project directory.
 */
export function validateProjectPath(filePath: string): string {
  const cwd = process.cwd();
  const resolved = resolve(cwd, filePath);

  if (!resolved.startsWith(cwd + "/") && resolved !== cwd) {
    throw new Error(
      `Path traversal denied: "${filePath}" resolves outside the project directory.`,
    );
  }

  return resolved;
}

/**
 * Resolve an input source path for reading brand source files.
 *
 * Unlike validateProjectPath, this does NOT enforce project-directory boundaries.
 * Use this when users supply brand brief files, guidelines, or PDFs that may
 * live outside the nib package directory (e.g. /tmp/my-project/brand-brief.md).
 *
 * Relative paths are resolved against cwd. Absolute paths pass through unchanged.
 */
export function resolveInputPath(filePath: string): string {
  return resolve(filePath);
}
