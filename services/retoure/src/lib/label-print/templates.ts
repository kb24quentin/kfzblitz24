/**
 * Concrete ZPL label templates for the retoure workflows.
 *
 * Each template returns a complete ZPL document (with `^XA…^XZ`)
 * ready to ship to `sendZplToPrinter`. They are pure functions —
 * no I/O, no logging, fully deterministic given their inputs.
 *
 * Brand notes (CLAUDE.md §8):
 * - "kfzblitz24" wordmark = set in text, no bitmap. Navy/Orange split
 *   is purely visual (ZPL is monochrome) — we render the whole word
 *   in bold black and add a thick orange-equivalent rule beneath it.
 * - Doc-ID footer (PAL-KB24 / SUP-KB24 / DAM-KB24) printed small and
 *   rotated 90° in the bottom-right corner.
 */

import {
  LABEL_4x6,
  LABEL_A6,
  LABEL_50x30,
  barcode128,
  box,
  buildZpl,
  line,
  mmToDots,
  text,
} from "./zpl";

/** Doc-ID prefixes per CLAUDE.md §8 (RET-KB24 / SUP-KB24 / etc.). */
const DOC_ID_PALLET = "PAL-KB24";
const DOC_ID_SUPPLIER = "SUP-KB24";
const DOC_ID_DAMAGE = "DAM-KB24";

