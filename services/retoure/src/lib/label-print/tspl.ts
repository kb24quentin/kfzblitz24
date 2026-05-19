/**
 * TSPL (TSC Printer Language) code builder.
 *
 * Pendant zu `zpl.ts` — gleiches Konzept, andere Syntax. TSPL ist
 * die Default-Sprache für Munbyn-Portable-Drucker (RW402B, RW403B
 * und andere "PCL: ZPL or TSPL"-Geräte sprechen TSPL out-of-the-box).
 *
 * Doc-Quellen:
 *   - TSC TSPL/TSPL2 Programming Manual (öffentlich auf tscprinters.com)
 *   - Munbyn RW403B Self-Test bestätigt: "PCL: ZPL or TSPL"
 *
 * Koordinaten: DOTS bei 203 dpi (gleich wie unsere ZPL-Templates).
 * Origin (0,0) ist oben links wenn DIRECTION=1, sonst unten links.
 */

// DPI-Konstante + mm-to-dots-Helfer liegen in ./zpl.
// TSPL braucht intern keinen eigenen Konverter weil unsere Layouts
// SIZE in mm und Elemente in dots ausdrücken — beide kommen direkt
// vom Caller bzw. den TSPL_LABEL_*_MM-Konstanten.

/**
 * Label-Dimensionen in mm. TSPL erwartet `SIZE` in mm (oder inch),
 * NICHT in dots — anders als ZPL!
 *
 * Wir benutzen INTEGER-Werte (100/150 statt 101.6/152.4) weil einige
 * Munbyn-Firmware-Versionen den Dezimal-Parser nicht mögen und das
 * SIZE-Token dann ignorieren — was zu "keine Reaktion" führt.
 */
export const TSPL_LABEL_4x6_MM  = { widthMm: 100, heightMm: 150 } as const;
export const TSPL_LABEL_A6_MM   = { widthMm: 105, heightMm: 148 } as const;
export const TSPL_LABEL_50x30_MM = { widthMm: 50, heightMm: 30  } as const;

/**
 * Built-in TSPL-Schriften — Fixed-Bitmap-Fonts.
 *   "0" → Monotype CG Triumvirate Bold Condensed (skalierbar via x/y-Multiplier)
 *   "1" → 8×12 dots
 *   "2" → 12×20 dots
 *   "3" → 16×24 dots
 *   "4" → 24×32 dots
 *   "5" → 32×48 dots
 *   "8" → 14×19 OCR-A
 *   "ROMAN.TTF" → TrueType, beliebige Skalierung
 */
export type TsplFont = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "ROMAN.TTF";

export interface TsplTextOptions {
  /** Schrift-Slot. Default "3" (16×24, gut lesbar). */
  font?: TsplFont;
  /**
   * Rotation in Grad (0/90/180/270). TSPL benutzt Integer, kein Char
   * wie ZPL ("N"/"R"/…).
   */
  rotation?: 0 | 90 | 180 | 270;
  /** X-Multiplier (1–10). Mit "0"-Schrift effektiv die Punktgröße. */
  xMultiplier?: number;
  /** Y-Multiplier (1–10). */
  yMultiplier?: number;
}

/**
 * Maskiert Field-Daten für TSPL — Anführungszeichen müssen escaped
 * werden weil sie das Argument-Quoting beenden.
 */
