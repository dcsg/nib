/**
 * Semantic exit codes for CLI commands.
 *
 * Standard meanings so scripts and CI can branch on the exit code
 * without parsing stdout.
 */
export const ExitCode = {
  SUCCESS: 0,
  ERROR: 1,
  USAGE: 2,
  VALIDATION_FAILURE: 3,
  CONFIG_ERROR: 4,
  NETWORK_ERROR: 5,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];
