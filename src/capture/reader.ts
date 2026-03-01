/**
 * Reads top-level frames (canvases) and components from a .pen file via MCP.
 */

import type { PencilMcpClient } from "../mcp/client.js";
import type { PenNode } from "../types/pen.js";

export interface RawCapture {
  canvases: RawCanvas[];
  components: Record<string, PenNode>;
  variables: RawVariables;
}

export interface RawCanvas {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundColor?: string;
  children: PenNode[];
}

export interface RawVariables {
  variables?: Record<string, unknown>;
  themes?: { axes?: Record<string, string[]> };
}

/**
 * Open a .pen file and read its full node tree, variables, and layout.
 */
export async function readPenFile(client: PencilMcpClient, filePath: string): Promise<RawCapture> {
  // Open the document
  await client.openDocument(filePath);

  // Fetch the full node tree — pattern "*" gets all top-level children
  const tree = (await client.batchGet({ patterns: ["*"] })) as BatchGetResult;

  // Fetch variables and themes
  const vars = (await client.getVariables()) as RawVariables;

  const canvases: RawCanvas[] = [];
  const components: Record<string, PenNode> = {};

  const nodes = tree.nodes ?? tree.results ?? (Array.isArray(tree) ? tree : []);

  for (const node of nodes) {
    if (node.type === "component") {
      components[node.id] = node;
    } else if (node.type === "frame") {
      canvases.push({
        id: node.id,
        name: node.name ?? `Canvas ${canvases.length + 1}`,
        width: typeof node.width === "number" ? node.width : 0,
        height: typeof node.height === "number" ? node.height : 0,
        backgroundColor: extractBackgroundColor(node),
        children: node.children ?? [],
      });
    }
    // Notes and other non-visual top-level nodes are skipped
  }

  return { canvases, components, variables: vars };
}

function extractBackgroundColor(node: PenNode): string | undefined {
  const fill = node.fills?.[0];
  if (fill?.type === "solid" && fill.color) return fill.color;
  return undefined;
}

// The batch_get response shape can vary — handle both array and object forms
interface BatchGetResult {
  nodes?: PenNode[];
  results?: PenNode[];
  [key: string]: unknown;
}
