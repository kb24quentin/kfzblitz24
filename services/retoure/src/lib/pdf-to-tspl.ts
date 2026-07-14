/**
 * PDF-Bytes → TSPL-Buffer mit BITMAP-Kommandos.
 *
 * TypeScript-Port von tools/printer/pdf-to-tspl.mjs. Wird vom Backend-
 * Endpoint /api/pda/containers/[id]/label-tspl-bitmap benutzt, damit
 * das pixel-perfekte PDF-Design vom RMA-Dashboard 1:1 auf dem Xprinter
 * XP-420B im Warehouse erscheint.
 *
 * Pipeline:
 *   1. PDF-Buffer temp-File schreiben
 *   2. pdftoppm -mono -r 203 -singlefile → PBM (Portable BitMap)
 *   3. PBM-Header parsen (P4 Magic, width, height, dann Rohdaten)
 *   4. TSPL-Wrapper drum: SIZE, GAP, DENSITY, SPEED, CLS, BITMAP…, PRINT
 *
 * PBM-Format:
 *   - 1 Bit pro Pixel, MSB first
 *   - 1 = schwarz, 0 = weiß
 *   - Reihen padded auf ganze Bytes
 *
 * TSPL BITMAP-Konvention ist INVERS (1=weiß, 0=schwarz), deshalb XOR-Flip.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SETUP: braucht `pdftoppm` im Docker-Image → `apk add poppler-utils`
 * ─────────────────────────────────────────────────────────────────────────
 */

import { spawn } from "node:child_process";
import { writeFile, readFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DPI = 203;

export interface RasterizedMono {
  widthPx: number;
  heightPx: number;
  widthBytes: number;
  /** 1bpp MSB-first, bit=1 → weiß (bereits geflippt für TSPL). */
  pixels: Buffer;
}

export interface WrapOptions {
  widthMm?: number;
  heightMm?: number;
  /** DENSITY 0-15, 8 ist Xprinter-Default. */
  density?: number;
  /** SPEED 1-8, 4 ist ein guter Kompromiss zwischen Tempo und Qualität. */
  speed?: number;
}

/**
 * Rasterisiert PDF-Bytes zu monochromem PBM (203 DPI) via pdftoppm.
 */
export async function rasterizePdfMono(pdfBytes: Buffer | Uint8Array): Promise<RasterizedMono> {
  const dir = await mkdtemp(join(tmpdir(), "printer-"));
  const pdfPath = join(dir, "in.pdf");
  const pbmBase = join(dir, "out");
  const pbmPath = `${pbmBase}.pbm`;

  await writeFile(pdfPath, pdfBytes);
  try {
    await runCmd("pdftoppm", ["-mono", "-r", String(DPI), "-singlefile", pdfPath, pbmBase]);
    const pbm = await readFile(pbmPath);
    return parsePbmP4(pbm);
  } finally {
    await unlink(pdfPath).catch(() => {});
    await unlink(pbmPath).catch(() => {});
  }
}

/**
 * Parse Netpbm P4 (raw binary bitmap):
 *   Header:  "P4\n<width> <height>\n"
 *   Body:    raw bytes, 1bpp MSB-first, rows padded to byte boundary.
 */
function parsePbmP4(buf: Buffer): RasterizedMono {
  if (buf[0] !== 0x50 || buf[1] !== 0x34) {
    throw new Error(`PBM-Magic falsch — erwartet "P4", bekam ${buf.slice(0, 2).toString()}`);
  }
  let pos = 2;
  const readToken = (): string => {
    // Whitespace + Kommentare skippen
    while (pos < buf.length) {
      const c = buf[pos];
      if (c === 0x23 /* # */) {
        while (pos < buf.length && buf[pos] !== 0x0a) pos++;
      } else if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) {
        pos++;
      } else break;
    }
    const start = pos;
    while (pos < buf.length) {
      const c = buf[pos];
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) break;
      pos++;
    }
    return buf.slice(start, pos).toString("ascii");
  };

  const widthPx = Number(readToken());
  const heightPx = Number(readToken());
  if (!widthPx || !heightPx) throw new Error("PBM ohne width/height");

  // Ein Whitespace-Byte nach den Numbers, dann Raster
  pos++;

  const widthBytes = Math.ceil(widthPx / 8);
  const expectedLength = widthBytes * heightPx;
  const rawPixels = buf.slice(pos, pos + expectedLength);
  if (rawPixels.length !== expectedLength) {
    throw new Error(
      `PBM-Body-Länge stimmt nicht: erwartet ${expectedLength}, bekam ${rawPixels.length}`,
    );
  }

  // TSPL-Konvention flip: PBM bit=1 schwarz → TSPL bit=0 schwarz
  const pixels = Buffer.alloc(rawPixels.length);
  for (let i = 0; i < rawPixels.length; i++) {
    pixels[i] = ~rawPixels[i] & 0xff;
  }
  return { widthPx, heightPx, widthBytes, pixels };
}

