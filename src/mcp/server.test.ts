/**
 * MCP Server integration test.
 *
 * Uses InMemoryTransport to connect a client to the nib MCP server
 * without spawning a subprocess or touching stdio.
 */

import { describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createNibMcpServer } from "./server.js";

async function createTestPair() {
  const server = createNibMcpServer();
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);

  const client = new Client({ name: "nib-test", version: "1.0.0" });
  await client.connect(clientTransport);

  return { server, client };
}

describe("MCP Server", () => {
  test("creates server instance", () => {
    const server = createNibMcpServer();
    expect(server).toBeDefined();
  });

  test("lists all 13 tools", async () => {
    const { client } = await createTestPair();
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name).sort();

    expect(toolNames).toEqual([
      "nib_brand_audit",
      "nib_brand_build",
      "nib_brand_import",
      "nib_brand_init",
      "nib_brand_push",
      "nib_brand_validate",
      "nib_build_prototype",
      "nib_capture",
      "nib_component_init",
      "nib_component_list",
      "nib_help",
      "nib_kit",
      "nib_status",
    ]);
  });

  test("all tools have descriptions", async () => {
    const { client } = await createTestPair();
    const result = await client.listTools();

    for (const tool of result.tools) {
      expect(tool.description).toBeTruthy();
    }
  });

  test("lists resource templates", async () => {
    const { client } = await createTestPair();
    const result = await client.listResourceTemplates();

    const uriTemplates = result.resourceTemplates.map((r) => r.uriTemplate).sort();
    expect(uriTemplates).toContain("nib://tokens/{category}/{name}");
    expect(uriTemplates).toContain("nib://components/{name}");
  });

  test("nib_status returns structured response", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({ name: "nib_status" });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toBeDefined();
    expect(Array.isArray(content)).toBe(true);
    expect(content[0]!.type).toBe("text");

    // Parse the JSON response
    const status = JSON.parse(content[0]!.text);
    expect(status.version).toBeDefined();
    expect(typeof status.hasBrandConfig).toBe("boolean");
    expect(typeof status.hasStatus).toBe("boolean");
    expect(typeof status.mcpConfigFound).toBe("boolean");
  });

  test("nib_brand_audit returns valid response shape", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({ name: "nib_brand_audit", arguments: {} });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toBeDefined();
    expect(content.length).toBeGreaterThan(0);
    expect(content[0]!.type).toBe("text");

    // Response is either a valid audit report or an error message
    const text = content[0]!.text;
    if (result.isError) {
      // Error path — no config; text is a plain string, not JSON
      expect(typeof text).toBe("string");
    } else {
      // Success path — audit report shape
      const parsed = JSON.parse(text);
      expect(typeof parsed.totalPairs).toBe("number");
      expect(typeof parsed.passed).toBe("number");
      expect(typeof parsed.failed).toBe("number");
      expect(Array.isArray(parsed.results)).toBe(true);
    }
  });

  test("lists all 4 prompts", async () => {
    const { client } = await createTestPair();
    const result = await client.listPrompts();
    const promptNames = result.prompts.map((p) => p.name).sort();

    expect(promptNames).toEqual([
      "nib-audit-review",
      "nib-brand-onboard",
      "nib-component-add",
      "nib-prototype-build",
    ]);
  });

  test("all prompts have descriptions", async () => {
    const { client } = await createTestPair();
    const result = await client.listPrompts();

    for (const prompt of result.prompts) {
      expect(prompt.description).toBeTruthy();
    }
  });

  test("nib-brand-onboard returns messages for a source file", async () => {
    const { client } = await createTestPair();
    const result = await client.getPrompt({
      name: "nib-brand-onboard",
      arguments: { from: "brand.md" },
    });

    expect(result.messages).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0]!.role).toBe("user");
    expect(result.messages[0]!.content.type).toBe("text");
  });

  test("nib_kit returns valid response shape", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({ name: "nib_kit", arguments: {} });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toBeDefined();
    expect(content.length).toBeGreaterThan(0);
    expect(content[0]!.type).toBe("text");

    if (result.isError) {
      // Error path — no config or no components
      expect(typeof content[0]!.text).toBe("string");
    } else {
      // Success path — kit recipe shape
      const parsed = JSON.parse(content[0]!.text);
      expect(typeof parsed.brandName).toBe("string");
      expect(typeof parsed.pencilVariables).toBe("object");
      expect(Array.isArray(parsed.components)).toBe(true);
      expect(typeof parsed.instruction).toBe("string");
    }
  });

  test("nib_brand_import returns valid response shape", async () => {
    const { client } = await createTestPair();
    // Call without overwrite so it hits the diff-check path (if config exists) or Pencil MCP path
    const result = await client.callTool({
      name: "nib_brand_import",
      arguments: { file: "/tmp/nonexistent-nib-test.pen" },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toBeDefined();
    expect(content.length).toBeGreaterThan(0);
    expect(content[0]!.type).toBe("text");
    expect(typeof content[0]!.text).toBe("string");
    expect(content[0]!.text.length).toBeGreaterThan(0);

    // Response is either a diff summary, a successful import result, or an error
    const text = content[0]!.text;
    if (!result.isError) {
      const parsed = JSON.parse(text);
      // Could be a diff (requiresConfirmation: true) or a full result
      expect(typeof parsed.requiresConfirmation).toBe("boolean");
    }
  });

  test("nib_component_list returns valid response shape", async () => {
    const { client } = await createTestPair();
    const result = await client.callTool({
      name: "nib_component_list",
      arguments: {},
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toBeDefined();
    expect(content.length).toBeGreaterThan(0);

    const text = content[0]!.text;
    const parsed = JSON.parse(text);
    if (result.isError) {
      // Error path — no config
      expect(text).toContain("nib_brand_init");
    } else {
      // Success path — component list shape
      expect(typeof parsed.count).toBe("number");
      expect(Array.isArray(parsed.components)).toBe(true);
    }
  });
});
