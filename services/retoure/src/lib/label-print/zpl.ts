/**
 * ZPL (Zebra Programming Language) code builder.
 *
 * Low-level helpers for building label commands. Templates in
 * `templates.ts` compose these into concrete labels. Output is a
 * plain string that can be streamed to a Zebra-compatible printer
 * via `print.ts`.
 *
 * All coordinates are in *dots*. Use the `LABEL_*` constants for
 * dimensions calibrated to the most common label sizes at 203 dpi.
 *
 * Notes on ZPL safety:
 * - Caret (`^`) and tilde (`~`) are ZPL control characters and must
 *   not appear inside `^FD` field data. We replace them with a
 *   space to avoid breaking the data stream.
 */

/** Standard print density used by all kfzBlitz24 label printers. */
export const DPI_203 = 203;

/** Millimeters → dots at 203 dpi. */
export const mmToDots = (mm: number): number => Math.round((mm / 25.4) * DPI_203);

/**
 * Label dimensions in dots at 203 dpi. Width × Height.
 * Used as defaults for `^PW` (print width) and template layout maths.
 */
export const LABEL_4x6 = { width: mmToDots(101.6), height: mmToDots(152.4) } as const; // 4"×6"  — pallet/large
export const LABEL_4x4 = { width: mmToDots(101.6), height: mmToDots(101.6) } as const; // 4"×4"  — A6-ish square
export const LABEL_A6 = { width: mmToDots(105), height: mmToDots(148) } as const; // A6 sheet
export const LABEL_50x30 = { width: mmToDots(50), height: mmToDots(30) } as const; // small companion

/** Font sizes (height × width in dots) for `^A0N,h,w`. */
export interface TextOptions {
  /** Font height in dots. Default: 28. */
  fontHeight?: number;
  /** Font width in dots. Default: same as `fontHeight`. */
  fontWidth?: number;
  /**
   * Rotation:
   * - `N` = normal (0°)
   * - `R` = rotated 90° CW
   * - `I` = inverted 180°
   * - `B` = rotated 270° CW (= 90° CCW)
   */
  rotation?: "N" | "R" | "I" | "B";
  /**
   * Field block width in dots. If set, text auto-wraps into multiple
   * lines using `^FB`. Useful for long descriptions.
   */
  blockWidth?: number;
  /** Max lines for `^FB`. Default: 1. */
  blockLines?: number;
  /** Reverse video (white on black). Default: false. */
  reverse?: boolean;
}

/** Sanitises field data so the caret/tilde do not break the ZPL stream. */
function escapeFieldData(s: string): string {
  return s.replace(/\^/g, " ").replace(/~/g, " ");
}

/**
 * Place a text string at (x,y).
 *
 * @example
 *   text(40, 60, "kfzblitz24", { fontHeight: 60, fontWidth: 60 })
 */
export function text(x: number, y: number, content: string, opts: TextOptions = {}): string {
  const h = opts.fontHeight ?? 28;
  const w = opts.fontWidth ?? h;
  const rot = opts.rotation ?? "N";
  const data = escapeFieldData(content);
  const parts: string[] = [];
  parts.push(`^FO${x},${y}`);
  if (opts.reverse) parts.push(`^FR`);
  parts.push(`^A0${rot},${h},${w}`);
  if (opts.blockWidth) {
    parts.push(`^FB${opts.blockWidth},${opts.blockLines ?? 1},0,L,0`);
  }
  parts.push(`^FD${data}^FS`);
  return parts.join("");
}

/**
 * Code-128 barcode at (x,y). The default height is tuned for the
 * 4"×6" pallet label; reduce for smaller stocks.
 */
export function barcode128(x: number, y: number, content: string, height: number = 120): string {
  const data = escapeFieldData(content);
  // ^BY: module width 3, ratio 3.0 — readable at 203 dpi.
  // ^BCN,h,Y,N,N: normal orientation, print interpretation line, no check digit, no above.
  return `^FO${x},${y}^BY3,3,${height}^BCN,${height},Y,N,N^FD${data}^FS`;
}

/**
 * QR code at (x,y). Scale ~5 prints ~25mm wide at 203 dpi; scale 8 is full pallet.
 */
export function qr(x: number, y: number, content: string, scale: number = 5): string {
  const data = escapeFieldData(content);
  // ^BQN,2,scale,Q — model 2, error correction Q (~25%).
  // FD prefix `QA,` selects Auto data mode for the content.
  return `^FO${x},${y}^BQN,2,${scale},Q,7^FDQA,${data}^FS`;
}

/**
 * Filled or outlined rectangle. Use a thick `thickness` (>= h or w)
 * to get a fully filled bar for navy/orange brand accents.
 */
export function box(x: number, y: number, w: number, h: number, thickness: number = 2): string {
  return `^FO${x},${y}^GB${w},${h},${thickness}^FS`;
}

/**
 * Straight line from (x1,y1) to (x2,y2). Implemented via `^GB` with
 * the smaller dimension collapsed to `thickness`.
 */
export function line(x1: number, y1: number, x2: number, y2: number, thickness: number = 2): string {
  const w = Math.max(thickness, Math.abs(x2 - x1));
  const h = Math.max(thickness, Math.abs(y2 - y1));
  const ox = Math.min(x1, x2);
  const oy = Math.min(y1, y2);
  return `^FO${ox},${oy}^GB${w},${h},${thickness}^FS`;
}

/**
 * Wrap a list of element commands into a complete printable label.
 *
 * @param commands Array of ZPL fragments (e.g. from `text`, `barcode128`).
 * @param printWidth Optional `^PW` setting in dots. Defaults to 4"×6" width.
 * @param labelLength Optional `^LL` setting in dots. Defaults to 4"×6" height.
 *
 * Compatibility notes for Zebra-Clone-Drucker:
 * - `^MMT` setzt Tear-Off-Mode statt Continuous → Drucker stoppt am
 *   Label-Rand. Manche ZPL-II-Subset-Drucker (z. B. Munbyn RW403B)
 *   drucken sonst gar nicht weil sie auf das Mode-Token warten.
 * - `^PQ1,0,0,Y` zwingt explizit 1 Druck — ohne `^PQ` ignorieren
 *   einige Clones den ganzen Job still.
 */
export function buildZpl(
  commands: string[],
  printWidth: number = LABEL_4x6.width,
  labelLength: number = LABEL_4x6.height,
): string {
  return [
    "^XA",
    "^CI28", // UTF-8 input — needed for Umlaute (ä ö ü ß).
    "^MMT",  // Tear-Off-Mode (kein Continuous) — manche Subset-Drucker
             //   weigern sich sonst zu drucken.
    `^PW${printWidth}`,
    `^LL${labelLength}`,
    "^LH0,0",
    ...commands,
    "^PQ1,0,0,Y", // Print quantity: 1 Label, no pause, no replicate, Yes-cut.
    "^XZ",
  ].join("\n");
}