function runCmd(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(`${cmd} exited ${code}: ${stderr}`));
      else resolve();
    });
  });
}

/**
 * Wrappt rasterisiertes PBM in vollständiges TSPL das direkt an TCP:9100
 * gesendet werden kann.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * XPRINTER XP-420B QUIRK (aus Memory printer-xp420b.md):
 *   Der Drucker hat nur ~128 KB DRAM. Ein einzelnes 124-KB-BITMAP für
 *   4×6" @ 203 DPI sprengt den Puffer → ECONNRESET mitten im Job.
 *   Lösung: BITMAP in Streifen à 64 Zeilen (~6.5 KB) senden, jedes als
 *   eigenes BITMAP-Kommando. Rein weiße Streifen skippen wir komplett
 *   (CLS hat den Puffer schon weiß initialisiert) — spart bei typischen
 *   Labels >50%.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function wrapAsTspl(raster: RasterizedMono, opts: WrapOptions = {}): Buffer {
  const {
    widthMm = 100,
    heightMm = 150,
    density = 8,
    speed = 4,
  } = opts;
  const CRLF = "\r\n";

  const STRIP_ROWS = 64;
  const parts: Buffer[] = [];

  parts.push(Buffer.from([
    `SIZE ${widthMm} mm, ${heightMm} mm`,
    `GAP 2 mm, 0 mm`,
    `SPEED ${speed}`,
    `DENSITY ${density}`,
    `DIRECTION 1`,
    `CODEPAGE UTF-8`,
    `CLS`,
    ``, // trailing CRLF vor dem ersten BITMAP
  ].join(CRLF), "utf8"));

  for (let y = 0; y < raster.heightPx; y += STRIP_ROWS) {
    const rows = Math.min(STRIP_ROWS, raster.heightPx - y);
    const slice = raster.pixels.subarray(
      y * raster.widthBytes,
      (y + rows) * raster.widthBytes,
    );
    // Nach dem Flip ist 0xFF = 8× weiß. Komplett-weiße Streifen skippen.
    let allWhite = true;
    for (let i = 0; i < slice.length; i++) {
      if (slice[i] !== 0xff) { allWhite = false; break; }
    }
    if (allWhite) continue;
    parts.push(Buffer.from(`BITMAP 0,${y},${raster.widthBytes},${rows},0,`, "utf8"));
    parts.push(slice);
    parts.push(Buffer.from(CRLF, "utf8"));
  }

  parts.push(Buffer.from(`PRINT 1,1` + CRLF, "utf8"));
  return Buffer.concat(parts);
}

/**
 * Convenience: PDF-Bytes → TSPL-Buffer in einem Schritt.
 * Nutzt Standard-Xprinter-Params (4×6", density 8, speed 4).
 */
export async function pdfToTsplBitmap(
  pdfBytes: Buffer | Uint8Array,
  opts: WrapOptions = {},
): Promise<Buffer> {
  const raster = await rasterizePdfMono(pdfBytes);
  return wrapAsTspl(raster, opts);
}
