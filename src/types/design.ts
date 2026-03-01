/**
 * DesignDocument — the intermediate JSON format between capture and build.
 * This is the contract between all phases of the pipeline.
 */

export interface DesignDocument {
  version: "1";
  source: string;
  capturedAt: string;
  canvases: DesignCanvas[];
  components: Record<string, ResolvedNode>;
  variables: DesignVariables;
  themes: DesignThemes;
  assets: DesignAsset[];
}

export interface DesignCanvas {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundColor?: string;
  children: ResolvedNode[];
}

export interface ResolvedNode {
  id: string;
  type: ResolvedNodeType;
  name?: string;
  visible?: boolean;

  // Geometry
  x?: number;
  y?: number;
  width?: number | SizingValue;
  height?: number | SizingValue;
  rotation?: number;

  // Layout
  layout?: LayoutProps;
  horizontalSizing?: SizingValue;
  verticalSizing?: SizingValue;

  // Visual
  fills?: Fill[];
  strokes?: Stroke[];
  shadows?: Shadow[];
  blur?: Blur;
  opacity?: number;
  borderRadius?: number | BorderRadius;
  overflow?: "visible" | "hidden";

  // Text
  text?: string;
  textStyle?: TextStyle;
  textStyles?: TextStyle[];

  // Path
  pathData?: string;

  // Icon
  iconFamily?: string;
  iconName?: string;
  iconStyle?: string;

  // Image
  imageUrl?: string;
  imageFit?: "cover" | "contain" | "fill";

  // Children (refs are resolved inline — no ref nodes in DesignDocument)
  children?: ResolvedNode[];
}

export type ResolvedNodeType =
  | "frame"
  | "text"
  | "rectangle"
  | "ellipse"
  | "path"
  | "icon_font"
  | "image"
  | "group";

export type SizingValue = "fill_container" | "fit_content" | number;

export interface LayoutProps {
  direction: "none" | "horizontal" | "vertical";
  gap?: number;
  padding?: Spacing;
  alignItems?: "start" | "center" | "end" | "stretch";
  justifyContent?: "start" | "center" | "end" | "space-between" | "space-around";
  wrap?: boolean;
}

export interface Spacing {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Fill {
  type: "solid" | "linear" | "radial" | "image";
  color?: string;
  opacity?: number;
  gradient?: GradientStop[];
  imageUrl?: string;
  imageFit?: "cover" | "contain" | "fill" | "tile";
}

export interface GradientStop {
  position: number;
  color: string;
}

export interface Stroke {
  color: string;
  width: number;
  style: "solid" | "dashed" | "dotted";
  position: "inside" | "outside" | "center";
}

export interface Shadow {
  type: "drop" | "inner";
  color: string;
  x: number;
  y: number;
  blur: number;
  spread: number;
}

export interface Blur {
  type: "layer" | "background";
  radius: number;
}

export interface TextStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  fontStyle?: "normal" | "italic";
  lineHeight?: number | string;
  letterSpacing?: number;
  textAlign?: "left" | "center" | "right" | "justify";
  textDecoration?: "none" | "underline" | "line-through";
  color?: string;
}

export interface BorderRadius {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

// Variables & Themes

export interface DesignVariables {
  [varName: string]: DesignVariable;
}

export interface DesignVariable {
  type: "color" | "number" | "string";
  default: string | number;
  themes?: Record<string, string | number>;
}

export interface DesignThemes {
  axes: Record<string, string[]>;
}

// Assets

export interface DesignAsset {
  type: "font" | "icon_font" | "image";
  family?: string;
  weights?: (number | string)[];
  url?: string;
  provider?: "google" | "material" | "lucide" | "custom";
}
