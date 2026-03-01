/**
 * Pencil MCP connectivity probe.
 *
 * `probePencilMcp()` — goes beyond binary discovery:
 *   1. Finds the binary path (discoverPencilMcp)
 *   2. Spawns the server and calls get_editor_state
 *   3. Returns structured result so callers can distinguish:
 *      - Binary not found
 *      - Binary found but Pencil GUI not running
 *      - Fully connected + editor state available
 *
 * Used by `nib doctor` and error-path handlers in capture/push.
 */

import type { McpServerConfig } from "./discover.js";

export interface PencilProbeResult {
  /** Binary was found at a known path */
  binaryFound: boolean;
  /** MCP server responded to get_editor_state */
  responding: boolean;
  /** Path to the binary, if found */
  binaryPath?: string;
  /** Raw editor state returned by Pencil, if responding */
  editorState?: unknown;
  /** Error message from the probe, if not responding */
  error?: string;
}

/**
 * Probe Pencil MCP connectivity.
 *
 * Always resolves (never throws) — failures are encoded in the result.
 * Timeout: 8 seconds (enough for the binary to spawn and respond).
 */
export async function probePencilMcp(): Promise<PencilProbeResult> {
  // Step 1: discover binary
  let mcpConfig: McpServerConfig;
  try {
    const { discoverPencilMcp } = await import("./discover.js");
    mcpConfig = await discoverPencilMcp();
  } catch (err) {
    return {
      binaryFound: false,
      responding: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Step 2: spawn + call get_editor_state with a timeout
  const { withMcpClient } = await import("./client.js");

  const probePromise = withMcpClient(mcpConfig, async (client) => {
    return await client.getEditorState();
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Pencil MCP did not respond within 8 seconds")), 8_000),
  );

  try {
    const editorState = await Promise.race([probePromise, timeoutPromise]);
    return {
      binaryFound: true,
      responding: true,
      binaryPath: mcpConfig.command,
      editorState,
    };
  } catch (err) {
    return {
      binaryFound: true,
      responding: false,
      binaryPath: mcpConfig.command,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Human-readable status line from a probe result.
 * Used consistently in doctor, status, and error messages.
 */
export function probeStatusLabel(result: PencilProbeResult): string {
  if (!result.binaryFound) return "Pencil not installed";
  if (!result.responding) return "Pencil found but not running";
  return "Pencil running";
}

/**
 * Actionable fix suggestion from a probe result.
 */
export function probeFix(result: PencilProbeResult): string | undefined {
  if (!result.binaryFound) {
    return "Install Pencil.app from pencil.dev — nib requires it for capture and push";
  }
  if (!result.responding) {
    return "Open Pencil.app, then re-run this command";
  }
  return undefined;
}
