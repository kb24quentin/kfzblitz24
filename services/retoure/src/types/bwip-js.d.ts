declare module "bwip-js" {
  export interface ToBufferOpts {
    bcid: string;
    text: string;
    scale?: number;
    scaleX?: number;
    scaleY?: number;
    height?: number;
    width?: number;
    includetext?: boolean;
    textxalign?: "left" | "center" | "right" | "justify" | "above" | "below" | "offleft" | "offright";
    textsize?: number;
    backgroundcolor?: string;
    barcolor?: string;
    textcolor?: string;
    padding?: number;
    paddingwidth?: number;
    paddingheight?: number;
    /** QR-spezifisch: Fehlerkorrektur-Level L (7%), M (15%), Q (25%), H (30%) */
    eclevel?: "L" | "M" | "Q" | "H";
  }
  export function toBuffer(opts: ToBufferOpts): Promise<Uint8Array>;
  const _default: { toBuffer: typeof toBuffer };
  export default _default;
}
