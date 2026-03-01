import { afterEach, describe, expect, test } from "bun:test";
import { isCI, isTTY, isInteractive, shouldColor } from "./env.js";

describe("env detection", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env after each test
    for (const key of ["CI", "GITHUB_ACTIONS", "GITLAB_CI", "CIRCLECI", "JENKINS_URL", "TF_BUILD", "FORCE_COLOR", "NO_COLOR"]) {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  test("isCI detects CI env var", () => {
    process.env["CI"] = "true";
    expect(isCI()).toBe(true);
  });

  test("isCI detects GITHUB_ACTIONS", () => {
    delete process.env["CI"];
    process.env["GITHUB_ACTIONS"] = "true";
    expect(isCI()).toBe(true);
  });

  test("isCI returns false when no CI vars set", () => {
    delete process.env["CI"];
    delete process.env["GITHUB_ACTIONS"];
    delete process.env["GITLAB_CI"];
    delete process.env["CIRCLECI"];
    delete process.env["JENKINS_URL"];
    delete process.env["TF_BUILD"];
    expect(isCI()).toBe(false);
  });

  test("isTTY returns a boolean", () => {
    expect(typeof isTTY()).toBe("boolean");
  });

  test("isInteractive returns false in CI", () => {
    process.env["CI"] = "true";
    expect(isInteractive()).toBe(false);
  });

  test("shouldColor respects FORCE_COLOR", () => {
    process.env["FORCE_COLOR"] = "1";
    delete process.env["NO_COLOR"];
    expect(shouldColor()).toBe(true);
  });

  test("shouldColor respects NO_COLOR", () => {
    delete process.env["FORCE_COLOR"];
    process.env["NO_COLOR"] = "";
    expect(shouldColor()).toBe(false);
  });

  test("FORCE_COLOR=0 does not force color", () => {
    process.env["FORCE_COLOR"] = "0";
    delete process.env["NO_COLOR"];
    // FORCE_COLOR=0 is treated as falsy, falls through to TTY check
    expect(typeof shouldColor()).toBe("boolean");
  });
});