function escapeTspl(s: string): string {
  return s.replace(/"/g, "'");
}

/**
 * Text an (x,y).
 *
 * @example
 *   tsplText(40, 60, "kfzblitz24", { font: "0", xMultiplier: 5, yMultiplier: 5 })
 */
export function tsplText(
  x: number,
  y: number,
  content: string,
  opts: TsplTextOptions = {},
): string {
  const font = opts.font ?? "3";
  const rot = opts.rotation ?? 0;
  const xm = opts.xMultiplier ?? 1;
  const ym = opts.yMultiplier ?? 1;
  return `TEXT ${x},${y},"${font}",${rot},${xm},${ym},"${escapeTspl(content)}"`;
}

/**
 * Code-128-Barcode. Achtung: TSPL-Barcode-Syntax ist deutlich anders
 * als ZPL — der Typ-String wird in Anführungszeichen erwartet, Höhe
 * ist in Dots, readable=1 zeigt menschen-lesbaren Text unter dem
 * Code (wir machen das selbst für bessere Typo → readable=0).
 */
export function tsplBarcode128(
  x: number,
  y: number,
  content: string,
  height: number = 80,
  narrow: number = 2,
  wide: number = 4,
): string {
  return `BARCODE ${x},${y},"128",${height},0,0,${narrow},${wide},"${escapeTspl(content)}"`;
}

/**
 * Gefülltes Rechteck (für Brand-Akzent-Balken o. Ä.).
 * BAR ist immer gefüllt. Für Outlines siehe `tsplBox()`.
 */
export function tsplBar(x: number, y: number, width: number, height: number): string {
  return `BAR ${x},${y},${width},${height}`;
}

/**
 * Outline-Rechteck. Anders als ZPL braucht TSPL die End-Koordinaten,
 * nicht width/height — wir rechnen das um damit die Caller-API
 * konsistent bleibt.
 */
export function tsplBox(
  x: number,
  y: number,
  width: number,
  height: number,
  thickness: number = 2,
): string {
  return `BOX ${x},${y},${x + width},${y + height},${thickness}`;
}

/**
 * Horizontale oder vertikale Linie. Implementiert via BAR mit
 * kollabierter Dimension (gleicher Trick wie unsere ZPL-line()).
 */
export function tsplLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number = 2,
): string {
  const w = Math.max(thickness, Math.abs(x2 - x1));
  const h = Math.max(thickness, Math.abs(y2 - y1));
  const ox = Math.min(x1, x2);
  const oy = Math.min(y1, y2);
  return tsplBar(ox, oy, w, h);
}

/**
 * Komplettes Label aus Fragmenten bauen. Header setzt die Page so
 * auf wie Munbyn-Portables das mögen:
 *
 *   SIZE       Label-Dimensionen in mm
 *   GAP        Lücke zwischen Labels (2 mm Standard für die meisten
 *              Rollen die wir verwenden — TODO konfigurierbar machen
 *              sobald wir gummiierte Endless-Rollen testen)
 *   DENSITY    Druck-Schwärze (0=hell, 15=dunkel; 8 ist Mittelweg)
 *   DIRECTION  1 = oben-links Origin (Standard für unsere Layouts)
 *   CODEPAGE   UTF-8 für Umlaute
 *   CLS        Puffer leeren
 *   ...        Elemente
 *   PRINT 1,1  Druck-Trigger (1 Label, 1 Kopie) — OHNE diese Zeile
 *              passiert nichts!
 */
export function buildTspl(
  commands: string[],
  widthMm: number = TSPL_LABEL_4x6_MM.widthMm,
  heightMm: number = TSPL_LABEL_4x6_MM.heightMm,
): string {
  // CRLF (\r\n) ist Pflicht für Munbyn-Portable-Drucker — sie behandeln
  // den Bluetooth-SPP-Stream wie eine serielle Verbindung und erwarten
  // klassisch-serielle Line-Endings. Mit reinem \n verschluckt der
  // Parser die ganze Sequenz und macht stillschweigend nichts.
  return [
    `SIZE ${widthMm} mm, ${heightMm} mm`,
    `GAP 2 mm, 0 mm`,
    `DENSITY 8`,
    `DIRECTION 1`,
    `CODEPAGE UTF-8`,
    `CLS`,
    ...commands,
    `PRINT 1,1`,
    ``, // trailing CRLF damit das letzte Kommando sauber terminiert
  ].join("\r\n");
}

/**
 * Minimaler TSPL-Test-Druck — eine Zeile "TEST kfzBlitz24" auf der
 * gewählten Label-Größe. Praktisch um zu diagnostizieren ob der Drucker
 * TSPL versteht (= das hier druckt) oder ob das ZPL-Modus braucht oder
 * gar kein Bluetooth-Print-Mode aktiv ist (= nix passiert).
 */
export function buildTsplHelloTest(
  widthMm: number = TSPL_LABEL_4x6_MM.widthMm,
  heightMm: number = TSPL_LABEL_4x6_MM.heightMm,
): string {
  return buildTspl(
    [
      tsplText(40, 60, "TEST", { font: "0", xMultiplier: 6, yMultiplier: 6 }),
      tsplText(40, 200, "kfzBlitz24", { font: "0", xMultiplier: 4, yMultiplier: 4 }),
      tsplText(40, 320, new Date().toLocaleString("de-DE"), { font: "3" }),
    ],
    widthMm,
    heightMm,
  );
}
