/**
 * Environment detection utilities for CLI and MCP modes.
 *
 * Thin wrappers so the rest of the codebase can ask "is this a human at a
 * terminal?" without scattering process.env checks everywhere.
 */

/** Running inside a CI system (GitHub Actions, GitLab CI, etc.) */
export function isCI(): boolean {
  return Boolean(
    process.env["CI"] ||
      process.env["GITHUB_ACTIONS"] ||
      process.env["GITLAB_CI"] ||
      process.env["CIRCLECI"] ||
      process.env["JENKINS_URL"] ||
      process.env["TF_BUILD"],
  );
}

/** stdout is a TTY (not piped / redirected) */
export function isTTY(): boolean {
  return Boolean(process.stdout.isTTY);
}

/** Safe to use interactive prompts (TTY and not CI) */
export function isInteractive(): boolean {
  return isTTY() && !isCI();
}

/** Whether to emit ANSI colour codes — respects NO_COLOR / FORCE_COLOR */
export function shouldColor(): boolean {
  if (process.env["FORCE_COLOR"] && process.env["FORCE_COLOR"] !== "0") return true;
  if (process.env["NO_COLOR"] !== undefined) return false;
  return isTTY();
}
