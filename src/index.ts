/**
 * nib — Public library API for programmatic usage.
 */

export { capture } from "./capture/index.js";
export { build } from "./build/index.js";
export { TEMPLATES, DEVICES, detectDevice } from "./templates/index.js";
export { discoverPencilMcp } from "./mcp/discover.js";
export { PencilMcpClient, withMcpClient } from "./mcp/client.js";
export { init as brandInit, brandBuild, brandPush, brandAudit, brandStyle } from "./brand/index.js";

// Re-export types
export type {
  DesignDocument,
  DesignCanvas,
  ResolvedNode,
  DesignVariables,
  DesignThemes,
  DesignAsset,
} from "./types/design.js";
export type { NibConfig, NibLink } from "./types/config.js";
export type {
  CaptureOptions,
  BuildOptions,
  ExportOptions,
  DevOptions,
  DeviceInfo,
  TemplateInfo,
} from "./types/options.js";
export type {
  NibBrandConfig,
  BrandInput,
  BrandInitOptions,
  BrandBuildOptions,
  BrandPushOptions,
  BrandAuditOptions,
  BrandStyleOptions,
  BrandAiProvider,
  WcagAuditReport,
  WcagCheckResult,
} from "./types/brand.js";