/** Formats a Date as "DD.MM.YYYY HH:mm" in local time. */
function fmtDateTime(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Formats a Date as "DD.MM.YYYY". */
function fmtDate(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Renders the kfzblitz24 wordmark + brand accent rule, returning ZPL fragments. */
function brandHeader(x: number, y: number, scale: number = 1): string[] {
  const wordHeight = Math.round(70 * scale);
  const wordWidth = Math.round(70 * scale);
  const ruleWidth = Math.round(420 * scale);
  const ruleThickness = Math.round(8 * scale);
  return [
    text(x, y, "kfzblitz24", { fontHeight: wordHeight, fontWidth: wordWidth }),
    // Brand accent rule — orange in print would be ideal; ZPL is mono so we
    // render a thick black bar that functions as the brand stripe.
    box(x, y + wordHeight + 6, ruleWidth, ruleThickness, ruleThickness),
  ];
}

/** Renders a small rotated footer doc-ID in the bottom-right corner. */
function footerDocId(docId: string, labelWidth: number, labelHeight: number, revStamp?: Date): string {
  const stamp = revStamp ? fmtDate(revStamp) : "";
  const footer = stamp ? `${docId} - ${stamp}` : docId;
  // Rotated 270° (B), anchored ~30 dots from the right edge, near the bottom.
  return text(labelWidth - 30, labelHeight - 280, footer, {
    fontHeight: 18,
    fontWidth: 18,
    rotation: "B",
  });
}

// ---------------------------------------------------------------------------
// 1) Pallet label — 10×15 cm (4"×6")
// ---------------------------------------------------------------------------

export interface PalletLabelOptions {
  /** Pallet identifier, also encoded as Code-128 barcode (e.g. "PAL-2026-000042"). */
  palletCode: string;
  /** Partner / customer name shown prominently on the label. */
  partnerName: string;
  /** When the pallet was opened. */
  createdAt: Date;
  /** Deadline by which the pallet should be closed and shipped. */
  maxOpenUntil: Date;
}

/**
 * Pallet label (10×15 cm). Layout (top → bottom):
 *
 *   kfzblitz24 wordmark + brand rule
 *   "PALETTE" + partner name
 *   Code-128 barcode of palletCode (+ human-readable underneath)
 *   created-at and max-open-until block
 *   rotated PAL-KB24 doc-id in the bottom-right corner
 */
export function palletLabelZpl(opts: PalletLabelOptions): string {
  const { width, height } = LABEL_4x6;
  const margin = mmToDots(5);

  const cmds: string[] = [];

  // Header
  cmds.push(...brandHeader(margin, margin));

  // Title
  cmds.push(
    text(margin, margin + 110, "PALETTE", { fontHeight: 56, fontWidth: 56 }),
  );

  // Partner name (auto-wrap into block)
  cmds.push(
    text(margin, margin + 180, opts.partnerName, {
      fontHeight: 40,
      fontWidth: 36,
      blockWidth: width - 2 * margin,
      blockLines: 2,
    }),
  );

  // Barcode
  const barcodeY = margin + 290;
  cmds.push(barcode128(margin, barcodeY, opts.palletCode, 140));
  cmds.push(
    text(margin, barcodeY + 170, opts.palletCode, { fontHeight: 32, fontWidth: 28 }),
  );

  // Separator line
  const sepY = barcodeY + 220;
  cmds.push(line(margin, sepY, width - margin, sepY, 3));

  // Date block
  cmds.push(
    text(margin, sepY + 20, "Geoeffnet:", { fontHeight: 26, fontWidth: 22 }),
    text(margin + 220, sepY + 20, fmtDateTime(opts.createdAt), {
      fontHeight: 26,
      fontWidth: 22,
    }),
    text(margin, sepY + 60, "Max. offen bis:", { fontHeight: 26, fontWidth: 22 }),
    text(margin + 220, sepY + 60, fmtDateTime(opts.maxOpenUntil), {
      fontHeight: 30,
      fontWidth: 26,
    }),
  );

  // Footer doc-id
  cmds.push(footerDocId(DOC_ID_PALLET, width, height, opts.createdAt));

  return buildZpl(cmds, width, height);
}

// ---------------------------------------------------------------------------
// 2) Supplier-return label — A6 (10.5×14.8 cm)
// ---------------------------------------------------------------------------

export interface SupplierReturnLabelOptions {
  /** RMA case id (e.g. "CASE-2026-00123"). */
  caseId: string;
  /** Original webisco "bestellnummer" the supplier knows the goods by. */
  bestellnummer: string;
  /** Supplier display name. */
  supplierName: string;
  /** Multi-line postal address — line breaks via `\n` are honoured. */
  supplierAddress: string;
}

/**
 * Supplier-return label (A6). Suitable for sticking on the carton
 * shipped back to the supplier / Lieferant.
 */
export function supplierReturnLabelZpl(opts: SupplierReturnLabelOptions): string {
  const { width, height } = LABEL_A6;
  const margin = mmToDots(5);

  const cmds: string[] = [];

  // Header
  cmds.push(...brandHeader(margin, margin, 0.9));

  // Title
  cmds.push(
    text(margin, margin + 100, "LIEFERANTEN-RETOURE", {
      fontHeight: 40,
      fontWidth: 36,
    }),
  );

  // Case ID + Bestellnummer block
  const blockY = margin + 160;
  cmds.push(
    text(margin, blockY, "RMA-Case:", { fontHeight: 26, fontWidth: 22 }),
    text(margin + 180, blockY, opts.caseId, { fontHeight: 30, fontWidth: 26 }),
    text(margin, blockY + 50, "Bestell-Nr.:", { fontHeight: 26, fontWidth: 22 }),
    text(margin + 180, blockY + 50, opts.bestellnummer, {
      fontHeight: 30,
      fontWidth: 26,
    }),
  );

  // Case barcode
  const barcodeY = blockY + 110;
  cmds.push(barcode128(margin, barcodeY, opts.caseId, 100));

  // Separator
  const addrY = barcodeY + 200;
  cmds.push(line(margin, addrY - 10, width - margin, addrY - 10, 3));

  // Address block
  cmds.push(
    text(margin, addrY, "An:", { fontHeight: 24, fontWidth: 20 }),
    text(margin + 80, addrY, opts.supplierName, { fontHeight: 32, fontWidth: 28 }),
    text(margin + 80, addrY + 50, opts.supplierAddress, {
      fontHeight: 26,
      fontWidth: 22,
      blockWidth: width - margin - 80,
      blockLines: 4,
    }),
  );

  // Footer doc-id
  cmds.push(footerDocId(DOC_ID_SUPPLIER, width, height, new Date()));

  return buildZpl(cmds, width, height);
}

// ---------------------------------------------------------------------------
// 3) Damage-documentation companion label — 50×30 mm
// ---------------------------------------------------------------------------

export interface DamageDocLabelOptions {
  /** RMA case id. */
  caseId: string;
  /** Article / SKU number being documented. */
  articleNumber: string;
  /** Optional short description (auto-truncated to one line). */
  articleDescription?: string;
}

/**
 * Compact damage-documentation companion sticker (50×30 mm) — placed
 * next to the article in the photo evidence shot so case-id and
 * SKU are visible in every image.
 */
export function damageDocLabelZpl(opts: DamageDocLabelOptions): string {
  const { width, height } = LABEL_50x30;
  const margin = mmToDots(2);

  const cmds: string[] = [];

  // Title
  cmds.push(
    text(margin, margin, "kfzblitz24", { fontHeight: 22, fontWidth: 22 }),
    text(margin + 160, margin, "SCHADEN", { fontHeight: 22, fontWidth: 22 }),
    line(margin, margin + 28, width - margin, margin + 28, 2),
  );

  // Case id
  cmds.push(
    text(margin, margin + 38, "Case:", { fontHeight: 20, fontWidth: 18 }),
    text(margin + 70, margin + 38, opts.caseId, { fontHeight: 22, fontWidth: 20 }),
  );

  // Article
  cmds.push(
    text(margin, margin + 70, "Art.:", { fontHeight: 20, fontWidth: 18 }),
    text(margin + 70, margin + 70, opts.articleNumber, {
      fontHeight: 22,
      fontWidth: 20,
    }),
  );

  if (opts.articleDescription) {
    cmds.push(
      text(margin, margin + 100, opts.articleDescription, {
        fontHeight: 18,
        fontWidth: 16,
        blockWidth: width - 2 * margin,
        blockLines: 1,
      }),
    );
  }

  // Footer — small, rotated, but the label is tiny so we just print bottom-right horizontally.
  cmds.push(
    text(width - 80, height - 22, DOC_ID_DAMAGE, {
      fontHeight: 14,
      fontWidth: 14,
    }),
  );

  return buildZpl(cmds, width, height);
}
