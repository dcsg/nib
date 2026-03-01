import { describe, expect, test } from "bun:test";
import { toGithubAnnotations } from "./github.js";
import type { ValidationResult } from "../../../types/brand.js";

describe("toGithubAnnotations", () => {
  const validResult: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  const resultWithIssues: ValidationResult = {
    valid: false,
    errors: [
      { check: "V-01", token: "color.brand.500", message: "$type is required" },
      { check: "V-04", token: "color_bad", message: "Use dot notation" },
    ],
    warnings: [
      { check: "V-06", token: "color.neutral.50", message: "Alias references undefined" },
    ],
  };

  test("returns empty string when no issues", () => {
    expect(toGithubAnnotations(validResult)).toBe("");
  });

  test("errors produce ::error lines", () => {
    const output = toGithubAnnotations(resultWithIssues);
    const lines = output.split("\n");
    const errorLines = lines.filter((l) => l.startsWith("::error"));
    expect(errorLines).toHaveLength(2);
  });

  test("warnings produce ::warning lines", () => {
    const output = toGithubAnnotations(resultWithIssues);
    const lines = output.split("\n");
    const warnLines = lines.filter((l) => l.startsWith("::warning"));
    expect(warnLines).toHaveLength(1);
  });

  test("error line contains check as title and token+message as body", () => {
    const output = toGithubAnnotations({
      valid: false,
      errors: [{ check: "V-01", token: "color.brand.500", message: "$type is required" }],
      warnings: [],
    });
    // Check ID in title (colons encoded)
    expect(output).toContain("title=V-01");
    // Token and message in body (colons encoded)
    expect(output).toContain("color.brand.500");
    expect(output).toContain("$type is required");
  });

  test("colons in token paths are encoded as %3A", () => {
    // Colons appear in check IDs like "V-01" — the hyphen isn't encoded, only ':'
    // Inject a colon directly in the message to verify encoding
    const output = toGithubAnnotations({
      valid: false,
      errors: [{ check: "V:test", token: "tok", message: "msg:with:colons" }],
      warnings: [],
    });
    // The check ID colon should be encoded
    expect(output).toContain("V%3Atest");
    // Message colons should be encoded
    expect(output).toContain("msg%3Awith%3Acolons");
  });

  test("errors come before warnings in output", () => {
    const output = toGithubAnnotations(resultWithIssues);
    const errorIdx = output.indexOf("::error");
    const warnIdx = output.indexOf("::warning");
    expect(errorIdx).toBeLessThan(warnIdx);
  });
});
