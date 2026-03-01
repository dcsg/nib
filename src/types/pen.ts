/**
 * Types representing .pen file node structures as returned by the Pencil MCP server.
 * These are the raw types before normalization into DesignDocument.
 */

export type PenNodeType =
  | "frame"
  | "text"
  | "rectangle"
  | "ellipse"
  | "path"
  | "icon_font"
  | "image"
  | "group"
  | "note"
  | "component"
  | "ref";

export interface PenFill {
  type: "solid" | "linear" | "radial" | "image";
  color?: string;
  opacity?: number;
  gradient?: PenGradientStop[];
  imageUrl?: string;
  imageFit?: "cover" | "contain" | "fill" | "tile";
}

export interface PenGradientStop {
  position: number;
  color: string;
}

export interface PenStroke {
  color: string;
  width: number;
  style?: "solid" | "dashed" | "dotted";
  position?: "inside" | "outside" | "center";
}

export interface PenShadow {
  type: "drop" | "inner";
  color: string;
  x: number;
  y: number;
  blur: number;
  spread?: number;
}

export interface PenBlur {
  type: "layer" | "background";
  radius: number;
}

export interface PenTextStyle {
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

export interface PenLayoutProps {
  layout?: "none" | "horizontal" | "vertical";
  gap?: number;
  padding?: number | { top: number; right: number; bottom: number; left: number };
  alignItems?: "start" | "center" | "end" | "stretch";
  justifyContent?: "start" | "center" | "end" | "space-between" | "space-around";
  wrap?: boolean;
}

export type PenSizing = "fill_container" | "fit_content" | number;

export interface PenNode {
  id: string;
  type: PenNodeType;
  name?: string;
  visible?: boolean;

  // Geometry
  x?: number;
  y?: number;
  width?: number | PenSizing;
  height?: number | PenSizing;
  rotation?: number;

  // Layout
  layout?: PenLayoutProps;
  horizontalSizing?: PenSizing;
  verticalSizing?: PenSizing;

  // Visual
  fills?: PenFill[];
  strokes?: PenStroke[];
  shadows?: PenShadow[];
  blur?: PenBlur;
  opacity?: number;
  borderRadius?: number | { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };
  overflow?: "visible" | "hidden";

  // Text-specific
  text?: string;
  textStyle?: PenTextStyle;
  textStyles?: PenTextStyle[];  // Mixed styles within text

  // Path-specific
  pathData?: string;

  // Icon-specific
  iconFamily?: string;
  iconName?: string;
  iconStyle?: string;

  // Image-specific
  imageUrl?: string;
  imageFit?: "cover" | "contain" | "fill";

  // Ref (component instance)
  componentId?: string;
  overrides?: Record<string, Partial<PenNode>>;

  // Children
  children?: PenNode[];
}
