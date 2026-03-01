/**
 * Structured output helpers for CLI commands.
 *
 * `writeResult()` — print data as JSON or human-friendly text.
 * `diagnostic()`  — always goes to stderr so it never pollutes JSON / MCP.
 */

export interface JsonEnvelope<T> {
  version: "1";
  command: string;
  data: T;
}

/** Wrap arbitrary data in the nib JSON envelope. */
export function wrapJson<T>(command: string, data: T): JsonEnvelope<T> {
  return { version: "1", command, data };
}

/**
 * Write a command result to stdout.
 *
 * - `json: true`  → JSON envelope on a single line (machine-readable)
 * - `json: false` → calls the optional `text` formatter, or pretty-prints JSON
 */
export function writeResult<T>(
  command: string,
  data: T,
  opts: { json: boolean; text?: (data: T) => string },
): void {
  if (opts.json) {
    process.stdout.write(JSON.stringify(wrapJson(command, data)) + "\n");
  } else if (opts.text) {
    process.stdout.write(opts.text(data) + "\n");
  } else {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
  }
}

/** Write a diagnostic/progress message to stderr (never touches stdout). */
export function diagnostic(message: string): void {
  process.stderr.write(message + "\n");
}
