import { describe, expect, test } from "bun:test";
import { wrapJson } from "./output.js";

describe("output", () => {
  test("wrapJson produces correct envelope", () => {
    const result = wrapJson("brand.audit", { passed: 5, failed: 1 });
    expect(result).toEqual({
      version: "1",
      command: "brand.audit",
      data: { passed: 5, failed: 1 },
    });
  });

  test("wrapJson handles null data", () => {
    const result = wrapJson("status", null);
    expect(result.version).toBe("1");
    expect(result.command).toBe("status");
    expect(result.data).toBeNull();
  });

  test("wrapJson handles array data", () => {
    const result = wrapJson("list", ["a", "b"]);
    expect(result.data).toEqual(["a", "b"]);
  });
});
