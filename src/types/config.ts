/**
 * nib.config.json shape — optional project configuration for prototypes.
 */

export interface NibConfig {
  /** Navigation links between canvases via hotspots */
  links?: NibLink[];
  /** Default template to use */
  template?: string;
  /** Default device frame */
  device?: string;
  /** Custom title for the prototype */
  title?: string;
}

export interface NibLink {
  /** Source canvas name */
  from: string;
  /** Node ID within the source canvas that acts as the hotspot */
  nodeId: string;
  /** Target canvas name */
  to: string;
  /** Optional transition type */
  transition?: "slide-left" | "slide-right" | "fade" | "none";
}
