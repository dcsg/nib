import { describe, expect, test } from "bun:test";
import { ExitCode } from "./exit-codes.js";

describe("ExitCode", () => {
  test("SUCCESS is 0", () => {
    expect(ExitCode.SUCCESS).toBe(0);
  });

  test("ERROR is 1", () => {
    expect(ExitCode.ERROR).toBe(1);
  });

  test("USAGE is 2", () => {
    expect(ExitCode.USAGE).toBe(2);
  });

  test("VALIDATION_FAILURE is 3", () => {
    expect(ExitCode.VALIDATION_FAILURE).toBe(3);
  });

  test("CONFIG_ERROR is 4", () => {
    expect(ExitCode.CONFIG_ERROR).toBe(4);
  });

  test("NETWORK_ERROR is 5", () => {
    expect(ExitCode.NETWORK_ERROR).toBe(5);
  });

  test("all codes are unique", () => {
    const values = Object.values(ExitCode);
    expect(new Set(values).size).toBe(values.length);
  });
});
