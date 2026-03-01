/**
 * GitHub Actions workflow command formatter for `nib brand validate`.
 *
 * Outputs `::error` / `::warning` annotations consumed by GitHub Actions log processor.
 * See: https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions
 *
 * Note: `file=` is omitted — ValidationIssue does not carry source file paths.
 */

import type { ValidationResult } from "../../../types/brand.js";

export function toGithubAnnotations(result: ValidationResult): string {
  const lines: string[] = [];

  for (const issue of result.errors) {
    const title = encodeAnnotationValue(issue.check);
    const msg = encodeAnnotationValue(`${issue.token}: ${issue.message}`);
    lines.push(`::error title=${title}::${msg}`);
  }

  for (const issue of result.warnings) {
    const title = encodeAnnotationValue(issue.check);
    const msg = encodeAnnotationValue(`${issue.token}: ${issue.message}`);
    lines.push(`::warning title=${title}::${msg}`);
  }

  return lines.join("\n");
}

/** Escape special characters per GitHub annotation encoding rules. */
function encodeAnnotationValue(value: string): string {
  return value
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A")
    .replace(/:/g, "%3A")
    .replace(/,/g, "%2C");
}
