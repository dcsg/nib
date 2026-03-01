/**
 * PencilMcpClient — wraps the MCP SDK to call Pencil MCP server tools.
 *
 * One-shot usage: create → connect → call tools → close.
 * The Pencil MCP server is spawned as a child process via StdioClientTransport.
 */

import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { McpServerConfig } from "./discover.js";

export interface McpToolResult {
  content: { type: string; text?: string; data?: string; mimeType?: string }[];
  isError?: boolean;
}

export class PencilMcpClient {
  private client: Client;
  private transport: StdioClientTransport;
  private connected = false;

  constructor(private config: McpServerConfig) {
    this.client = new Client({ name: "nib", version: "0.1.0" });
    this.transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env ? { ...process.env, ...config.env } as Record<string, string> : undefined,
      stderr: "pipe",
    });
  }

  async connect(): Promise<void> {
    await this.client.connect(this.transport);
    this.connected = true;
  }

  async close(): Promise<void> {
    if (this.connected) {
      await this.transport.close();
      this.connected = false;
    }
  }

  private assertConnected(): void {
    if (!this.connected) {
      throw new Error("PencilMcpClient is not connected. Call connect() first.");
    }
  }

  private extractText(result: McpToolResult): string {
    const textContent = result.content.find((c) => c.type === "text");
    return textContent?.text ?? "";
  }

  private parseJson<T>(text: string): T {
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Failed to parse MCP response as JSON: ${text.slice(0, 200)}`);
    }
  }

  /** Call any Pencil MCP tool by name */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<McpToolResult> {
    this.assertConnected();
    const result = await this.client.callTool({ name, arguments: args });
    if (result.isError) {
      const text = this.extractText(result as McpToolResult);
      throw new Error(`MCP tool "${name}" failed: ${text}`);
    }
    return result as McpToolResult;
  }

  /** Get the current editor state (active file, selection, etc.) */
  async getEditorState(): Promise<unknown> {
    const result = await this.callTool("get_editor_state");
    return this.parseJson(this.extractText(result));
  }

  /** Open a .pen file in the editor */
  async openDocument(filePathOrNew: string): Promise<string> {
    const result = await this.callTool("open_document", { filePathOrTemplate: filePathOrNew });
    return this.extractText(result);
  }

  /** Batch-get nodes by patterns or IDs */
  async batchGet(opts: { patterns?: string[]; nodeIds?: string[] }): Promise<unknown> {
    const result = await this.callTool("batch_get", opts);
    return this.parseJson(this.extractText(result));
  }

  /** Get variables and themes from the current .pen file */
  async getVariables(): Promise<unknown> {
    const result = await this.callTool("get_variables");
    return this.parseJson(this.extractText(result));
  }

  /** Get a screenshot of a node */
  async getScreenshot(nodeId?: string): Promise<{ data: string; mimeType: string } | null> {
    const args = nodeId ? { nodeId } : {};
    const result = await this.callTool("get_screenshot", args);
    const imageContent = result.content.find((c) => c.type === "image");
    if (imageContent?.data && imageContent.mimeType) {
      return { data: imageContent.data, mimeType: imageContent.mimeType };
    }
    return null;
  }

  /** Get the layout snapshot of the current file */
  async snapshotLayout(): Promise<unknown> {
    const result = await this.callTool("snapshot_layout");
    return this.parseJson(this.extractText(result));
  }

  /** Get all available style guide tags */
  async getStyleGuideTags(): Promise<string> {
    const result = await this.callTool("get_style_guide_tags");
    return this.extractText(result);
  }

  /** Get a style guide by tags or name */
  async getStyleGuide(opts: { tags?: string[]; name?: string }): Promise<string> {
    const result = await this.callTool("get_style_guide", opts);
    return this.extractText(result);
  }
}

/** Create, connect, use, and close a PencilMcpClient in a single scope */
export async function withMcpClient<T>(
  config: McpServerConfig,
  fn: (client: PencilMcpClient) => Promise<T>,
): Promise<T> {
  const client = new PencilMcpClient(config);
  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.close();
  }
}
