import { describe, expect, test } from "bun:test";
import { toSarif } from "./sarif.js";
import type { ValidationResult } from "../../../types/brand.js";

const SARIF_SCHEMA =
  "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Documents/CommitteeSpecifications/2.1.0/sarif-schema-2.1.0.json";

describe("toSarif", () => {
  const validResult: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  const resultWithIssues: ValidationResult = {
    valid: false,
    errors: [
      { check: "V-01", token: "color.brand.500", message: "$type is required" },
      { check: "V-04", token: "color_bad_name", message: "Token name must use dot notation" },
    ],
    warnings: [
      { check: "V-06", token: "color.neutral.50", message: "Alias token references undefined path" },
    ],
  };

  test("returns SARIF 2.1.0 version and schema", () => {
    const sarif = toSarif(validResult, "1.0.0") as Record<string, unknown>;
    expect(sarif["version"]).toBe("2.1.0");
    expect(sarif["$schema"]).toBe(SARIF_SCHEMA);
  });

  test("has exactly one run", () => {
    const sarif = toSarif(validResult, "1.0.0") as { runs: unknown[] };
    expect(sarif.runs).toHaveLength(1);
  });

  test("tool driver name is nib with correct version", () => {
    const sarif = toSarif(validResult, "2.3.4") as {
      runs: Array<{ tool: { driver: { name: string; version: string } } }>;
    };
    const driver = sarif.runs[0]!.tool.driver;
    expect(driver.name).toBe("nib");
    expect(driver.version).toBe("2.3.4");
  });

  test("maps errors as level=error results", () => {
    const sarif = toSarif(resultWithIssues, "1.0.0") as {
      runs: Array<{ results: Array<{ ruleId: string; level: string; message: { text: string } }> }>;
    };
    const results = sarif.runs[0]!.results;
    const errors = results.filter((r) => r.level === "error");
    expect(errors).toHaveLength(2);
    expect(errors[0]!.ruleId).toBe("V-01");
    expect(errors[0]!.message.text).toContain("color.brand.500");
    expect(errors[0]!.message.text).toContain("$type is required");
  });

  test("maps warnings as level=warning results", () => {
    const sarif = toSarif(resultWithIssues, "1.0.0") as {
      runs: Array<{ results: Array<{ ruleId: string; level: string }> }>;
    };
    const results = sarif.runs[0]!.results;
    const warnings = results.filter((r) => r.level === "warning");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.ruleId).toBe("V-06");
  });

  test("includes logicalLocations with token name", () => {
    const sarif = toSarif(resultWithIssues, "1.0.0") as {
      runs: Array<{
        results: Array<{ logicalLocations: Array<{ name: string; kind: string }> }>;
      }>;
    };
    const firstResult = sarif.runs[0]!.results[0]!;
    expect(firstResult.logicalLocations[0]!.name).toBe("color.brand.500");
    expect(firstResult.logicalLocations[0]!.kind).toBe("module");
  });

  test("populates rules from unique check IDs", () => {
    const sarif = toSarif(resultWithIssues, "1.0.0") as {
      runs: Array<{ tool: { driver: { rules: Array<{ id: string }> } } }>;
    };
    const ruleIds = sarif.runs[0]!.tool.driver.rules.map((r) => r.id).sort();
    expect(ruleIds).toEqual(["V-01", "V-04", "V-06"]);
  });

  test("empty results when no issues", () => {
    const sarif = toSarif(validResult, "1.0.0") as {
      runs: Array<{ results: unknown[] }>;
    };
    expect(sarif.runs[0]!.results).toHaveLength(0);
  });
});
