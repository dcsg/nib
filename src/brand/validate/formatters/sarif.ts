/**
 * SARIF 2.1.0 formatter for `nib brand validate` output.
 *
 * See: https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
 */

import type { ValidationResult } from "../../../types/brand.js";

const SARIF_SCHEMA =
  "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Documents/CommitteeSpecifications/2.1.0/sarif-schema-2.1.0.json";

export function toSarif(result: ValidationResult, nibVersion: string): object {
  // Collect all unique check IDs for the rules array
  const ruleIds = new Set<string>();
  for (const issue of [...result.errors, ...result.warnings]) {
    ruleIds.add(issue.check);
  }

  const rules = Array.from(ruleIds).map((id) => ({
    id,
    shortDescription: { text: `nib token check ${id}` },
  }));

  const sarifResults = [
    ...result.errors.map((issue) => ({
      ruleId: issue.check,
      level: "error" as const,
      message: { text: `${issue.token}: ${issue.message}` },
      logicalLocations: [{ name: issue.token, kind: "module" }],
    })),
    ...result.warnings.map((issue) => ({
      ruleId: issue.check,
      level: "warning" as const,
      message: { text: `${issue.token}: ${issue.message}` },
      logicalLocations: [{ name: issue.token, kind: "module" }],
    })),
  ];

  return {
    version: "2.1.0",
    $schema: SARIF_SCHEMA,
    runs: [
      {
        tool: {
          driver: {
            name: "nib",
            version: nibVersion,
            informationUri: "https://github.com/nib-design/nib",
            rules,
          },
        },
        results: sarifResults,
      },
    ],
  };
}
