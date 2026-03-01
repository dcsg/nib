/**
 * Options for each phase of the pipeline.
 */

export interface CaptureOptions {
  /** Path to the .pen file */
  file: string;
  /** Output path for the intermediate JSON */
  output?: string;
  /** Specific canvas names to capture (default: all) */
  canvases?: string[];
}

export interface BuildOptions {
  /** Path to the intermediate JSON file */
  input: string;
  /** Output directory */
  output?: string;
  /** Template to use */
  template?: "clean" | "presentation";
  /** Embed all assets for offline use */
  standalone?: boolean;
  /** Device frame name */
  device?: string;
  /** Path to nib.config.json */
  config?: string;
}

export interface ExportOptions extends Omit<BuildOptions, "input"> {
  /** Path to the .pen file(s) */
  files: string[];
}

export interface DevOptions {
  /** Path to the .pen file */
  file: string;
  /** Port for the dev server */
  port?: number;
  /** Template to use */
  template?: "clean" | "presentation";
  /** Open browser automatically */
  open?: boolean;
}

export interface DeviceInfo {
  name: string;
  width: number;
  height: number;
  category: "phone" | "tablet" | "desktop" | "custom";
}

export interface TemplateInfo {
  name: string;
  description: string;
}
